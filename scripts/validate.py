#!/usr/bin/env python3
"""Validate data/resources.json against the spec's invariants."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse


REPO_ROOT = Path(__file__).resolve().parent.parent
RESOURCES_PATH = REPO_ROOT / "data" / "resources.json"

STAGE_VALUES = {
    "idea",
    "customer_discovery",
    "building_mvp",
    "pre_revenue",
    "early_revenue",
    "scaling",
    "fundraising_seed",
    "fundraising_series_a",
}
INDUSTRY_VALUES = {
    "ai_ml",
    "climate_cleantech",
    "biotech_health",
    "consumer_d2c",
    "fintech",
    "hardware_deep_tech",
    "crypto_web3",
    "gaming",
    "social_impact",
    "enterprise_saas",
    "edtech",
    "generalist",
}
AFFILIATION_VALUES = {"uw_madison", "wisconsin_state", "national", "global"}
RESOURCE_TYPE_VALUES = {
    "funding_equity",
    "funding_grant",
    "funding_loan",
    "pitch_competition",
    "accelerator",
    "incubator",
    "fellowship",
    "software_credit",
    "legal_service",
    "mentorship",
    "community",
    "education_course",
    "education_book",
    "physical_space",
    "talent_platform",
    "event_recurring",
    "media_newsletter",
}
BUSINESS_MODEL_VALUES = {
    "saas",
    "consumer_d2c",
    "marketplace",
    "hardware",
    "biotech_therapeutics",
    "medical_device",
    "deep_tech_research",
    "services",
    "content_media",
    "agnostic",
}
CAPITAL_TYPE_VALUES = {
    "dilutive",
    "non_dilutive",
    "credits",
    "in_kind",
    "not_applicable",
}
BOTTLENECK_VALUES = {
    "funding",
    "customers",
    "team",
    "legal",
    "product_technical",
    "mentorship",
    "ip_patents",
    "space_facilities",
    "awareness",
}
CATEGORY_VALUES = {
    "uw_institutional_hub",
    "funding_fellowships",
    "pitch_competitions",
    "accelerators_incubators",
    "software_credits",
    "legal_services",
    "mentorship_communities",
    "non_dilutive_funding",
    "physical_spaces",
    "talent_hiring",
    "education",
    "events",
    "industry_specific",
}


def looks_like_valid_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def main() -> int:
    if not RESOURCES_PATH.exists():
        print(f"ERROR: Missing {RESOURCES_PATH}", file=sys.stderr)
        return 1

    resources = json.loads(RESOURCES_PATH.read_text(encoding="utf-8"))
    if not isinstance(resources, list) or not resources:
        print("ERROR: resources.json is empty or malformed.", file=sys.stderr)
        return 1

    errors: list[str] = []
    warnings: list[str] = []
    seen_ids: set[str] = set()
    counts = Counter()

    for index, resource in enumerate(resources, start=1):
        label = resource.get("id") or resource.get("name") or f"index={index}"
        counts[resource.get("category", "unknown")] += 1

        name = str(resource.get("name", "")).strip()
        if not name:
            errors.append(f"{label}: missing name")

        resource_id = str(resource.get("id", "")).strip()
        if not resource_id:
            errors.append(f"{label}: missing id")
        elif resource_id in seen_ids:
            errors.append(f"{label}: duplicate id")
        else:
            seen_ids.add(resource_id)

        stages = resource.get("stages") or []
        if not stages:
            errors.append(f"{label}: must have at least one stage tag")
        elif any(stage not in STAGE_VALUES for stage in stages):
            errors.append(f"{label}: invalid stage value(s) {stages}")

        industries = resource.get("industries") or []
        if any(industry not in INDUSTRY_VALUES for industry in industries):
            errors.append(f"{label}: invalid industry value(s) {industries}")

        affiliation = resource.get("affiliation")
        if affiliation not in AFFILIATION_VALUES:
            errors.append(f"{label}: invalid affiliation {affiliation!r}")

        if resource.get("category") not in CATEGORY_VALUES:
            errors.append(f"{label}: invalid category {resource.get('category')!r}")

        if resource.get("resource_type") not in RESOURCE_TYPE_VALUES:
            errors.append(
                f"{label}: invalid resource_type {resource.get('resource_type')!r}"
            )

        business_models = resource.get("business_models") or []
        if any(model not in BUSINESS_MODEL_VALUES for model in business_models):
            errors.append(f"{label}: invalid business model(s) {business_models}")

        capital_type = resource.get("capital_type") or []
        if any(capital not in CAPITAL_TYPE_VALUES for capital in capital_type):
            errors.append(f"{label}: invalid capital type(s) {capital_type}")

        bottlenecks = resource.get("bottleneck_tags") or []
        if any(item not in BOTTLENECK_VALUES for item in bottlenecks):
            errors.append(f"{label}: invalid bottleneck tag(s) {bottlenecks}")

        external_url = resource.get("external_url")
        if external_url and not looks_like_valid_url(str(external_url)):
            errors.append(f"{label}: invalid external_url {external_url!r}")

        if resource.get("verification_flags"):
            warnings.append(
                f"{label}: verification flags {resource.get('verification_flags')}"
            )

    print(f"Validated {len(resources)} resources.")
    print("Counts by category:")
    for category, count in sorted(counts.items()):
        print(f"  {category}: {count}")

    if warnings:
        print(f"Warnings ({len(warnings)}):")
        for warning in warnings[:50]:
            print(f"  - {warning}")
        if len(warnings) > 50:
            print(f"  ... {len(warnings) - 50} more warning(s)")

    if errors:
        print(f"Errors ({len(errors)}):", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("Validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
