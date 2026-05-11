-- Profiles: extends auth.users with subscription + usage info
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  stripe_customer_id text unique,
  subscription_status text default 'free' check (subscription_status in ('free', 'active', 'past_due', 'canceled')),
  subscription_tier text default 'free' check (subscription_tier in ('free', 'pro')),
  lifetime_analyses_used int default 0,
  created_at timestamptz default now()
);

-- Parlays: every analysis a user requests gets stored
create table public.parlays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null check (sport in ('nba', 'nfl', 'mlb')),
  matchup text not null,
  game_state jsonb not null,
  odds_snapshot jsonb not null,
  analysis_text text not null,
  confidence_rating int,
  recommendation_type text,
  outcome text default 'pending' check (outcome in ('pending', 'won', 'lost', 'push', 'cashed_out')),
  created_at timestamptz default now()
);

-- Affiliate clicks: tracked for future revenue analytics
create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  sportsbook text not null,
  clicked_at timestamptz default now(),
  ip_hash text,
  user_agent text
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.parlays enable row level security;
alter table public.affiliate_clicks enable row level security;

create policy "users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users read own parlays" on public.parlays for select using (auth.uid() = user_id);
create policy "users insert own parlays" on public.parlays for insert with check (auth.uid() = user_id);
create policy "users update own parlays" on public.parlays for update using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
