# Parallel Terminal Assignments — Transcend Founder Matcher

## Current status snapshot (April 23, 2026)

The repo is no longer greenfield. Use the splits below as the **current** three-terminal plan.

- Git repo is initialized.
- Stream C scaffold is already committed in `d3efd38` (`milestone 4 scaffold with Clerk auth foundation`).
- `data/source/TranscendUW_FounderResourceGuide_2026.md` exists.
- Stream A code now exists: `scripts/ingest.py`, `scripts/validate.py`, `scripts/prompts/extraction_prompt.txt`, `scripts/requirements.txt`.
- A local virtualenv exists at `.venv/` with the Python dependencies installed for ingestion.
- `data/resources.json` is still `[]` because ingestion has **not** been run successfully yet and the 30-resource hand review has **not** happened yet.
- Stream B code already exists: `src/types/`, `src/lib/matching/`, `src/lib/resources.ts`, `tests/fixtures/test_profiles.json`, `tests/matching.test.ts`, `tests/eval.py`, `tests/eval_entry.ts`.
- `npm test` and `npm run typecheck` pass on the current TypeScript codebase.
- The local machine does **not** have a `python` binary on `PATH`; use `python3` or `.venv/bin/python`.

## Recommended terminal split from this point forward

Three Codex terminals can now work in parallel on the **remaining** work:

| Terminal | Focus from here | Language | Touches |
|---|---|---|---|
| **A** | Finish Milestone 1 execution (run ingestion, review, validate, commit data) | Python | `scripts/`, `data/` |
| **B** | Milestone 3 — LLM personalization + any eval hardening needed | TypeScript (+ Python eval only if needed) | `src/lib/llm/`, limited `tests/` |
| **C** | Integration + web app completion (survey, results, profile, feedback, API wiring) | TypeScript / Next.js | `src/app/`, `src/components/`, `src/lib/db/` |

**Important coordination notes**

- Terminal A owns the source-of-truth resource extraction flow and the final `data/resources.json`.
- Terminal B should treat the existing matching pipeline as the baseline and stay out of `src/app/`.
- Terminal C should assume Clerk is the chosen auth provider (it was the first option named in PLAN.md and is already scaffolded).
- Terminal C should import the existing matching + resource loaders rather than rewriting them.
- If Terminal B needs a small type addition for Milestone 3/integration, coordinate first and keep the edit minimal.
- Do not revert or overwrite other terminals' work; adapt to it.

Three Claude Code terminals can work in parallel from day one because `PLAN.md` fully specifies the schema and controlled vocabularies up front. Only Milestone 3 (LLM personalization) and final integration need to wait for the other three streams.

| Terminal | Milestone | Language | Touches |
|---|---|---|---|
| **A** | M1 — Data Ingestion | Python | `scripts/`, `data/` |
| **B** | M2 — Matching Pipeline | TypeScript + Python harness | `src/types/`, `src/lib/matching/`, `tests/` |
| **C** | M4 — Web App Scaffold | TypeScript / Next.js | `src/app/`, `src/components/`, `src/lib/db/`, config files |

**Start order:** C first (creates `package.json`, `tsconfig.json`). A and B can start immediately after, or in parallel with C if you're comfortable letting B wait a moment to add its dev deps.

**Integration phase (single terminal, after A + B + C land):** Build Milestone 3 (LLM personalize), wire survey → matching → LLM → results, then Milestone 5 deploy.

---

## Terminal A — Data Ingestion Pipeline

### Updated scope (current)

The code exists now. This terminal should **finish execution and quality control**, not start from scratch.

### Scope
Milestone 1 only. Python. Produces `data/resources.json` (~300 entries).

**Owns:** `scripts/ingest.py`, `scripts/validate.py`, `scripts/prompts/extraction_prompt.txt`, `scripts/requirements.txt`, `data/resources.json`.
**Stay out of:** `src/`, `next.config.js`, `package.json`, `tests/`.

### Plan
1. Audit the current `scripts/ingest.py` / `scripts/validate.py` implementation against PLAN.md §5 before changing anything.
2. Run ingestion with the existing `.venv`:
   - `.venv/bin/python scripts/ingest.py`
3. Hand-review 30 random extracted resources against their source blocks.
4. Tune `scripts/prompts/extraction_prompt.txt` and/or `scripts/ingest.py` until the sample is ≥90% accurate, then re-run ingestion.
5. Run validation:
   - `.venv/bin/python scripts/validate.py`
6. Commit `data/resources.json` and any ingestion-script changes with a short Milestone 1 commit message.

### Blockers to respect

- If `ANTHROPIC_API_KEY` is not set, stop and ask the user before trying to fake or bypass extraction.
- Do **not** hand-author `data/resources.json`. It must come from the ingestion pipeline plus review/tuning.

### Done when
- `.venv/bin/python scripts/validate.py` exits clean
- Hand-review of 30 random resources ≥90% correct
- `data/resources.json` committed

### Initial prompt (paste into the new terminal)

```
You are finishing Milestone 1 of PLAN.md in /Users/cullanwickramasuriya/Projects/Transcend_Resource_Graph. Read §1–§5 of PLAN.md first, then audit the current Python implementation before changing anything. Your scope is Python only — `scripts/` and `data/`. Do not touch `src/`, `tests/`, or any Next.js config; other terminals own those.

Current repo state:
- `scripts/ingest.py`, `scripts/validate.py`, `scripts/prompts/extraction_prompt.txt`, and `scripts/requirements.txt` already exist
- `.venv/` exists with the Python packages installed
- `data/source/TranscendUW_FounderResourceGuide_2026.md` exists
- `data/resources.json` is still empty and not valid yet

Use the existing code as your starting point. Fix it if needed, then run the real ingestion with:
- `.venv/bin/python scripts/ingest.py`
- `.venv/bin/python scripts/validate.py`

Use `anthropic.AsyncAnthropic` with `claude-sonnet-4-6` and a semaphore of 10 concurrent requests. After the first full run, hand-review 30 random extracted resources against their source blocks and tune the extraction prompt until >90% look correct, then re-run.

If `ANTHROPIC_API_KEY` is not set, stop and ask the user instead of bypassing the model step. Do not hand-author `data/resources.json`.

Finish by committing the Milestone 1 work with a short, accurate git commit message.
```

---

## Terminal B — LLM Personalization

### Updated scope (current)

Milestone 2 already exists in the repo and currently passes unit tests. Treat it as a baseline. This terminal owns **Milestone 3** now, plus only the narrow test/eval changes required to support it.

### Scope
Milestone 3 only. TypeScript Anthropic client + personalization pipeline, with minimal eval updates if required.

**Owns:** `src/lib/llm/*.ts`, and only the smallest necessary follow-up changes in `tests/` or `src/types/recommendation.ts`.
**Stay out of:** `scripts/`, `src/app/`, `src/components/`, `src/lib/db/`, `src/types/resource.ts`, `src/types/profile.ts`, `src/lib/matching/`.

### Plan
1. Read PLAN.md §8 in full, plus §8.4 and the relevant parts of §11.
2. Audit the current matching and recommendation types so you understand the integration surface.
3. Implement `src/lib/llm/client.ts` and `src/lib/llm/personalize.ts` per PLAN.md §8:
   - Anthropic SDK
   - model = `claude-sonnet-4-6`
   - structured output / tool-forced JSON
   - cache by profile hash
4. If necessary, make the smallest possible updates to `tests/eval.py` or recommendation typing so Milestone 3 can be exercised cleanly once `resources.json` exists.
5. Verify with `npm run typecheck` and, if practical, `npm test`.

### Coordination

- `package.json` already exists and already includes the `anthropic` dependency.
- Do not rework the survey/results pages; Terminal C owns the app integration.
- If `ANTHROPIC_API_KEY` is absent, still write the code, but stop before claiming runtime verification.

### Done when
- `src/lib/llm/client.ts` and `src/lib/llm/personalize.ts` exist and match the schema/prompt requirements
- Cache is keyed by profile hash
- Typecheck passes
- The code is ready for Terminal C to call from `/api/survey/submit`

### Initial prompt (paste into the new terminal)

```
You are implementing Milestone 3 of PLAN.md in /Users/cullanwickramasuriya/Projects/Transcend_Resource_Graph. Read §8, §8.4, and the relevant test notes in §11 before writing code. Audit the existing codebase first — Milestone 2 already exists and should be treated as the baseline.

Your scope is `src/lib/llm/` plus only the smallest necessary support edits in `tests/` or `src/types/recommendation.ts`. Do not touch `scripts/`, `src/app/`, `src/components/`, `src/lib/db/`, `src/types/resource.ts`, `src/types/profile.ts`, or `src/lib/matching/`.

Implement:
- `src/lib/llm/client.ts`
- `src/lib/llm/personalize.ts`

Requirements:
- Anthropic SDK
- model = `claude-sonnet-4-6`
- structured output / tool-forced JSON
- input = `StudentProfile` + top 25 scored resources
- output = `PersonalizedGuide` exactly matching PLAN.md §8.4 after hydration
- cache by profile hash

If you need a small eval/test adjustment to support Milestone 3 cleanly, keep it tightly scoped and explain why. If `ANTHROPIC_API_KEY` is missing, still finish the code but do not claim runtime verification.
```

---

## Terminal C — Integration + Web Completion

### Updated scope (current)

The scaffold exists and is already committed. This terminal should finish the actual application flow: survey, submit API, results rendering, profile page, and feedback.

### Scope
Integration phase only. Use the existing scaffold and wire the real user flow.

**Owns:** `src/app/**`, `src/components/**`, `src/lib/db/**`, and any small UI-facing helpers needed for integration.
**Stay out of:** `scripts/`, `src/lib/llm/`, `src/lib/matching/`, `src/types/`, `tests/`.

### Plan
1. Read PLAN.md §6, §7.1, §9.1, §9.2, and §9.5.
2. Audit the existing scaffold and reuse it rather than replacing it.
3. Build the real survey UI from §6.2:
   - progressive flow
   - progress bar
   - `localStorage` persistence on every answer
   - loading state on submit
4. Wire `/api/survey/submit`:
   - save profile
   - run filter
   - run score
   - call personalize
   - persist `guides` row
   - return guide
5. Build `/results` from §9.5:
   - opening note card
   - three tier sections
   - resource cards
   - thumbs feedback
6. Build `/profile`:
   - load the saved profile
   - allow re-run / regenerate flow
7. Implement `/api/recommendations/generate` and `/api/feedback`.
8. Keep Clerk `@wisc.edu` gating intact.

### Done when
- A logged-in user can go through `/survey` → `/api/survey/submit` → `/results`
- Results render a persisted `PersonalizedGuide`
- Feedback thumbs save to the database
- `/profile` can load and regenerate

### Initial prompt (paste into the new terminal)

```
You are implementing the integration/web completion phase of PLAN.md in /Users/cullanwickramasuriya/Projects/Transcend_Resource_Graph. Read §6, §7.1, §9.1, §9.2, and §9.5 before writing code. Audit the existing scaffold first — it already exists and should be reused, not replaced.

Your scope is `src/app/**`, `src/components/**`, `src/lib/db/**`, and small UI-facing glue only. Do not touch `scripts/`, `src/lib/llm/`, `src/lib/matching/`, `src/types/`, or `tests/`.

Implement the real app flow:
- survey UI from §6.2 with progressive flow, progress bar, and `localStorage` persistence
- `/api/survey/submit` wired to save profile, run filter, run score, call personalize, persist a `guides` row, and return the guide
- `/api/recommendations/generate`
- `/api/feedback`
- `/results` rendering the `PersonalizedGuide`
- `/profile` loading the saved profile and allowing regeneration
- feedback thumbs on resource cards

Use the existing Clerk + Supabase scaffold. Keep the hard `@wisc.edu` gate intact. Assume Terminal B owns `src/lib/llm/` and Terminal A owns `data/resources.json`.
```

---

## Critical shared references

- `/Users/cullanwickramasuriya/Projects/Transcend_Resource_Graph/PLAN.md` — single source of truth
- `data/source/TranscendUW_FounderResourceGuide_2026.md` — input for Terminal A (user will drop in before starting A)

## End-to-end verification (after all three terminals finish)

From repo root:
- `.venv/bin/python scripts/validate.py` — clean
- `npx vitest run` — passes
- `next dev` — boots, `@wisc.edu` login works
- `python3 tests/eval.py` — top-25 printed for each of the 5 canonical profiles

Then proceed to the integration session: Milestone 3 (LLM personalize) + survey/results wiring, Milestone 5 deploy.
