-- Phase 3: add analyses table, restructure parlays for prose+meta split
-- Safe to truncate parlays: pre-production, no real user data.

-- ─── 1. analyses table (new) ─────────────────────────────────────────────────

create table public.analyses (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users(id) on delete cascade,
  sport              text        not null check (sport in ('nba', 'nfl', 'mlb')),
  game_context       text        not null,
  user_question      text        not null,
  full_response_text text        not null,
  created_at         timestamptz default now()
);

alter table public.analyses enable row level security;

create policy "users read own analyses"
  on public.analyses for select
  using (auth.uid() = user_id);

create policy "users insert own analyses"
  on public.analyses for insert
  with check (auth.uid() = user_id);

-- ─── 2. parlays: clear test data, drop Phase 2 speculative columns ───────────

truncate table public.parlays;

alter table public.parlays
  drop column sport,
  drop column matchup,
  drop column game_state,
  drop column odds_snapshot,
  drop column analysis_text,
  drop column confidence_rating,
  drop column recommendation_type;

-- ─── 3. parlays: add Phase 3 columns ─────────────────────────────────────────
-- outcome and user_id are kept from Phase 2.
-- user_id is kept on parlays (not just via analyses FK) for RLS simplicity.

alter table public.parlays
  add column analysis_id      uuid  not null references public.analyses(id) on delete cascade,
  add column confidence       int   not null check (confidence between 1 and 10),
  add column legs             jsonb not null,
  add column kill_conditions  jsonb not null,
  add column estimated_payout text  not null;

-- Existing parlays RLS policies (users read/insert/update own parlays) are
-- unchanged — they reference user_id which is retained.
