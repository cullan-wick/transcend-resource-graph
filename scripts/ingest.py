#!/usr/bin/env python3
"""Build data/resources.json from the source markdown with Claude extraction."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import re
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Iterable, Literal

from pydantic import BaseModel, Field, ValidationError
from slugify import slugify
from tqdm import tqdm

try:
    from anthropic import AsyncAnthropic
except ImportError:  # pragma: no cover - import guard for setup issues
    AsyncAnthropic = None  # type: ignore[assignment]


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE_PATH = (
    REPO_ROOT / "data" / "source" / "TranscendUW_FounderResourceGuide_2026.md"
)
DEFAULT_OUTPUT_PATH = REPO_ROOT / "data" / "resources.json"
DEFAULT_PROMPT_PATH = REPO_ROOT / "scripts" / "prompts" / "extraction_prompt.txt"
TODAY = date.today().isoformat()

STAGE_VALUES = [
    "idea",
    "customer_discovery",
    "building_mvp",
    "pre_revenue",
    "early_revenue",
    "scaling",
    "fundraising_seed",
    "fundraising_series_a",
]
INDUSTRY_VALUES = [
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
]
AFFILIATION_VALUES = ["uw_madison", "wisconsin_state", "national", "global"]
RESOURCE_TYPE_VALUES = [
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
]
BUSINESS_MODEL_VALUES = [
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
]
CAPITAL_TYPE_VALUES = [
    "dilutive",
    "non_dilutive",
    "credits",
    "in_kind",
    "not_applicable",
]
BOTTLENECK_VALUES = [
    "funding",
    "customers",
    "team",
    "legal",
    "product_technical",
    "mentorship",
    "ip_patents",
    "space_facilities",
    "awareness",
]
CATEGORY_VALUES = [
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
CATEGORY_BY_SECTION = {
    "1": "uw_institutional_hub",
    "2": "funding_fellowships",
    "3": "pitch_competitions",
    "4": "accelerators_incubators",
    "5": "software_credits",
    "6": "legal_services",
    "7": "mentorship_communities",
    "8": "non_dilutive_funding",
    "9": "physical_spaces",
    "10": "talent_hiring",
    "11": "education",
    "12": "events",
    "13": "industry_specific",
}
AFFILIATION_RANK = {
    "uw_madison": 0,
    "wisconsin_state": 1,
    "national": 2,
    "global": 3,
}

Stage = Literal[
    "idea",
    "customer_discovery",
    "building_mvp",
    "pre_revenue",
    "early_revenue",
    "scaling",
    "fundraising_seed",
    "fundraising_series_a",
]
Industry = Literal[
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
]
Affiliation = Literal["uw_madison", "wisconsin_state", "national", "global"]
ResourceType = Literal[
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
]
BusinessModel = Literal[
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
]
CapitalType = Literal[
    "dilutive",
    "non_dilutive",
    "credits",
    "in_kind",
    "not_applicable",
]
Bottleneck = Literal[
    "funding",
    "customers",
    "team",
    "legal",
    "product_technical",
    "mentorship",
    "ip_patents",
    "space_facilities",
    "awareness",
]
Category = Literal[
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

SECTION_RE = re.compile(r"^###\s+IV\.(\d+)\s+—\s+(.+)$")
SUBCATEGORY_RE = re.compile(r"^####\s+(.+)$")
RESOURCE_LINE_RE = re.compile(r"^(?:- )?\*\*(?P<name>.+?)\*\*(?P<tail>.*)$")
TABLE_BOLD_NAME_RE = re.compile(r"^\*\*(?P<name>.+?)\*\*(?P<tail>.*)$")
SOURCE_COVERAGE_RE = re.compile(r"\bS[123](?:[–-](?:UW|EXT))?\b")
BRACKETED_FLAG_RE = re.compile(r"\[(?:VERIFY(?::[^\]]+)?|CHECK(?::[^\]]+)?)\]")

RESOURCE_FIELD_LABELS = {
    "what it is",
    "who it's for",
    "what you get",
    "how to access",
    "leadership",
    "contacts",
    "contact",
    "deadline",
    "notes",
    "source coverage",
    "status",
    "stages",
}
NORMALIZED_RESOURCE_FIELD_LABELS = {
    re.sub(r"[^a-z0-9]+", "", value.lower()) for value in RESOURCE_FIELD_LABELS
}
INDUSTRY_BY_SUBCATEGORY = {
    ("industry_specific", "AI / ML"): ["ai_ml"],
    ("industry_specific", "Climate / CleanTech"): ["climate_cleantech"],
    ("industry_specific", "Biotech / Health"): ["biotech_health"],
    ("industry_specific", "Consumer / D2C"): ["consumer_d2c"],
    ("industry_specific", "Fintech"): ["fintech"],
    ("industry_specific", "Hardware / Deep Tech"): ["hardware_deep_tech"],
    ("industry_specific", "Crypto / Web3"): ["crypto_web3"],
    ("industry_specific", "Gaming"): ["gaming"],
    ("industry_specific", "Social Impact"): ["social_impact"],
}


class ResourceContactModel(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    role: str | None = None


class ResourceEligibilityModel(BaseModel):
    undergrad_eligible: bool
    masters_eligible: bool
    phd_eligible: bool
    faculty_staff_eligible: bool
    recent_grad_eligible: bool
    stem_required: bool
    college_restrictions: list[str] = Field(default_factory=list)
    us_citizenship_required: bool
    team_required: bool
    solo_founder_eligible: bool


class ExtractedResourceModel(BaseModel):
    name: str
    description: str
    stages: list[Stage]
    industries: list[Industry]
    affiliation: Affiliation
    resource_type: ResourceType
    business_models: list[BusinessModel]
    capital_type: list[CapitalType]
    eligibility: ResourceEligibilityModel
    what_you_get: str
    how_to_access: str
    external_url: str | None = None
    contact: ResourceContactModel | None = None
    dollar_value_estimate: int | None = None
    deadline: str | None = None
    notes: str | None = None
    bottleneck_tags: list[Bottleneck]


class ResourceModel(BaseModel):
    id: str
    name: str
    category: Category
    subcategory: str | None = None
    description: str
    stages: list[Stage]
    industries: list[Industry]
    affiliation: Affiliation
    resource_type: ResourceType
    business_models: list[BusinessModel]
    capital_type: list[CapitalType]
    eligibility: ResourceEligibilityModel
    what_you_get: str
    how_to_access: str
    external_url: str | None = None
    contact: ResourceContactModel | None = None
    dollar_value_estimate: int | None = None
    deadline: str | None = None
    is_high_leverage_pick: bool
    bottleneck_tags: list[Bottleneck]
    notes: str | None = None
    source_coverage: list[str] = Field(default_factory=list)
    verification_flags: list[str] = Field(default_factory=list)
    last_reviewed: str


RESOURCE_TOOL_SCHEMA = ExtractedResourceModel.model_json_schema()


@dataclass(slots=True)
class ParsedResourceBlock:
    category: Category
    subcategory: str | None
    raw_block: str
    source_line: int


def iter_nonempty(lines: Iterable[str]) -> Iterable[str]:
    for line in lines:
        stripped = line.strip()
        if stripped:
            yield stripped


def leading_spaces(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def is_resource_field_label(name: str) -> bool:
    normalized = re.sub(r"[^a-z0-9]+", "", name.lower().rstrip(":"))
    return normalized in NORMALIZED_RESOURCE_FIELD_LABELS


def is_resource_candidate(line: str) -> bool:
    if leading_spaces(line) != 0:
        return False

    stripped = line.strip()
    if stripped.startswith("|"):
        return False

    match = RESOURCE_LINE_RE.match(stripped)
    if not match:
        return False

    name = match.group("name").strip()
    return bool(name) and not name.endswith(":") and not is_resource_field_label(name)


def is_resource_start(lines: list[str], index: int) -> bool:
    line = lines[index]
    if not is_resource_candidate(line):
        return False

    match = RESOURCE_LINE_RE.match(line.strip())
    assert match is not None  # guarded by is_resource_candidate

    tail = match.group("tail").strip()
    if tail and tail != ":":
        return True

    for next_line in iter_nonempty(lines[index + 1 :]):
        if next_line.startswith("### ") or next_line.startswith("#### ") or next_line == "---":
            return False
        return not is_resource_candidate(next_line)

    return True


def extract_section_lines(
    markdown: str,
    start_heading: str,
    end_heading: str | None,
) -> tuple[list[str], int]:
    lines = markdown.splitlines()
    start_index: int | None = None
    end_index = len(lines)

    for index, line in enumerate(lines):
        if start_index is None and line.startswith(start_heading):
            start_index = index + 1
            continue
        if start_index is not None and end_heading and line.startswith(end_heading):
            end_index = index
            break

    if start_index is None:  # pragma: no cover - defensive
        raise ValueError(f"Could not isolate section starting with {start_heading!r}.")

    return lines[start_index:end_index], start_index + 1


def parse_markdown_table_row(
    line: str,
    current_category: Category,
    current_subcategory: str | None,
    source_line: int,
) -> ParsedResourceBlock | None:
    stripped = line.strip()
    if not stripped.startswith("|"):
        return None

    divider_chars = set(stripped) - {"|", "-", ":", " "}
    if not divider_chars:
        return None

    cells = [cell.strip() for cell in stripped.strip("|").split("|")]
    if len(cells) != 4 or cells[0].lower() == "program":
        return None

    name_match = TABLE_BOLD_NAME_RE.match(cells[0])
    if not name_match:
        return None

    tail = name_match.group("tail").strip()
    name = " ".join(
        part for part in [name_match.group("name").strip(), tail] if part
    ).strip()
    if not name or name.endswith(":") or is_resource_field_label(name):
        return None

    raw_block_lines = [f"**{name}**"]
    if cells[1] and cells[1] != "—":
        raw_block_lines.append(f"- **What you get:** {cells[1]}")
    if cells[2] and cells[2] != "—":
        raw_block_lines.append(f"- **Who it's for:** {cells[2]}")
    if cells[3] and cells[3] != "—":
        raw_block_lines.append(f"- **Status:** {cells[3]}")

    return ParsedResourceBlock(
        category=current_category,
        subcategory=current_subcategory,
        raw_block="\n".join(raw_block_lines),
        source_line=source_line,
    )


def parse_markdown(source_text: str) -> list[ParsedResourceBlock]:
    lines, start_line_number = extract_section_lines(
        source_text,
        "## Section IV",
        "## Section V",
    )
    parsed: list[ParsedResourceBlock] = []
    current_category: Category | None = None
    current_subcategory: str | None = None
    i = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        section_match = SECTION_RE.match(stripped)
        if section_match:
            current_category = CATEGORY_BY_SECTION[section_match.group(1)]  # type: ignore[assignment]
            current_subcategory = None
            i += 1
            continue

        subcategory_match = SUBCATEGORY_RE.match(stripped)
        if subcategory_match:
            current_subcategory = subcategory_match.group(1).strip()
            i += 1
            continue

        if current_category:
            table_record = parse_markdown_table_row(
                line=line,
                current_category=current_category,
                current_subcategory=current_subcategory,
                source_line=start_line_number + i,
            )
            if table_record:
                parsed.append(table_record)
                i += 1
                continue

        if current_category and is_resource_start(lines, i):
            block_lines = [line.rstrip()]
            start_line = start_line_number + i
            i += 1

            while i < len(lines):
                next_line = lines[i]
                next_stripped = next_line.strip()
                if (
                    next_stripped.startswith("### ")
                    or next_stripped.startswith("#### ")
                    or next_stripped == "---"
                ):
                    break
                if is_resource_start(lines, i):
                    break
                block_lines.append(next_line.rstrip())
                i += 1

            raw_block = "\n".join(block_lines).strip()
            parsed.append(
                ParsedResourceBlock(
                    category=current_category,
                    subcategory=current_subcategory,
                    raw_block=raw_block,
                    source_line=start_line,
                )
            )
            continue

        i += 1

    return parsed


def normalize_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def extract_high_leverage_markers(source_text: str) -> list[str]:
    section_lines, _ = extract_section_lines(
        source_text,
        "## Section III",
        "## Section IV",
    )
    markers: list[str] = []
    for line in section_lines:
        stripped = line.strip()
        if not re.match(r"^\d+\.\s+", stripped):
            continue
        for bold_fragment in re.findall(r"\*\*(.+?)\*\*", stripped):
            normalized = normalize_name(bold_fragment)
            if normalized:
                markers.append(normalized)
    return dedupe_preserve_order(markers)


def prefer_longer(current: str | None, incoming: str | None) -> str | None:
    current = current or None
    incoming = incoming or None
    if not current:
        return incoming
    if not incoming:
        return current
    return incoming if len(incoming) > len(current) else current


def dedupe_preserve_order(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


def order_by_vocab(values: Iterable[str], vocab: list[str]) -> list[str]:
    wanted = dedupe_preserve_order(values)
    vocab_index = {value: idx for idx, value in enumerate(vocab)}
    return sorted(wanted, key=lambda value: (vocab_index.get(value, 9999), value))


def merge_contact(
    current: ResourceContactModel | None,
    incoming: ResourceContactModel | None,
) -> ResourceContactModel | None:
    if not current:
        return incoming
    if not incoming:
        return current
    return ResourceContactModel(
        name=prefer_longer(current.name, incoming.name),
        email=prefer_longer(current.email, incoming.email),
        phone=prefer_longer(current.phone, incoming.phone),
        role=prefer_longer(current.role, incoming.role),
    )


def merge_resources(current: ResourceModel, incoming: ResourceModel) -> ResourceModel:
    merged = current.model_copy(deep=True)

    merged.name = prefer_longer(current.name, incoming.name) or current.name
    merged.description = prefer_longer(current.description, incoming.description) or ""
    merged.what_you_get = (
        prefer_longer(current.what_you_get, incoming.what_you_get) or ""
    )
    merged.how_to_access = (
        prefer_longer(current.how_to_access, incoming.how_to_access) or ""
    )
    merged.external_url = prefer_longer(current.external_url, incoming.external_url)
    merged.contact = merge_contact(current.contact, incoming.contact)
    merged.notes = prefer_longer(current.notes, incoming.notes)
    merged.deadline = prefer_longer(current.deadline, incoming.deadline)
    merged.dollar_value_estimate = max(
        value for value in [current.dollar_value_estimate, incoming.dollar_value_estimate] if value is not None
    ) if current.dollar_value_estimate is not None or incoming.dollar_value_estimate is not None else None
    merged.affiliation = min(
        [current.affiliation, incoming.affiliation],
        key=lambda value: AFFILIATION_RANK[value],
    )
    merged.is_high_leverage_pick = (
        current.is_high_leverage_pick or incoming.is_high_leverage_pick
    )

    merged.stages = order_by_vocab(
        [*current.stages, *incoming.stages],
        STAGE_VALUES,
    )  # type: ignore[assignment]
    merged.industries = order_by_vocab(
        [*current.industries, *incoming.industries],
        INDUSTRY_VALUES,
    )  # type: ignore[assignment]
    merged.business_models = order_by_vocab(
        [*current.business_models, *incoming.business_models],
        BUSINESS_MODEL_VALUES,
    )  # type: ignore[assignment]
    merged.capital_type = order_by_vocab(
        [*current.capital_type, *incoming.capital_type],
        CAPITAL_TYPE_VALUES,
    )  # type: ignore[assignment]
    merged.bottleneck_tags = order_by_vocab(
        [*current.bottleneck_tags, *incoming.bottleneck_tags],
        BOTTLENECK_VALUES,
    )  # type: ignore[assignment]
    merged.source_coverage = dedupe_preserve_order(
        [*current.source_coverage, *incoming.source_coverage]
    )
    merged.verification_flags = dedupe_preserve_order(
        [*current.verification_flags, *incoming.verification_flags]
    )

    merged.eligibility = ResourceEligibilityModel(
        undergrad_eligible=(
            current.eligibility.undergrad_eligible
            or incoming.eligibility.undergrad_eligible
        ),
        masters_eligible=(
            current.eligibility.masters_eligible
            or incoming.eligibility.masters_eligible
        ),
        phd_eligible=current.eligibility.phd_eligible
        or incoming.eligibility.phd_eligible,
        faculty_staff_eligible=(
            current.eligibility.faculty_staff_eligible
            or incoming.eligibility.faculty_staff_eligible
        ),
        recent_grad_eligible=(
            current.eligibility.recent_grad_eligible
            or incoming.eligibility.recent_grad_eligible
        ),
        stem_required=(
            current.eligibility.stem_required or incoming.eligibility.stem_required
        ),
        college_restrictions=dedupe_preserve_order(
            [
                *current.eligibility.college_restrictions,
                *incoming.eligibility.college_restrictions,
            ]
        ),
        us_citizenship_required=(
            current.eligibility.us_citizenship_required
            or incoming.eligibility.us_citizenship_required
        ),
        team_required=(
            current.eligibility.team_required or incoming.eligibility.team_required
        ),
        solo_founder_eligible=(
            current.eligibility.solo_founder_eligible
            and incoming.eligibility.solo_founder_eligible
        ),
    )

    merged.id = slugify(merged.name)
    merged.last_reviewed = TODAY
    return merged


def extract_source_coverage(raw_block: str) -> list[str]:
    return dedupe_preserve_order(SOURCE_COVERAGE_RE.findall(raw_block))


def extract_verification_flags(raw_block: str) -> list[str]:
    flags = list(BRACKETED_FLAG_RE.findall(raw_block))
    if "⚠️" in raw_block:
        flags.append("⚠️")
    return dedupe_preserve_order(flags)


def enrich_industries(
    category: Category,
    subcategory: str | None,
    industries: list[Industry],
) -> list[Industry]:
    inferred = INDUSTRY_BY_SUBCATEGORY.get((category, subcategory or ""))
    if not inferred:
        return industries
    if not industries or industries == ["generalist"]:
        return inferred  # type: ignore[return-value]
    return order_by_vocab([*industries, *inferred], INDUSTRY_VALUES)  # type: ignore[return-value]


def is_high_leverage_name(name: str, markers: list[str]) -> bool:
    normalized = normalize_name(name)
    if not normalized:
        return False
    return any(
        normalized == marker or normalized in marker or marker in normalized
        for marker in markers
    )


def build_prompt(
    prompt_template: str,
    record: ParsedResourceBlock,
) -> str:
    return prompt_template.format(
        category=record.category,
        subcategory=record.subcategory or "",
        resource_block=record.raw_block,
    )


def extract_tool_payload(response: Any) -> dict[str, Any]:
    for block in response.content:
        if getattr(block, "type", None) == "tool_use":
            payload = getattr(block, "input", None)
            if isinstance(payload, dict):
                return payload

    text_parts = [
        getattr(block, "text", "")
        for block in response.content
        if getattr(block, "type", None) == "text"
    ]
    raw_text = "".join(text_parts).strip()
    if raw_text:
        return json.loads(raw_text)

    raise ValueError("Claude did not return tool output or parseable JSON.")


async def extract_resource(
    client: Any,
    semaphore: asyncio.Semaphore,
    prompt_template: str,
    record: ParsedResourceBlock,
    model_name: str,
    high_leverage_markers: list[str],
    rate_limiter: "RateLimiter | None" = None,
) -> ResourceModel:
    prompt = build_prompt(prompt_template, record)

    async with semaphore:
        if rate_limiter is not None:
            await rate_limiter.wait()
        attempt = 0
        while True:
            try:
                response = await client.messages.create(
                    model=model_name,
                    max_tokens=2200,
                    tools=[
                        {
                            "name": "record_resource",
                            "description": "Return the extracted resource fields as structured JSON.",
                            "input_schema": RESOURCE_TOOL_SCHEMA,
                        }
                    ],
                    tool_choice={"type": "tool", "name": "record_resource"},
                    messages=[{"role": "user", "content": prompt}],
                )
                break
            except Exception as exc:  # noqa: BLE001
                is_rate_limit = type(exc).__name__ == "RateLimitError" or "429" in str(exc)
                if is_rate_limit and attempt < 6:
                    delay = min(60, 5 * (2 ** attempt))
                    attempt += 1
                    await asyncio.sleep(delay)
                    continue
                raise

    extracted = ExtractedResourceModel.model_validate(extract_tool_payload(response))
    return ResourceModel(
        id=slugify(extracted.name),
        name=extracted.name,
        category=record.category,
        subcategory=record.subcategory,
        description=extracted.description,
        stages=extracted.stages,
        industries=enrich_industries(
            record.category,
            record.subcategory,
            extracted.industries,
        ),
        affiliation=extracted.affiliation,
        resource_type=extracted.resource_type,
        business_models=extracted.business_models,
        capital_type=extracted.capital_type,
        eligibility=extracted.eligibility,
        what_you_get=extracted.what_you_get,
        how_to_access=extracted.how_to_access,
        external_url=extracted.external_url,
        contact=extracted.contact,
        dollar_value_estimate=extracted.dollar_value_estimate,
        deadline=extracted.deadline,
        is_high_leverage_pick=is_high_leverage_name(
            extracted.name,
            high_leverage_markers,
        ),
        bottleneck_tags=extracted.bottleneck_tags,
        notes=extracted.notes,
        source_coverage=extract_source_coverage(record.raw_block),
        verification_flags=extract_verification_flags(record.raw_block),
        last_reviewed=TODAY,
    )


class RateLimiter:
    """Enforce a minimum interval between request starts."""

    def __init__(self, min_interval: float) -> None:
        self.min_interval = min_interval
        self._next_allowed = 0.0
        self._lock = asyncio.Lock()

    async def wait(self) -> None:
        if self.min_interval <= 0:
            return
        async with self._lock:
            loop = asyncio.get_running_loop()
            now = loop.time()
            if now < self._next_allowed:
                await asyncio.sleep(self._next_allowed - now)
                now = loop.time()
            self._next_allowed = now + self.min_interval


async def run_extraction(
    records: list[ParsedResourceBlock],
    prompt_template: str,
    model_name: str,
    concurrency: int,
    high_leverage_markers: list[str],
    min_interval: float = 0.0,
) -> list[ResourceModel]:
    if AsyncAnthropic is None:
        raise RuntimeError(
            "The Anthropic Python SDK is not installed. Run `pip install -r scripts/requirements.txt` first."
        )

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Add it to your environment before running ingestion."
        )

    client = AsyncAnthropic(api_key=api_key)
    semaphore = asyncio.Semaphore(concurrency)
    rate_limiter = RateLimiter(min_interval)
    tasks = [
        asyncio.create_task(
            extract_resource(
                client,
                semaphore,
                prompt_template,
                record,
                model_name,
                high_leverage_markers,
                rate_limiter,
            )
        )
        for record in records
    ]

    extracted: list[ResourceModel] = []
    failures = 0
    for task in tqdm(asyncio.as_completed(tasks), total=len(tasks), desc="Extracting"):
        try:
            extracted.append(await task)
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(f"\n[skip] extraction failed: {type(exc).__name__}: {exc}", file=sys.stderr)

    if failures:
        print(f"\nSkipped {failures} resources due to extraction errors.", file=sys.stderr)

    return extracted


def dedupe_resources(resources: list[ResourceModel]) -> list[ResourceModel]:
    merged: dict[str, ResourceModel] = {}

    for resource in resources:
        key = normalize_name(resource.name)
        if key not in merged:
            merged[key] = resource
            continue
        merged[key] = merge_resources(merged[key], resource)

    deduped = list(merged.values())
    deduped.sort(key=lambda resource: (CATEGORY_VALUES.index(resource.category), resource.name.lower()))
    return deduped


def finalize_resources(
    resources: list[ResourceModel],
    high_leverage_markers: list[str],
) -> list[ResourceModel]:
    finalized = [resource.model_copy(deep=True) for resource in resources]
    for resource in finalized:
        resource.is_high_leverage_pick = is_high_leverage_name(
            resource.name,
            high_leverage_markers,
        )
    return finalized


def write_resources(resources: list[ResourceModel], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = [resource.model_dump(mode="json") for resource in resources]
    output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def print_summary(resources: list[ResourceModel]) -> None:
    counts = Counter(resource.category for resource in resources)
    flagged = [resource for resource in resources if resource.verification_flags]

    print(f"Wrote {len(resources)} resources.")
    print("Counts by category:")
    for category in CATEGORY_VALUES:
        print(f"  {category}: {counts.get(category, 0)}")

    if flagged:
        print(f"Resources with verification flags: {len(flagged)}")


def maybe_print_review_sample(
    resources: list[ResourceModel],
    review_size: int,
    seed: int,
) -> None:
    if review_size <= 0 or not resources:
        return

    rng = random.Random(seed)
    sample = rng.sample(resources, min(review_size, len(resources)))
    print("\nManual review sample:")
    for resource in sample:
        print(f"  - {resource.id}: {resource.name}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="claude-sonnet-4-6")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--prompt", type=Path, default=DEFAULT_PROMPT_PATH)
    parser.add_argument("--concurrency", type=int, default=10)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--min-interval", type=float, default=0.0,
                        help="Minimum seconds between request starts (rate limiting)")
    parser.add_argument("--review-sample-size", type=int, default=30)
    parser.add_argument("--review-seed", type=int, default=42)
    return parser.parse_args()


async def async_main() -> int:
    args = parse_args()

    if not args.source.exists():
        raise FileNotFoundError(
            f"Missing source markdown: {args.source}. Please add it before running ingestion."
        )

    source_text = args.source.read_text(encoding="utf-8")
    prompt_template = args.prompt.read_text(encoding="utf-8")
    parsed = parse_markdown(source_text)
    high_leverage_markers = extract_high_leverage_markers(source_text)

    if not parsed:
        raise RuntimeError("Parser found no resources in Section IV.")

    if args.limit > 0:
        parsed = parsed[: args.limit]

    print(f"Parsed {len(parsed)} resource blocks from markdown.")

    extracted = await run_extraction(
        records=parsed,
        prompt_template=prompt_template,
        model_name=args.model,
        concurrency=args.concurrency,
        high_leverage_markers=high_leverage_markers,
        min_interval=args.min_interval,
    )
    deduped = finalize_resources(
        dedupe_resources(extracted),
        high_leverage_markers,
    )
    write_resources(deduped, args.output)
    print_summary(deduped)
    maybe_print_review_sample(deduped, args.review_sample_size, args.review_seed)
    return 0


def main() -> int:
    try:
        return asyncio.run(async_main())
    except (FileNotFoundError, RuntimeError, ValidationError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
