# Transcend UW Founder Matcher

Personalized startup resource recommendations for UW–Madison student founders.
See `PLAN.md` for the full specification.

## Milestone 4 — Web App Scaffold

This scaffold contains the Next.js 14 App Router shell, Tailwind + shadcn/ui,
Clerk auth (with a hard `@wisc.edu` domain gate), a typed Supabase client,
the database schema SQL, and placeholder routes + 501 API endpoints. Survey
logic, matching, and LLM calls are owned by other terminals / later milestones.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui primitives (`src/components/ui/`)
- Clerk for email-code auth
- Supabase Postgres (schema in `src/lib/db/schema.sql`)

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy env template and fill in values:

   ```bash
   cp .env.example .env.local
   ```

   You need a Clerk instance and a Supabase project. In Clerk, enable
   **Email link** for sign-in/sign-up and point your redirect URL at
   `/login/verify`.

3. Apply the database schema:

   ```bash
   psql "$SUPABASE_DB_URL" -f src/lib/db/schema.sql
   ```

   (Or paste it into the Supabase SQL editor.)

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## Auth flow

- `/login` accepts any email client-side but rejects anything that doesn't end
  in `@wisc.edu` with an inline error before contacting Clerk.
- The Clerk flow is configured for email links rather than passwords or codes.
- `src/middleware.ts` re-checks the domain on **every** authenticated request
  from the session's primary email. Non-`@wisc.edu` sessions are redirected
  back to `/login?error=wisc_only`.
- On successful sign-in, users land on `/survey`.

## Routes

| Path                            | Purpose                                    |
| ------------------------------- | ------------------------------------------ |
| `/`                             | Landing page                               |
| `/login`                        | Email-code sign-in with `@wisc.edu` gate   |
| `/survey`                       | Survey (placeholder)                       |
| `/results`                      | Personalized guide (placeholder)           |
| `/profile`                      | Profile view/edit (placeholder)            |
| `/api/survey/submit`            | 501 placeholder                            |
| `/api/recommendations/generate` | 501 placeholder                            |
| `/api/feedback`                 | 501 placeholder                            |

## Layout conventions

- `src/app/` — routes (App Router)
- `src/components/ui/` — shadcn-style primitives
- `src/lib/db/` — Supabase client + `schema.sql`
- `src/lib/utils.ts` — `cn` helper + `isWiscEmail` guard

Other directories (`scripts/`, `src/types/`, `src/lib/matching/`,
`src/lib/llm/`, `tests/`) are owned by sibling terminals — see `TERMINALS.md`.
