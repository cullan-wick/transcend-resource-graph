#!/usr/bin/env python3
"""Render data/resources.json as a markdown file with one table per category.

Each row shows the tag fields you'll want to hand-edit, plus a one-sentence
description. Edit the markdown file, then later we can write a sync script
that pushes changes back into resources.json.
"""

from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INPUT_PATH = REPO_ROOT / "data" / "resources.json"
OUTPUT_PATH = REPO_ROOT / "data" / "resources_review.md"

CATEGORY_ORDER = [
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
]

CATEGORY_LABELS = {
    "uw_institutional_hub": "UW Institutional Hub",
    "funding_fellowships": "Funding & Fellowships",
    "pitch_competitions": "Pitch Competitions",
    "accelerators_incubators": "Accelerators & Incubators",
    "software_credits": "Software Credits",
    "legal_services": "Legal Services",
    "mentorship_communities": "Mentorship & Communities",
    "non_dilutive_funding": "Non-Dilutive Funding",
    "physical_spaces": "Physical Spaces",
    "talent_hiring": "Talent & Hiring",
    "education": "Education",
    "events": "Events",
    "industry_specific": "Industry-Specific",
}


def first_sentence(text: str | None) -> str:
    if not text:
        return ""
    text = text.replace("\n", " ").strip()
    for terminator in (". ", "! ", "? "):
        idx = text.find(terminator)
        if idx != -1:
            return text[: idx + 1].strip()
    return text.strip()


def fmt_list(values: list[str] | None) -> str:
    if not values:
        return ""
    return ", ".join(values)


def fmt_bool(value: bool) -> str:
    return "Y" if value else ""


def escape_pipes(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ")


def render_table(resources: list[dict]) -> str:
    headers = [
        "Name",
        "Description (1-sentence)",
        "Stages",
        "Industries",
        "Affiliation",
        "Resource type",
        "Business models",
        "Capital type",
        "Bottleneck tags",
        "Subcategory",
        "High-leverage",
    ]
    lines = ["| " + " | ".join(headers) + " |"]
    lines.append("| " + " | ".join(["---"] * len(headers)) + " |")

    for r in sorted(resources, key=lambda x: x.get("name", "").lower()):
        row = [
            escape_pipes(r.get("name", "")),
            escape_pipes(first_sentence(r.get("description"))),
            escape_pipes(fmt_list(r.get("stages"))),
            escape_pipes(fmt_list(r.get("industries"))),
            escape_pipes(r.get("affiliation", "") or ""),
            escape_pipes(r.get("resource_type", "") or ""),
            escape_pipes(fmt_list(r.get("business_models"))),
            escape_pipes(fmt_list(r.get("capital_type"))),
            escape_pipes(fmt_list(r.get("bottleneck_tags"))),
            escape_pipes(r.get("subcategory") or ""),
            fmt_bool(bool(r.get("is_high_leverage_pick"))),
        ]
        lines.append("| " + " | ".join(row) + " |")

    return "\n".join(lines)


def main() -> int:
    resources = json.loads(INPUT_PATH.read_text(encoding="utf-8"))

    by_category: dict[str, list[dict]] = {c: [] for c in CATEGORY_ORDER}
    extras: list[dict] = []
    for r in resources:
        cat = r.get("category", "")
        if cat in by_category:
            by_category[cat].append(r)
        else:
            extras.append(r)

    out: list[str] = [
        "# Transcend UW Founder Resource Guide — Review Tables",
        "",
        f"_Generated from `data/resources.json` ({len(resources)} resources)._",
        "",
        "## Editing notes",
        "",
        "- Edit cells in place. Allowed values for tag columns:",
        "  - **Stages:** idea, customer_discovery, building_mvp, pre_revenue, early_revenue, scaling, fundraising_seed, fundraising_series_a",
        "  - **Industries:** ai_ml, climate_cleantech, biotech_health, consumer_d2c, fintech, hardware_deep_tech, crypto_web3, gaming, social_impact, enterprise_saas, edtech, generalist",
        "  - **Affiliation:** uw_madison, wisconsin_state, national, global",
        "  - **Resource type:** funding_equity, funding_grant, funding_loan, pitch_competition, accelerator, incubator, fellowship, software_credit, legal_service, mentorship, community, education_course, education_book, physical_space, talent_platform, event_recurring, media_newsletter",
        "  - **Business models:** saas, consumer_d2c, marketplace, hardware, biotech_therapeutics, medical_device, deep_tech_research, services, content_media, agnostic",
        "  - **Capital type:** dilutive, non_dilutive, credits, in_kind, not_applicable",
        "  - **Bottleneck tags:** funding, customers, team, legal, product_technical, mentorship, ip_patents, space_facilities, awareness",
        "  - **High-leverage:** Y or blank",
        "- Multi-value cells are comma-separated.",
        "- Empty list = no restriction (e.g., empty Industries means it's open to any industry).",
        "",
        "## Table of contents",
        "",
    ]
    for cat in CATEGORY_ORDER:
        count = len(by_category[cat])
        if count == 0:
            continue
        anchor = CATEGORY_LABELS[cat].lower().replace(" ", "-").replace("&", "")
        anchor = "-".join([p for p in anchor.split("-") if p])
        out.append(f"- [{CATEGORY_LABELS[cat]}](#{anchor}) ({count})")

    out.append("")

    for cat in CATEGORY_ORDER:
        items = by_category[cat]
        if not items:
            continue
        out.append(f"## {CATEGORY_LABELS[cat]}")
        out.append("")
        out.append(render_table(items))
        out.append("")

    if extras:
        out.append("## Uncategorized")
        out.append("")
        out.append(render_table(extras))
        out.append("")

    OUTPUT_PATH.write_text("\n".join(out), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} ({len(resources)} resources).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
