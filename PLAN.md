# Transcend UW Founder Matcher — Build Specification

**Project:** Personalized resource-recommendation tool for UW–Madison student founders
**Owner:** Transcend UW
**Approach:** JSON + tag filtering + LLM personalization (no knowledge graph, no vector DB)
**Target:** Shippable MVP in ~3 focused build sessions
**Last updated:** April 2026

---

## 1. Project Overview

### The problem

Transcend UW maintains a comprehensive founder resource guide (`TranscendUW_FounderResourceGuide_2026.md`, ~1,900 lines, ~300+ resources). It's too long for students to read. Most students never find the 5–10 resources most relevant to their specific situation.

### The goal

Build a web app where a UW student logs in with their `@wisc.edu` email, takes a ~5 minute survey, and receives a personalized, tiered list of 15–25 resources tailored to their startup stage, industry, funding preference, and current bottleneck — with one sentence per resource explaining why it matches them.

### Success criteria

- Survey completion rate > 80% (students don't bail mid-way)
- Median time to personalized output < 30 seconds after survey submit
- Students rate the recommendations as "useful" or better in > 75% of sessions
- Less than 10% of recommendations are "already doing this" or "not relevant"
- The club can update the underlying resource guide and regenerate the data layer in under 15 minutes

### Non-goals (for v1)

- No knowledge graph, no Neo4j, no graph queries
- No vector embeddings or semantic search — pure tag filtering
- No agentic multi-tool LLM orchestration — one LLM call per recommendation
- No real-time resource updates — the `resources.json` file is refreshed manually
- No NetID SSO — email magic link with `@wisc.edu` gate is sufficient for v1

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BUILD TIME                              │
│                                                                 │
│   TranscendUW_FounderResourceGuide_2026.md                      │
│                      │                                          │
│                      ▼                                          │
│            [ingestion pipeline]                                 │
│            parse + LLM extract                                  │
│                      │                                          │
│                      ▼                                          │
│                resources.json   ◄── committed to repo           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         RUNTIME                                 │
│                                                                 │
│   Student ──► login (@wisc.edu)                                 │
│              │                                                  │
│              ▼                                                  │
│          survey (~10 questions) ──► StudentProfile              │
│                                         │                       │
│                                         ▼                       │
│                              [matching pipeline]                │
│                              1. hard filter                     │
│                              2. deterministic scoring           │
│                              3. top 20–25 candidates            │
│                                         │                       │
│                                         ▼                       │
│                              [LLM personalization]              │
│                              one call, produces tiered output   │
│                                         │                       │
│                                         ▼                       │
│                         PersonalizedGuide (rendered as page)    │
│                         + saved to DB for return visits         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Layer              | Choice                         | Why                                               |
| ------------------ | ------------------------------ | ------------------------------------------------- |
| Frontend framework | Next.js 14+ (App Router)       | Mature, Vercel-native, React ecosystem            |
| Styling            | Tailwind CSS                   | Fast, utility-first, works with shadcn/ui         |
| UI components      | shadcn/ui                      | Clean, copy-paste, good defaults                  |
| Auth               | Clerk (or Supabase Auth)       | Email magic link, `@wisc.edu` domain gate         |
| Database           | Supabase Postgres              | Free tier, hosted, good DX                        |
| LLM                | Anthropic Claude (Sonnet)      | Strong at structured extraction and writing       |
| Ingestion pipeline | Python 3.11+                   | Standard for data prep                            |
| Hosting            | Vercel (frontend + API routes) | Free tier sufficient                              |
| Resource data      | `resources.json` in `/data/`   | Simple, version-controlled, no DB needed for this |

**Why not a DB for resources?** ~300 resources at ~2KB each = ~600KB JSON. Loads in <50ms. Version-controlled. Reviewable in PRs. No migration pain when the schema changes.

---

## 4. Repository Structure

```
transcend-founder-matcher/
├── README.md
├── package.json
├── next.config.js
├── tailwind.config.ts
├── .env.local                         # never commit
├── .env.example                       # commit as template
│
├── data/
│   ├── source/
│   │   └── TranscendUW_FounderResourceGuide_2026.md
│   └── resources.json                 # generated output, committed
│
├── scripts/
│   ├── ingest.py                      # markdown → resources.json
│   ├── prompts/
│   │   └── extraction_prompt.txt      # LLM extraction prompt
│   ├── validate.py                    # sanity-check resources.json
│   └── requirements.txt
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # landing
│   │   ├── login/page.tsx
│   │   ├── survey/page.tsx
│   │   ├── results/page.tsx
│   │   ├── profile/page.tsx           # view/edit profile, re-run
│   │   └── api/
│   │       ├── survey/submit/route.ts
│   │       ├── recommendations/generate/route.ts
│   │       └── feedback/route.ts
│   │
│   ├── components/
│   │   ├── SurveyForm.tsx
│   │   ├── ResourceCard.tsx
│   │   ├── TieredGuide.tsx
│   │   └── ui/                        # shadcn components
│   │
│   ├── lib/
│   │   ├── matching/
│   │   │   ├── filter.ts              # hard filter stage
│   │   │   ├── score.ts               # deterministic scoring
│   │   │   └── types.ts               # shared types
│   │   ├── llm/
│   │   │   ├── client.ts              # Anthropic client
│   │   │   └── personalize.ts         # the one LLM call
│   │   ├── db/
│   │   │   ├── client.ts              # Supabase client
│   │   │   └── schema.sql             # migrations
│   │   └── resources.ts               # loads resources.json
│   │
│   └── types/
│       ├── profile.ts
│       ├── resource.ts
│       └── recommendation.ts
│
└── tests/
    ├── fixtures/
    │   └── test_profiles.json         # 5 canonical test profiles
    ├── matching.test.ts
    └── eval.py                        # run full pipeline on test profiles
```

---

## 5. Phase 1 — Data Ingestion Pipeline

**Goal:** Convert `TranscendUW_FounderResourceGuide_2026.md` into a strictly-typed `resources.json` with every resource tagged along every filterable dimension.

### 5.1 Input assumptions

The source markdown has consistent structure:

- `##` headers are top-level sections (Section I, II, III, IV, V...)
- `###` headers under Section IV are categories (IV.1 through IV.13)
- `####` headers are sub-groupings (e.g., "UW-Affiliated Funding" vs. "Externally Accessible")
- Each resource starts with a **bolded name** followed by bullet points: "What it is", "Who it's for", "What you get", "How to access", etc.

### 5.2 Ingestion steps

1. **Parse the markdown.** Split on `####` and bolded resource names. Extract the raw text block for each resource. Attach its category (from the `###` above it) and sub-grouping (from the `####` above it).

2. **For each raw resource block, call Claude with a structured-extraction prompt** (see §5.4). Force JSON output using a schema.

3. **Deduplicate.** Same program may appear in multiple sections (e.g., NSF I-Corps might be mentioned in Accelerators and in Non-Dilutive Funding). Fuzzy-match on name after normalization (lowercase, strip punctuation). Merge duplicates by taking the union of tags and preferring longer descriptions.

4. **Validate.** Run `scripts/validate.py`:
   - Every resource has a non-empty name
   - Every resource has at least one stage tag
   - Every resource has an affiliation
   - URLs are syntactically valid
   - No duplicate IDs
   - Report any flagged resources for manual review

5. **Write `data/resources.json`.**

### 5.3 Resource JSON schema

```typescript
type Resource = {
  id: string; // slugified name, e.g. "warf-innovation-awards"
  name: string; // "WARF Innovation Awards"
  category: Category; // one of the 13 top-level categories
  subcategory?: string; // "UW-Affiliated" | "Externally Accessible" | etc.
  description: string; // 1–3 sentences, from "What it is"

  // --- tags (primary matching signals) ---
  stages: Stage[]; // which stages this fits
  industries: Industry[]; // empty array means "any industry"
  affiliation: Affiliation; // UW | Wisconsin | National | Global
  resource_type: ResourceType; // Funding | Competition | Accelerator | etc.
  business_models: BusinessModel[]; // SaaS | Consumer | Hardware | etc. (or empty = any)
  capital_type: CapitalType[]; // Dilutive | NonDilutive | Credits | NA

  // --- eligibility flags ---
  eligibility: {
    undergrad_eligible: boolean;
    masters_eligible: boolean;
    phd_eligible: boolean;
    faculty_staff_eligible: boolean;
    recent_grad_eligible: boolean;
    stem_required: boolean;
    college_restrictions: string[]; // ["Engineering", "Business"] or []
    us_citizenship_required: boolean;
    team_required: boolean;
    solo_founder_eligible: boolean;
  };

  // --- content ---
  what_you_get: string; // from "What you get" bullet
  how_to_access: string; // url, email, or instructions
  external_url?: string; // if available
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
  };

  // --- metadata ---
  dollar_value_estimate?: number; // rough $ value if applicable (e.g., 50000)
  deadline?: string; // "rolling" | ISO date | "Feb 15 annually" | null
  is_high_leverage_pick: boolean; // in the Top 25
  bottleneck_tags: Bottleneck[]; // which bottlenecks this addresses
  notes?: string; // caveats, verification flags

  // --- provenance ---
  source_coverage: string[]; // ["S1", "S2", "S3"]
  verification_flags: string[]; // ["deadline_drift_risk", "status_uncertain"]
  last_reviewed: string; // ISO date
};
```

### 5.4 Controlled vocabularies

Store these as TypeScript enums in `src/types/resource.ts` and as Python constants in `scripts/ingest.py`. **Any value outside these vocabularies is a bug.**

```typescript
type Stage =
  | "idea"
  | "customer_discovery"
  | "building_mvp"
  | "pre_revenue"
  | "early_revenue"
  | "scaling"
  | "fundraising_seed"
  | "fundraising_series_a";

type Industry =
  | "ai_ml"
  | "climate_cleantech"
  | "biotech_health"
  | "consumer_d2c"
  | "fintech"
  | "hardware_deep_tech"
  | "crypto_web3"
  | "gaming"
  | "social_impact"
  | "enterprise_saas"
  | "edtech"
  | "generalist";

type Affiliation = "uw_madison" | "wisconsin_state" | "national" | "global";

type ResourceType =
  | "funding_equity"
  | "funding_grant"
  | "funding_loan"
  | "pitch_competition"
  | "accelerator"
  | "incubator"
  | "fellowship"
  | "software_credit"
  | "legal_service"
  | "mentorship"
  | "community"
  | "education_course"
  | "education_book"
  | "physical_space"
  | "talent_platform"
  | "event_recurring"
  | "media_newsletter";

type BusinessModel =
  | "saas"
  | "consumer_d2c"
  | "marketplace"
  | "hardware"
  | "biotech_therapeutics"
  | "medical_device"
  | "deep_tech_research"
  | "services"
  | "content_media"
  | "agnostic";

type CapitalType =
  | "dilutive"
  | "non_dilutive"
  | "credits"
  | "in_kind"
  | "not_applicable";

type Bottleneck =
  | "funding"
  | "customers"
  | "team"
  | "legal"
  | "product_technical"
  | "mentorship"
  | "ip_patents"
  | "space_facilities"
  | "awareness";

type Category =
  | "uw_institutional_hub"
  | "funding_fellowships"
  | "pitch_competitions"
  | "accelerators_incubators"
  | "software_credits"
  | "legal_services"
  | "mentorship_communities"
  | "non_dilutive_funding"
  | "physical_spaces"
  | "talent_hiring"
  | "education"
  | "events"
  | "industry_specific";
```

### 5.5 Extraction prompt template

Save as `scripts/prompts/extraction_prompt.txt`:

```
You are extracting structured data about a startup resource for UW–Madison student founders.

Given the raw markdown block below, return a JSON object matching the Resource schema exactly. Use ONLY values from the controlled vocabularies. If a field is not determinable from the block, use null or an empty array — never invent information.

CONTROLLED VOCABULARIES:
- stages: idea | customer_discovery | building_mvp | pre_revenue | early_revenue | scaling | fundraising_seed | fundraising_series_a
- industries: ai_ml | climate_cleantech | biotech_health | consumer_d2c | fintech | hardware_deep_tech | crypto_web3 | gaming | social_impact | enterprise_saas | edtech | generalist
- affiliation: uw_madison | wisconsin_state | national | global
- resource_type: funding_equity | funding_grant | funding_loan | pitch_competition | accelerator | incubator | fellowship | software_credit | legal_service | mentorship | community | education_course | education_book | physical_space | talent_platform | event_recurring | media_newsletter
- business_models: saas | consumer_d2c | marketplace | hardware | biotech_therapeutics | medical_device | deep_tech_research | services | content_media | agnostic
- capital_type: dilutive | non_dilutive | credits | in_kind | not_applicable
- bottleneck_tags: funding | customers | team | legal | product_technical | mentorship | ip_patents | space_facilities | awareness

CATEGORY (already determined by section): {category}
SUBCATEGORY (already determined): {subcategory}

INSTRUCTIONS:
- If a resource says "any UW student" → all of {undergrad, masters, phd} are eligible.
- If industries not specified → use ["generalist"].
- Infer stages from phrases like "idea stage", "MVP", "Series A prep". If ambiguous, tag multiple stages.
- For dollar_value_estimate, use the total available to one winner/applicant, not the program pool. Use null if not applicable (e.g., a community).
- If the resource has verification flags (⚠️, [VERIFY], [CHECK: status uncertain]), list them in verification_flags.
- For bottleneck_tags, pick the 1–3 that this resource primarily helps with.

RESOURCE BLOCK:
---
{resource_block}
---

Return only valid JSON matching the Resource schema. No prose, no markdown fences.
```

### 5.6 Ingestion script outline

`scripts/ingest.py` should:

1. Read `data/source/TranscendUW_FounderResourceGuide_2026.md`
2. Walk the markdown tree, yielding `(category, subcategory, raw_block)` tuples for each resource
3. For each tuple, call Claude with the extraction prompt (use the Anthropic Python SDK, `claude-sonnet-4-6` or newer)
4. Parse the JSON response, validate against schema (use `pydantic`)
5. Dedupe by normalized name
6. Write `data/resources.json` (pretty-printed, stable key order)
7. Print summary: total resources, count by category, any validation warnings

Use `asyncio` + `anthropic.AsyncAnthropic` for concurrent extraction (rate-limit to ~10 concurrent requests). Full run should take 2–5 minutes and cost $5–15 in API credits.

### 5.7 Manual review step (IMPORTANT)

After first run, **hand-review a random sample of 30 extracted resources** alongside their source blocks. Look for:

- Wrong stage tags (common failure mode: too many or too few stages)
- Missed industry tags (common failure mode: everything tagged "generalist")
- Incorrect eligibility flags
- Missed dollar values

Tune the extraction prompt until hand-review passes >90% accuracy. Re-run.

---

## 6. Phase 2 — Survey Design

### 6.1 Student profile schema

```typescript
type StudentProfile = {
  // identity
  user_id: string; // from auth
  email: string; // @wisc.edu
  created_at: string;
  updated_at: string;

  // academic context
  uw_status: "undergrad" | "masters" | "phd" | "recent_grad" | "faculty_staff";
  college:
    | "engineering"
    | "business"
    | "letters_science"
    | "cdis"
    | "agriculture"
    | "other";
  graduation_year?: number;

  // startup context
  stage: Stage; // single-select, REQUIRED
  industries: Industry[]; // max 2
  business_model: BusinessModel;
  capital_preference:
    | "want_vc"
    | "prefer_non_dilutive"
    | "bootstrapping"
    | "open_to_both";

  // team
  team_status: "solo" | "has_cofounder" | "looking_for_cofounder";
  technical_status:
    | "technical_founder"
    | "non_technical_seeking_cto"
    | "hybrid_team";
  time_commitment: "full_time" | "part_time" | "exploring";

  // current needs
  primary_bottleneck: Bottleneck; // single-select, REQUIRED
  secondary_bottlenecks: Bottleneck[]; // up to 2

  // engagement history
  already_engaged_with: string[]; // array of Resource IDs

  // optional
  additional_context?: string; // free text, max 500 chars
};
```

### 6.2 Survey questions (in order)

Target: 10 questions, ~5 minutes. Use progressive disclosure — show one question per screen on mobile, grouped on desktop.

**Q1. What stage is your startup?** (single-select, required)

- Just an idea, no real product yet
- Talking to potential customers, validating the problem
- Actively building an MVP
- Have a product, no revenue yet
- Earning revenue
- Raising a seed round
- Raising Series A

**Q2. What industry or space are you building in?** (multi-select, max 2, required)

- AI / ML
- Climate / CleanTech
- Biotech / Healthcare
- Consumer / D2C
- Fintech
- Hardware / Deep Tech
- Crypto / Web3
- Gaming
- Social Impact
- Enterprise SaaS
- EdTech
- Not sure yet / exploring

**Q3. What's your business model?** (single-select)

- SaaS / subscription software
- Consumer product (D2C, app, marketplace)
- Hardware / physical product
- Biotech therapeutic or medical device
- Deep tech / research commercialization
- Services
- Still figuring it out

**Q4. Your status at UW?** (single-select)

- Undergrad
- Master's
- PhD
- Recent grad (< 2 years)
- Faculty / staff

**Q5. Primary college?** (single-select — gates college-specific programs)

- Engineering
- Business (WSB)
- Letters & Science
- Computer, Data & Information Sciences (CDIS)
- Agricultural & Life Sciences (CALS)
- Other

**Q6. Team situation?** (single-select)

- Solo founder
- Have one or more co-founders
- Actively looking for a co-founder

**Q7. Technical background?** (single-select)

- I can build the product myself
- I'm non-technical and need a technical co-founder
- Mixed / hybrid team

**Q8. On funding, what's your preference?** (single-select)

- I want to raise VC
- I prefer non-dilutive (grants, fellowships, revenue)
- I'm bootstrapping
- Open to whatever fits

**Q9. Biggest bottleneck right now?** (single-select, required)

- Funding / capital
- Finding customers / distribution
- Team / hiring
- Legal / incorporation / IP
- Building the product itself
- Mentorship / advice
- Physical space / lab access
- Getting noticed / awareness

**Q10. Already engaged with any of these?** (multi-select, optional)

- [Show 10 most commonly-recommended UW resources from `resources.json` where `is_high_leverage_pick === true && affiliation === "uw_madison"`]
- "None of these yet"

**Q11 (optional). Anything else we should know?** (free text, 500 char limit)

- e.g., "I have IP from a research lab", "I'm an international student", "I need summer-only programs"

### 6.3 Survey UX notes

- Save progress to `localStorage` on every answer — if a student closes the tab, they resume where they left off.
- Show a progress bar.
- All questions skippable except Q1 (stage), Q2 (industry), Q9 (bottleneck) — these are the three highest-signal filters.
- After submit, show a "Generating your personalized guide..." loading state with progress messages (the LLM call takes 10–20 seconds).
- On completion, redirect to `/results`.

---

## 7. Phase 3 — Matching Pipeline

### 7.1 Pipeline overview

```
StudentProfile
    │
    ▼
[Stage 1: Hard Filter]  ──► 40–80 candidates
    │
    ▼
[Stage 2: Score]  ──► top 20–25 by score
    │
    ▼
[Stage 3: LLM Personalize]  ──► tiered guide with explanations
    │
    ▼
PersonalizedGuide
```

### 7.2 Stage 1 — Hard filter

`src/lib/matching/filter.ts`

Remove resources that are definitively wrong for this student. Rules:

1. **Stage filter.** Drop resources where `resource.stages` doesn't include the student's stage, UNLESS the resource has stages `["idea", "customer_discovery", "building_mvp", "pre_revenue", "early_revenue", "scaling", "fundraising_seed", "fundraising_series_a"]` (i.e., stage-agnostic).

2. **Industry filter.** Keep resources where `resource.industries` is empty, contains `"generalist"`, or intersects with `profile.industries`.

3. **Eligibility filter.**
   - If `profile.uw_status === "undergrad"` and resource requires grad/PhD → drop
   - If `profile.uw_status === "faculty_staff"` and resource is strictly for students → drop
   - If `resource.eligibility.stem_required` and profile college is not STEM-aligned → drop
   - If `resource.eligibility.college_restrictions.length > 0` and profile's college is not in that list → drop
   - If `resource.eligibility.solo_founder_eligible === false` and `profile.team_status === "solo"` → drop

4. **Capital preference filter.**
   - If `profile.capital_preference === "prefer_non_dilutive"` and `resource.capital_type === ["dilutive"]` (only) → drop UNLESS resource is `pitch_competition` (students often want to compete even if bootstrapping)
   - If `profile.capital_preference === "bootstrapping"` and resource is explicitly VC-pitch-focused → drop

5. **Already-engaged filter.** Drop any resource whose ID is in `profile.already_engaged_with`.

6. **Affiliation sanity.** Never drop on affiliation — UW students can use national resources.

Output: a filtered array of Resources.

### 7.3 Stage 2 — Scoring

`src/lib/matching/score.ts`

Assign each remaining resource a score in roughly [0, 100]. Sort descending. Take top 25.

```typescript
function scoreResource(resource: Resource, profile: StudentProfile): number {
  let score = 0;

  // Stage match (max 25)
  if (resource.stages.includes(profile.stage)) {
    score += 25;
  } else if (stagesAdjacent(resource.stages, profile.stage)) {
    score += 10; // one stage off
  }

  // Industry match (max 20)
  const industryOverlap = resource.industries.filter((i) =>
    profile.industries.includes(i),
  );
  if (industryOverlap.length > 0) {
    score += 20;
  } else if (
    resource.industries.includes("generalist") ||
    resource.industries.length === 0
  ) {
    score += 10;
  }

  // Bottleneck match (max 20)
  if (resource.bottleneck_tags.includes(profile.primary_bottleneck)) {
    score += 20;
  } else if (
    resource.bottleneck_tags.some((t) =>
      profile.secondary_bottlenecks.includes(t),
    )
  ) {
    score += 8;
  }

  // UW affiliation bonus (max 10)
  if (resource.affiliation === "uw_madison") score += 10;
  else if (resource.affiliation === "wisconsin_state") score += 5;

  // High-leverage pick bonus (max 10)
  if (resource.is_high_leverage_pick) score += 10;

  // Capital type alignment (max 10)
  if (
    profile.capital_preference === "want_vc" &&
    resource.capital_type.includes("dilutive")
  )
    score += 10;
  if (
    profile.capital_preference === "prefer_non_dilutive" &&
    resource.capital_type.includes("non_dilutive")
  )
    score += 10;
  if (
    profile.capital_preference === "bootstrapping" &&
    resource.capital_type.includes("credits")
  )
    score += 10;

  // Business model match (max 5)
  if (
    resource.business_models.includes(profile.business_model) ||
    resource.business_models.includes("agnostic") ||
    resource.business_models.length === 0
  ) {
    score += 5;
  }

  return score;
}
```

Helper `stagesAdjacent`: considers `building_mvp` adjacent to `customer_discovery` and `pre_revenue`; `pre_revenue` adjacent to `building_mvp` and `early_revenue`; etc.

**Return:** top 25 resources sorted by score descending.

### 7.4 Category balance guardrail

Before finalizing the top 25, ensure no single category dominates. Rule: no category contributes more than 6 resources to the top 25. If a category has more, keep the top 6 by score and promote lower-scored resources from other categories to fill.

This prevents results where a biotech PhD gets 20 biotech funding sources and nothing else.

---

## 8. Phase 4 — LLM Personalization

### 8.1 The one LLM call

`src/lib/llm/personalize.ts`

Input: `StudentProfile` + top 25 scored resources.
Output: a `PersonalizedGuide` with three tiers and one-sentence explanations per resource.

### 8.2 Personalization prompt

```
You are writing a personalized startup resource guide for a UW–Madison student founder.

Their profile:
- Stage: {stage}
- Industries: {industries}
- Business model: {business_model}
- UW status: {uw_status}, {college}
- Team: {team_status}, {technical_status}
- Capital preference: {capital_preference}
- Primary bottleneck: {primary_bottleneck}
- Secondary bottlenecks: {secondary_bottlenecks}
- Additional context: {additional_context}

Below are 25 candidate resources, pre-filtered and ranked for this student. Organize them into three tiers:

1. **Start this week** (3–5 resources) — highest-impact, actionable in the next 7 days, directly addresses their primary bottleneck.
2. **Explore this month** (6–10 resources) — valuable but need more setup or aren't immediately urgent.
3. **Bookmark for later** (remaining) — worth knowing about, relevant at a future stage or situation.

For each resource, write ONE sentence (max 25 words) explaining why it matches THIS specific student. Reference their stage, industry, bottleneck, or context explicitly. Do not write generic descriptions.

Guidelines:
- If a resource doesn't fit well, move it to "Bookmark for later" rather than forcing it into a higher tier.
- If the student's primary bottleneck is "funding" and a resource is a non-funding resource, it can still be top-tier if it addresses funding indirectly (e.g., I-Corps for SBIR credential). Explain the connection.
- Don't mention the tier name in the one-sentence reason.
- Be specific. Say "Because you're at the MVP stage in biotech, Badger Tech Foundry's lab-to-market pathway fits" rather than "This is a great program for founders."

CANDIDATE RESOURCES (as JSON):
{top_25_resources_json}

Return JSON matching this schema:
{
  "tier_1_start_this_week": [{"resource_id": "...", "reason": "..."}, ...],
  "tier_2_explore_this_month": [...],
  "tier_3_bookmark_for_later": [...],
  "opening_note": "2–3 sentence personalized intro summarizing their situation and pointing to the most critical 1–2 items."
}
```

### 8.3 LLM call implementation notes

- Use `claude-sonnet-4-6` (or latest) via the Anthropic API.
- Use structured output / tool use to force JSON adherence.
- Max tokens: ~2500 (the response is mostly short reasons).
- Cache by profile hash — if a student hasn't changed their profile, serve the cached guide on revisit.
- Time budget: < 20s end-to-end.

### 8.4 Output schema

```typescript
type PersonalizedGuide = {
  profile_snapshot: StudentProfile; // what we matched on
  generated_at: string;
  opening_note: string;
  tier_1_start_this_week: TierEntry[];
  tier_2_explore_this_month: TierEntry[];
  tier_3_bookmark_for_later: TierEntry[];
};

type TierEntry = {
  resource_id: string;
  resource: Resource; // hydrated at render time
  reason: string; // the one-sentence personalization
  score: number; // from Stage 2, for analytics
};
```

---

## 9. Phase 5 — Web App

### 9.1 Routes

| Path       | Purpose                                           |
| ---------- | ------------------------------------------------- |
| `/`        | Marketing landing, explanation, "Get Started" CTA |
| `/login`   | Magic link signup/login, gated to `@wisc.edu`     |
| `/survey`  | Survey form (~10 questions), progressive          |
| `/results` | Rendered PersonalizedGuide                        |
| `/profile` | View/edit profile, regenerate guide, export       |

### 9.2 API routes

| Path                            | Method | Purpose                                                    |
| ------------------------------- | ------ | ---------------------------------------------------------- |
| `/api/survey/submit`            | POST   | Saves StudentProfile, triggers matching+LLM, returns guide |
| `/api/recommendations/generate` | POST   | Regenerates guide for an existing profile                  |
| `/api/feedback`                 | POST   | Thumbs up/down on individual recommendations               |

### 9.3 Database schema (Supabase Postgres)

`src/lib/db/schema.sql`:

```sql
-- users handled by Clerk or Supabase Auth; we just reference user_id

create table profiles (
  user_id text primary key,
  email text not null,
  uw_status text not null,
  college text not null,
  graduation_year int,
  stage text not null,
  industries text[] not null,
  business_model text not null,
  capital_preference text not null,
  team_status text not null,
  technical_status text not null,
  time_commitment text not null,
  primary_bottleneck text not null,
  secondary_bottlenecks text[] not null default '{}',
  already_engaged_with text[] not null default '{}',
  additional_context text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table guides (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles(user_id) on delete cascade,
  profile_snapshot jsonb not null,
  guide_json jsonb not null,
  generated_at timestamptz not null default now()
);

create index idx_guides_user on guides(user_id, generated_at desc);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  guide_id uuid not null references guides(id) on delete cascade,
  resource_id text not null,
  reaction text not null check (reaction in ('thumbs_up', 'thumbs_down', 'pursuing', 'done', 'not_relevant')),
  created_at timestamptz not null default now()
);

create index idx_feedback_resource on feedback(resource_id, reaction);
```

### 9.4 Auth flow (email magic link with wisc.edu gate)

1. User enters email on `/login`.
2. Client checks: if `!email.endsWith("@wisc.edu")`, show inline error "Please use your @wisc.edu email."
3. If valid, Clerk sends magic link.
4. On click, user is authenticated. Redirect to `/survey` if no profile exists, else `/profile`.

### 9.5 Results page UX

- Show opening note in a highlighted card at the top.
- Three expandable sections for the three tiers.
- Each resource is a card showing: name, reason (the personalization), what-you-get snippet, how-to-access (clickable link), dollar value badge if applicable, affiliation badge (UW / Wisconsin / National).
- Thumbs up / thumbs down on each card, saves to `feedback` table.
- Top-right: "Export as PDF", "Email to myself", "Share with co-founder" (pre-fills email).
- Bottom: "Update my profile" and "Something wrong with these recommendations?" (opens feedback form).

---

## 10. Deployment

### 10.1 Environment variables

`.env.example`:

```
# Anthropic
ANTHROPIC_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth (Clerk example)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# App
NEXT_PUBLIC_APP_URL=https://founder-match.transcenduw.org
```

### 10.2 Hosting

- **Frontend + API routes:** Vercel. Connect the GitHub repo; auto-deploy on push to `main`.
- **Database:** Supabase free tier (sufficient for <50k rows).
- **Domain:** subdomain of transcenduw.org (or whatever the club owns).

### 10.3 Monthly cost estimate

- Vercel: $0 (hobby tier)
- Supabase: $0 (free tier)
- Clerk: $0 (free up to 10k MAU)
- Anthropic API: ~$20–50/month at 100–300 students/month with caching

---

## 11. Testing & Quality

### 11.1 Canonical test profiles

`tests/fixtures/test_profiles.json` — maintain 5–8 hand-crafted profiles spanning the matrix:

1. **Biotech PhD at MVP stage, fundraising** — expect WARF, Badger Tech Foundry, SBIR Phase I, Weinert WAVE.
2. **Undergrad solo at idea stage, consumer app** — expect D2P Startup Foundations, Transcend Pitch, TEO I-Corps, Weinert courses.
3. **Masters in Business, SaaS MVP, wants VC** — expect Burrill Business Plan Competition, Weinert INSITE, Y Combinator, gener8tor.
4. **Recent grad, climate hardware, non-dilutive focus** — expect SBIR, DOE grants, Activate Fellowship, Elemental Excelerator.
5. **Undergrad CDIS, AI/ML, building MVP** — expect AI compute credits (Anthropic, OpenAI, Modal), I-Corps, Draper TIF, Transcend events.

For each, run the full pipeline and spot-check: are the expected resources in Tier 1 or Tier 2? Are recommendations tailored?

### 11.2 Eval script

`tests/eval.py`:

- Loads each test profile
- Runs hard filter → scoring → LLM personalization
- Prints tiered output
- Flags: any tier with wrong count, any reason longer than 30 words, any resource that violates the profile (wrong stage, wrong industry)

Run before every deploy.

### 11.3 Unit tests

- `matching.test.ts`: test filter rules (stage, industry, eligibility, already-engaged) with hand-built inputs.
- Validate scoring is deterministic and monotonic in expected ways.

---

## 12. Build Order (Milestones)

### Milestone 1 — Data Layer (1 session)

- [ ] Write `scripts/ingest.py`
- [ ] Write extraction prompt
- [ ] Run full ingestion against the markdown file
- [ ] Hand-review 30 random resources; tune prompt
- [ ] Commit `data/resources.json`
- [ ] Write `scripts/validate.py`; confirm clean

**Done when:** `resources.json` has ~300 resources, validation passes, hand-review > 90% accurate.

### Milestone 2 — Matching Pipeline (1 session)

- [ ] Define all TypeScript types in `src/types/`
- [ ] Write `filter.ts` with all filter rules
- [ ] Write `score.ts` with scoring function + category balance
- [ ] Write 5 test profiles
- [ ] Write `tests/eval.py`
- [ ] Run eval; iterate on filter/score until all 5 profiles return sensible top-25 lists

**Done when:** eval output looks right for all 5 test profiles, before LLM is involved.

### Milestone 3 — LLM Personalization (1 session)

- [ ] Write `personalize.ts` — the single LLM call
- [ ] Write personalization prompt
- [ ] Test on all 5 profiles; verify tier distribution and reason quality
- [ ] Add caching by profile hash

**Done when:** LLM output for all 5 profiles has crisp, specific reasons and balanced tiers.

### Milestone 4 — Web App (1 session)

- [ ] Next.js scaffold with Tailwind + shadcn/ui
- [ ] Auth (Clerk with `@wisc.edu` gate)
- [ ] Supabase setup + migrations
- [ ] Landing page
- [ ] Survey form with progressive flow
- [ ] Results page with tiered guide
- [ ] Profile page with regenerate button
- [ ] Feedback thumbs

**Done when:** end-to-end flow works locally for a new user.

### Milestone 5 — Polish & Beta (0.5 session)

- [ ] Deploy to Vercel
- [ ] Connect domain
- [ ] Seed with 10 Transcend members
- [ ] Collect feedback
- [ ] Iterate on the biggest complaint

**Done when:** 10 members have completed the flow and given written feedback.

---

## 13. Known Risks & Mitigations

| Risk                                                                   | Mitigation                                                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Extraction prompt produces inconsistent tagging                        | Hand-review 30 resources after first run; iterate prompt; add validation script          |
| LLM personalization writes generic reasons                             | Prompt explicitly bans generic language; eval script flags reasons missing specificity   |
| Deadlines in `resources.json` go stale                                 | Display `last_reviewed` date on every card; user-facing "flag as outdated" button        |
| Students abandon survey                                                | Keep to 10 questions; progress bar; `localStorage` resume; make most questions skippable |
| LLM API cost spikes                                                    | Cache by profile hash; 24-hour regenerate cooldown; monitor via Anthropic console        |
| Recommendations bias toward UW resources even when worse options exist | UW bonus capped at +10; category balance guardrail prevents over-concentration           |
| Non-UW students or wrong emails                                        | Hard email domain gate on both client and server                                         |

---

## 14. Future Enhancements (post-v1, not scoped)

- Knowledge graph upgrade (prerequisite chains like I-Corps → SBIR)
- Vector embeddings for fuzzy matching on the free-text "additional context" field
- Resource freshness monitoring (scrape external URLs monthly, flag 404s or changed deadlines)
- Analytics dashboard for Transcend leadership (which resources are recommended most, under-utilized gems, feedback trends)
- Integration with Transcend newsletter (auto-surface upcoming deadlines matched to student profiles)
- Multi-language or plain-English mode
- NetID SSO partnership with UW DoIT
- Mobile-first PWA

---

## Appendix A — Useful reference paths

- Source document: `data/source/TranscendUW_FounderResourceGuide_2026.md`
- Generated data: `data/resources.json`
- Test profiles: `tests/fixtures/test_profiles.json`
- Extraction prompt: `scripts/prompts/extraction_prompt.txt`
- Anthropic API docs: https://docs.claude.com
- Next.js App Router docs: https://nextjs.org/docs/app
- Supabase docs: https://supabase.com/docs
- Clerk docs: https://clerk.com/docs

---

_End of spec. Hand this file to Claude Code and start with Milestone 1._
