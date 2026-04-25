-- WalletLens MVP schema
-- Apply via Supabase CLI: supabase db push

create extension if not exists "pgcrypto";

-- =======================================================================
-- report_cache: memoized full reports keyed by (address + methodology + lists hash)
-- =======================================================================
create table if not exists public.report_cache (
  cache_key            text primary key,
  address              text        not null,
  methodology_version  text        not null,
  payload              jsonb       not null,
  created_at           timestamptz not null default now(),
  expires_at           timestamptz not null
);

create index if not exists report_cache_address_idx    on public.report_cache (address);
create index if not exists report_cache_expires_at_idx on public.report_cache (expires_at);

-- =======================================================================
-- static_list_versions: track the version + size of each curated list snapshot
-- =======================================================================
create table if not exists public.static_list_versions (
  source       text        primary key,
  version      text        not null,
  size         integer     not null default 0,
  updated_at   timestamptz not null default now()
);

-- =======================================================================
-- label_entries: optional persisted labels (OFAC SDN, mixers, CEX, ...)
-- Code falls back to the in-repo seeded lists if this table is empty.
-- =======================================================================
create table if not exists public.label_entries (
  address     text        not null,
  category    text        not null,
  name        text,
  source      text        not null,
  source_url  text,
  valid_from  timestamptz not null default now(),
  valid_to    timestamptz,
  primary key (address, source)
);

create index if not exists label_entries_address_idx  on public.label_entries (address);
create index if not exists label_entries_category_idx on public.label_entries (category);

-- =======================================================================
-- rate_limit_log: simple sliding-window anti-abuse (kept short-lived)
-- =======================================================================
create table if not exists public.rate_limit_log (
  id         uuid        primary key default gen_random_uuid(),
  ip         text        not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_log_ip_time_idx on public.rate_limit_log (ip, created_at desc);

-- =======================================================================
-- RLS: all tables are server-only. We keep RLS enabled with no policies,
-- so the anon / authenticated roles get nothing. The server uses SERVICE_ROLE
-- which bypasses RLS.
-- =======================================================================
alter table public.report_cache          enable row level security;
alter table public.static_list_versions  enable row level security;
alter table public.label_entries         enable row level security;
alter table public.rate_limit_log        enable row level security;
