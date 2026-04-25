#!/usr/bin/env python3
"""Run the TS pipeline against each canonical profile and print results.

By default this runs the Milestone 2 filter+score path.
Pass --with-llm to include Milestone 3 personalization when ANTHROPIC_API_KEY is set.

Usage: python tests/eval.py
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PROFILES_PATH = REPO_ROOT / "tests" / "fixtures" / "test_profiles.json"
ENTRY_PATH = REPO_ROOT / "tests" / "eval_entry.ts"
RESOURCES_PATH = REPO_ROOT / "data" / "resources.json"


def run_pipeline(profile: dict, *, include_llm: bool = False) -> dict:
    tsx = shutil.which("tsx") or shutil.which("npx")
    if tsx is None:
        sys.stderr.write("ERROR: neither `tsx` nor `npx` is on PATH.\n")
        sys.exit(1)

    if tsx.endswith("tsx"):
        cmd = [tsx, str(ENTRY_PATH)]
    else:
        cmd = [tsx, "--yes", "tsx", str(ENTRY_PATH)]

    env = os.environ.copy()
    if include_llm:
        env["EVAL_INCLUDE_LLM"] = "1"

    result = subprocess.run(
        cmd,
        input=json.dumps(profile).encode("utf-8"),
        capture_output=True,
        cwd=str(REPO_ROOT),
        env=env,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stderr.decode("utf-8", errors="replace"))
        raise RuntimeError(f"eval_entry failed (rc={result.returncode})")

    stdout = result.stdout.decode("utf-8").strip()
    if not stdout:
        raise RuntimeError("eval_entry produced no output")
    return json.loads(stdout)


def main() -> int:
    include_llm = "--with-llm" in sys.argv[1:]

    if not PROFILES_PATH.exists():
        sys.stderr.write(f"Missing fixtures: {PROFILES_PATH}\n")
        return 1

    if not RESOURCES_PATH.exists():
        print(
            f"NOTE: {RESOURCES_PATH} does not exist — Terminal A has not landed yet. "
            "Pipeline will run against an empty resource list.\n"
        )

    if include_llm and not os.environ.get("ANTHROPIC_API_KEY"):
        print("NOTE: --with-llm was requested, but ANTHROPIC_API_KEY is missing. Falling back to matching-only output.\n")
        include_llm = False

    profiles = json.loads(PROFILES_PATH.read_text())

    for entry in profiles:
        label = entry.get("label", "?")
        desc = entry.get("description", "")
        profile = entry["profile"]

        print("=" * 80)
        print(f"PROFILE: {label}")
        print(f"  {desc}")
        print(
            f"  stage={profile['stage']} industries={profile['industries']} "
            f"bottleneck={profile['primary_bottleneck']} "
            f"capital={profile['capital_preference']}"
        )
        print("-" * 80)

        try:
            result = run_pipeline(profile, include_llm=include_llm)
        except Exception as e:
            print(f"  ERROR: {e}")
            continue

        print(
            f"  total={result['total_resources']}  "
            f"after_filter={result['filtered_count']}  "
            f"top={len(result['top'])}"
        )
        print()
        print(f"  {'#':>2}  {'score':>5}  {'aff':<15}  {'cat':<28}  name")
        for i, row in enumerate(result["top"], 1):
            star = "*" if row["is_high_leverage_pick"] else " "
            print(
                f"  {i:>2}  {row['score']:>5}  "
                f"{row['affiliation']:<15}  "
                f"{row['category']:<28}  "
                f"{star} {row['name']}"
            )
        print()

        guide = result.get("guide")
        if guide:
            print("  OPENING NOTE")
            print(f"  {guide['opening_note']}")
            print()
            validate_and_print_tier("Start this week", guide["tier_1_start_this_week"], expected_min=3, expected_max=5)
            validate_and_print_tier("Explore this month", guide["tier_2_explore_this_month"], expected_min=6, expected_max=10)
            validate_and_print_tier("Bookmark for later", guide["tier_3_bookmark_for_later"], expected_min=0, expected_max=25)
            print()

    return 0


def validate_and_print_tier(label: str, entries: list[dict], *, expected_min: int, expected_max: int) -> None:
    count = len(entries)
    status = []
    if count < expected_min or count > expected_max:
        status.append(f"WRONG_COUNT expected {expected_min}-{expected_max}")
    long_reasons = [entry["resource_id"] for entry in entries if len(entry["reason"].split()) > 30]
    if long_reasons:
        status.append(f"LONG_REASONS {', '.join(long_reasons)}")

    suffix = f"  [{' | '.join(status)}]" if status else ""
    print(f"  {label} ({count}){suffix}")
    for entry in entries:
        print(f"    - {entry['resource']['name']} :: {entry['reason']}")


if __name__ == "__main__":
    sys.exit(main())
