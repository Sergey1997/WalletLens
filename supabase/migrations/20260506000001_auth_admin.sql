-- WalletLens - Auth, per-user settings, watchlist scoping and read policies
-- Builds on 20260506000000_risk_directory.sql.
-- The service role key (used by the server) bypasses RLS, so admin imports keep
-- working. End-user reads/writes go through the anon key from the browser, gated
-- by the RLS policies declared below.

-- =======================================================================
-- 1. Watchlist becomes per-user
-- =======================================================================
alter table if exists public.watchlist_items
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists watchlist_items_user_idx on public.watchlist_items (user_id);

-- Backfill: rows with owner='system' but no user_id are global; leave as is.
-- New rows from the app must include user_id (enforced by RLS policy below).

drop policy if exists watchlist_select_own on public.watchlist_items;
drop policy if exists watchlist_modify_own on public.watchlist_items;

create policy watchlist_select_own
  on public.watchlist_items for select
  using (auth.uid() = user_id);

create policy watchlist_modify_own
  on public.watchlist_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =======================================================================
-- 2. user_settings: per-user preferences
-- =======================================================================
create table if not exists public.user_settings (
  user_id              uuid        primary key references auth.users(id) on delete cascade,
  active_profile_id    text,
  notify_email         boolean     not null default true,
  notify_grade_change  boolean     not null default true,
  default_chains       integer[]   not null default '{1, 8453}',
  ui_density           text        not null default 'comfortable',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint user_settings_density_check check (ui_density in ('comfortable', 'compact'))
);

alter table public.user_settings enable row level security;

drop policy if exists user_settings_select_own on public.user_settings;
drop policy if exists user_settings_modify_own on public.user_settings;

create policy user_settings_select_own
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy user_settings_modify_own
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =======================================================================
-- 3. user_label_overrides: user-specific allow/deny per address
-- (does not change global directory; surfaces in resolver as a per-user shadow)
-- =======================================================================
create table if not exists public.user_label_overrides (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  chain_id      integer     not null,
  address       text        not null,
  override      text        not null,
  note          text,
  created_at    timestamptz not null default now(),
  unique (user_id, chain_id, address),
  constraint user_label_overrides_kind check (override in ('allow', 'deny'))
);

create index if not exists user_label_overrides_user_idx on public.user_label_overrides (user_id);

alter table public.user_label_overrides enable row level security;

drop policy if exists user_label_overrides_select_own on public.user_label_overrides;
drop policy if exists user_label_overrides_modify_own on public.user_label_overrides;

create policy user_label_overrides_select_own
  on public.user_label_overrides for select
  using (auth.uid() = user_id);

create policy user_label_overrides_modify_own
  on public.user_label_overrides for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =======================================================================
-- 4. Public read policies for the directory
-- (write paths run via the service role key on the server)
-- =======================================================================
drop policy if exists risk_categories_public_read on public.risk_categories;
drop policy if exists risk_sources_public_read    on public.risk_sources;
drop policy if exists risk_entities_public_read   on public.risk_entities;
drop policy if exists entity_aliases_public_read  on public.entity_aliases;
drop policy if exists risk_entity_addresses_public_read on public.risk_entity_addresses;
drop policy if exists risk_score_profiles_public_read   on public.risk_score_profiles;

create policy risk_categories_public_read         on public.risk_categories         for select using (true);
create policy risk_sources_public_read            on public.risk_sources            for select using (true);
create policy risk_entities_public_read           on public.risk_entities           for select using (true);
create policy entity_aliases_public_read          on public.entity_aliases          for select using (true);
create policy risk_entity_addresses_public_read   on public.risk_entity_addresses   for select using (true);
create policy risk_score_profiles_public_read     on public.risk_score_profiles     for select using (true);

-- =======================================================================
-- 5. Score profile ownership
-- (a profile may belong to a user; null owner means a system profile)
-- =======================================================================
alter table if exists public.risk_score_profiles
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create index if not exists risk_score_profiles_owner_idx on public.risk_score_profiles (owner_id);

drop policy if exists risk_score_profiles_modify_own on public.risk_score_profiles;
create policy risk_score_profiles_modify_own
  on public.risk_score_profiles for all
  using (owner_id is null or auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
