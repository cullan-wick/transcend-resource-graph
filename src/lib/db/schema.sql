-- Transcend Founder Matcher — database schema
-- Users are handled by Clerk; we reference Clerk's user_id as the primary key.

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
