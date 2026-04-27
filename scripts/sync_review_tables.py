#!/usr/bin/env python3
"""Sync edits from data/resources_review.md back into data/resources.json.

Workflow:
  1. Edit data/resources_review.md by hand.
  2. Run `python scripts/sync_review_tables.py` to apply tag edits.
  3. `git diff data/resources.json` to review.
  4. Commit and push.

Only the tag columns are synced. Description, name, and other fields in the
markdown are ignored. Resources are matched by name (case-insensitive,
whitespace-collapsed). Rows whose name doesn't match any existing resource
are reported and skipped.

Allowed tag values are validated. Any unknown tag value aborts the sync
with a list of offending rows so you can fix the markdown first.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = REPO_ROOT / "data" / "resources.json"
MD_PATH = REPO_ROOT / "data" / "resources_review.md"

ALLOWED = {
    "stages": {
        "idea", "customer_discovery", "building_mvp", "pre_revenue",
        "early_revenue", "scaling", "fundraising_seed", "fundraising_series_a",
    },
    "industries": {
        "ai_ml", "climate_cleantech", "biotech_health", "consumer_d2c",
        "fintech", "hardware_deep_tech", "crypto_web3", "gaming",
        "social_impact", "enterprise_saas", "edtech", "generalist",
    },
    "affiliation": {"uw_madison", "wisconsin_state", "national", "global"},
    "resource_type": {
        "funding_equity", "funding_grant", "funding_loan", "pitch_competition",
        "accelerator", "incubator", "fellowship", "software_credit",
        "legal_service", "mentorship", "community", "education_course",
        "education_book", "physical_space", "talent_platform",
        "event_recurring", "media_newsletter",
    },
    "business_models": {
        "saas", "consumer_d2c", "marketplace", "hardware",
        "biotech_therapeutics", "medical_device", "deep_tech_research",
        "services", "content_media", "agnostic",
    },
    "capital_type": {
        "dilutive", "non_dilutive", "credits", "in_kind", "not_applicable",
    },
    "bottleneck_tags": {
        "funding", "customers", "team", "legal", "product_technical",
        "mentorship", "ip_patents", "space_facilities", "awareness",
    },
}

EXPECTED_HEADERS = [
    "name",
    "description (1-sentence)",
    "stages",
    "industries",
    "affiliation",
    "resource type",
    "business models",
    "capital type",
    "bottleneck tags",
    "subcategory",
    "high-leverage",
]

# Map markdown column header -> json field + parser type
COLUMN_TO_FIELD = {
    "stages": ("stages", "list"),
    "industries": ("industries", "list"),
    "affiliation": ("affiliation", "scalar"),
    "resource type": ("resource_type", "scalar"),
    "business models": ("business_models", "list"),
    "capital type": ("capital_type", "list"),
    "bottleneck tags": ("bottleneck_tags", "list"),
    "subcategory": ("subcategory", "scalar_or_null"),
    "high-leverage": ("is_high_leverage_pick", "bool"),
}

LIST_FIELDS = {
    "stages", "industries", "business_models", "capital_type", "bottleneck_tags",
}
SCALAR_FIELDS = {"affiliation", "resource_type"}


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name).strip().lower()


def parse_cell(cell: str) -> str:
    return cell.replace("\\|", "|").strip()


def parse_list(cell: str) -> list[str]:
    cell = parse_cell(cell)
    if not cell:
        return []
    return [v.strip() for v in cell.split(",") if v.strip()]


def parse_table_rows(md_text: str) -> list[dict[str, str]]:
    """Yield row dicts (header lowercase -> cell text) for every table row."""
    lines = md_text.splitlines()
    rows: list[dict[str, str]] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.lstrip().startswith("|") and i + 1 < len(lines):
            sep = lines[i + 1].lstrip()
            if sep.startswith("|") and "---" in sep:
                # header line
                headers = [parse_cell(c) for c in line.strip().strip("|").split("|")]
                headers_lower = [h.lower() for h in headers]
                # Validate header set matches expectation (subset is fine, but warn).
                if not all(h in headers_lower for h in EXPECTED_HEADERS):
                    print(
                        f"WARN: table near line {i+1} missing expected headers; got {headers_lower}",
                        file=sys.stderr,
                    )
                i += 2
                while i < len(lines) and lines[i].lstrip().startswith("|"):
                    cells = [parse_cell(c) for c in lines[i].strip().strip("|").split("|")]
                    if len(cells) != len(headers_lower):
                        i += 1
                        continue
                    rows.append(dict(zip(headers_lower, cells)))
                    i += 1
                continue
        i += 1
    return rows


def validate_row(row: dict[str, str], errors: list[str]) -> None:
    name = row.get("name", "").strip()
    for column, (json_field, kind) in COLUMN_TO_FIELD.items():
        cell = row.get(column, "")
        if kind == "list":
            values = parse_list(cell)
            allowed = ALLOWED[json_field]
            unknown = [v for v in values if v not in allowed]
            if unknown:
                errors.append(
                    f"  '{name}': column '{column}' has unknown value(s) {unknown}"
                )
        elif kind == "scalar":
            value = parse_cell(cell)
            if value and value not in ALLOWED[json_field]:
                errors.append(
                    f"  '{name}': column '{column}' has unknown value '{value}'"
                )
        # scalar_or_null and bool need no allowed-set validation


def apply_row_to_resource(row: dict[str, str], resource: dict) -> list[str]:
    """Return list of human-readable change descriptions."""
    changes: list[str] = []
    for column, (json_field, kind) in COLUMN_TO_FIELD.items():
        cell = row.get(column, "")
        if kind == "list":
            new_value = parse_list(cell)
            old_value = resource.get(json_field) or []
            if list(new_value) != list(old_value):
                changes.append(f"{json_field}: {old_value} -> {new_value}")
                resource[json_field] = new_value
        elif kind == "scalar":
            new_value = parse_cell(cell) or None
            old_value = resource.get(json_field)
            if new_value != old_value and new_value is not None:
                changes.append(f"{json_field}: {old_value!r} -> {new_value!r}")
                resource[json_field] = new_value
        elif kind == "scalar_or_null":
            new_value = parse_cell(cell) or None
            old_value = resource.get(json_field)
            if new_value != old_value:
                changes.append(f"{json_field}: {old_value!r} -> {new_value!r}")
                resource[json_field] = new_value
        elif kind == "bool":
            new_value = parse_cell(cell).strip().lower() == "y"
            old_value = bool(resource.get(json_field))
            if new_value != old_value:
                changes.append(f"{json_field}: {old_value} -> {new_value}")
                resource[json_field] = new_value
    return changes


def main() -> int:
    if not MD_PATH.exists():
        print(f"Missing {MD_PATH}. Run scripts/generate_review_tables.py first.", file=sys.stderr)
        return 1
    if not JSON_PATH.exists():
        print(f"Missing {JSON_PATH}.", file=sys.stderr)
        return 1

    md_text = MD_PATH.read_text(encoding="utf-8")
    resources = json.loads(JSON_PATH.read_text(encoding="utf-8"))

    by_name: dict[str, dict] = {}
    for r in resources:
        by_name[normalize_name(r.get("name", ""))] = r

    rows = parse_table_rows(md_text)
    print(f"Parsed {len(rows)} table rows from {MD_PATH.name}.")

    # Validate first; abort on any unknown values.
    validation_errors: list[str] = []
    for row in rows:
        validate_row(row, validation_errors)
    if validation_errors:
        print("Validation failed. Fix these cells in the markdown:", file=sys.stderr)
        for err in validation_errors:
            print(err, file=sys.stderr)
        return 2

    unmatched: list[str] = []
    matched_count = 0
    changed_count = 0
    total_changes = 0

    for row in rows:
        name = row.get("name", "").strip()
        if not name:
            continue
        key = normalize_name(name)
        resource = by_name.get(key)
        if resource is None:
            unmatched.append(name)
            continue
        matched_count += 1
        changes = apply_row_to_resource(row, resource)
        if changes:
            changed_count += 1
            total_changes += len(changes)
            print(f"  [{name}]")
            for c in changes:
                print(f"    {c}")

    if unmatched:
        print(f"\nWARN: {len(unmatched)} markdown rows had no matching resource by name:", file=sys.stderr)
        for n in unmatched[:10]:
            print(f"  - {n}", file=sys.stderr)
        if len(unmatched) > 10:
            print(f"  ... and {len(unmatched) - 10} more", file=sys.stderr)

    print(f"\nMatched {matched_count} rows; updated {changed_count} resources ({total_changes} field changes).")

    if total_changes == 0:
        print("No changes to write.")
        return 0

    JSON_PATH.write_text(
        json.dumps(resources, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {JSON_PATH}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
