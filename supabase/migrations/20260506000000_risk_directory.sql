-- WalletLens - Risk Directory, Score Profiles, Watchlist, Exposures, Taint Candidates
-- This migration is additive: it does not touch tables created in
-- 20260423000000_init.sql (report_cache, label_entries, ...). The legacy
-- label_entries table is kept as a fallback while the new directory becomes
-- the source of truth for the entity resolver.

create extension if not exists "pgcrypto";
create extension if not exists pg_trgm;

-- =======================================================================
-- 1. Risk taxonomy: categories + sources
-- =======================================================================
create table if not exists public.risk_categories (
  id            text primary key,
  display_name  text        not null,
  parent_id     text        references public.risk_categories(id) on delete set null,
  severity      smallint    not null default 0,
  description   text,
  created_at    timestamptz not null default now()
);

create table if not exists public.risk_sources (
  id           text primary key,
  display_name text        not null,
  trust_level  smallint    not null default 50,
  url          text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- =======================================================================
-- 2. Risk entities: one logical service can have many addresses across chains
-- =======================================================================
create table if not exists public.risk_entities (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  category_id   text        not null references public.risk_categories(id) on delete restrict,
  risk_level    smallint    not null default 50,
  status        text        not null default 'active',
  description   text,
  website       text,
  tags          text[]      not null default '{}',
  created_by    text,
  updated_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint risk_entities_status_check check (status in ('active', 'archived', 'pending_review'))
);

create index if not exists risk_entities_category_idx on public.risk_entities (category_id);
create index if not exists risk_entities_status_idx   on public.risk_entities (status);
create index if not exists risk_entities_name_trgm    on public.risk_entities using gin (name gin_trgm_ops);

create table if not exists public.entity_aliases (
  id           uuid        primary key default gen_random_uuid(),
  entity_id    uuid        not null references public.risk_entities(id) on delete cascade,
  alias        text        not null,
  created_at   timestamptz not null default now(),
  unique (entity_id, alias)
);

create index if not exists entity_aliases_alias_trgm on public.entity_aliases using gin (alias gin_trgm_ops);

-- =======================================================================
-- 3. Entity addresses: scoped by chain, with provenance and validity window
-- =======================================================================
create table if not exists public.risk_entity_addresses (
  id              uuid        primary key default gen_random_uuid(),
  entity_id       uuid        not null references public.risk_entities(id) on delete cascade,
  chain_id        integer     not null,
  address         text        not null,
  confidence      smallint    not null default 80,
  valid_from      timestamptz not null default now(),
  valid_to        timestamptz,
  source_id       text        references public.risk_sources(id) on delete set null,
  evidence_url    text,
  notes           text,
  created_at      timestamptz not null default now(),
  unique (chain_id, address, entity_id)
);

create index if not exists risk_entity_addresses_address_idx
  on public.risk_entity_addresses (lower(address));
create index if not exists risk_entity_addresses_chain_addr_idx
  on public.risk_entity_addresses (chain_id, lower(address));
create index if not exists risk_entity_addresses_entity_idx
  on public.risk_entity_addresses (entity_id);

-- =======================================================================
-- 4. Score profiles: weights/influence per category, versioned
-- =======================================================================
create table if not exists public.risk_score_profiles (
  id            text        primary key,
  name          text        not null,
  version       text        not null,
  is_default    boolean     not null default false,
  config        jsonb       not null,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists risk_score_profiles_one_default
  on public.risk_score_profiles ((is_default))
  where is_default;

-- =======================================================================
-- 5. Watchlist
-- =======================================================================
create table if not exists public.watchlist_items (
  id                uuid        primary key default gen_random_uuid(),
  owner             text        not null default 'system',
  address           text        not null,
  label             text,
  note              text,
  last_score        smallint,
  last_grade        text,
  last_checked_at   timestamptz,
  created_at        timestamptz not null default now(),
  unique (owner, address)
);

create index if not exists watchlist_items_address_idx on public.watchlist_items (lower(address));

-- =======================================================================
-- 6. Wallet exposures: persisted hits from graph scan
-- =======================================================================
create table if not exists public.wallet_exposures (
  id                  uuid        primary key default gen_random_uuid(),
  wallet_address      text        not null,
  chain_id            integer     not null,
  entity_id           uuid        references public.risk_entities(id) on delete set null,
  entity_address      text        not null,
  category_id         text        references public.risk_categories(id) on delete set null,
  direction           text        not null default 'unknown',
  hops                smallint    not null default 1,
  via_address         text,
  tx_hash             text,
  amount_raw          numeric,
  amount_usd          numeric,
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  confidence          smallint    not null default 50,
  score_contribution  smallint    not null default 0,
  evidence_url        text,
  source              text,
  constraint wallet_exposures_direction_check check (direction in ('received', 'sent', 'both', 'unknown'))
);

create index if not exists wallet_exposures_wallet_idx
  on public.wallet_exposures (lower(wallet_address));
create index if not exists wallet_exposures_entity_idx
  on public.wallet_exposures (entity_id);
create index if not exists wallet_exposures_category_idx
  on public.wallet_exposures (category_id);

-- =======================================================================
-- 7. Taint candidates + path evidence
-- =======================================================================
create table if not exists public.taint_candidates (
  address           text        not null,
  chain_id          integer     not null,
  status            text        not null default 'exposed',
  max_confidence    smallint    not null default 0,
  max_hops          smallint    not null default 1,
  reason            text,
  reviewed_by       text,
  reviewed_at       timestamptz,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  primary key (chain_id, address),
  constraint taint_candidates_status_check check (status in
    ('exposed', 'suspect', 'confirmed_risky', 'false_positive', 'ignored'))
);

create index if not exists taint_candidates_status_idx on public.taint_candidates (status);

create table if not exists public.exposure_paths (
  id                 uuid        primary key default gen_random_uuid(),
  candidate_address  text        not null,
  chain_id           integer     not null,
  entity_id          uuid        references public.risk_entities(id) on delete set null,
  hop_index          smallint    not null,
  via_address        text,
  evidence_url       text,
  created_at         timestamptz not null default now()
);

create index if not exists exposure_paths_candidate_idx
  on public.exposure_paths (chain_id, lower(candidate_address));

-- =======================================================================
-- 8. Audit events
-- =======================================================================
create table if not exists public.audit_events (
  id           uuid        primary key default gen_random_uuid(),
  actor        text,
  action       text        not null,
  target_kind  text        not null,
  target_id    text,
  payload      jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists audit_events_target_idx on public.audit_events (target_kind, target_id);
create index if not exists audit_events_created_idx on public.audit_events (created_at desc);

-- =======================================================================
-- 9. RLS: server-only, like the original schema
-- =======================================================================
alter table public.risk_categories         enable row level security;
alter table public.risk_sources            enable row level security;
alter table public.risk_entities           enable row level security;
alter table public.entity_aliases          enable row level security;
alter table public.risk_entity_addresses   enable row level security;
alter table public.risk_score_profiles     enable row level security;
alter table public.watchlist_items         enable row level security;
alter table public.wallet_exposures        enable row level security;
alter table public.taint_candidates        enable row level security;
alter table public.exposure_paths          enable row level security;
alter table public.audit_events            enable row level security;

-- =======================================================================
-- 10. Seed taxonomy + sources + default profile (idempotent)
-- =======================================================================
insert into public.risk_categories (id, display_name, severity, description) values
  ('sanctioned',           'Sanctioned',                100, 'OFAC SDN or equivalent sanctions list match'),
  ('mixer',                'Mixer / Privacy Pool',       80, 'Privacy mixers; elevated risk, not always illegal'),
  ('exploit',              'Exploit / Stolen Funds',     85, 'Wallets associated with hacks and stolen funds'),
  ('phishing',             'Phishing',                   75, 'Community-flagged phishing addresses'),
  ('scam',                 'Scam',                       75, 'Community-flagged scams and rug pulls'),
  ('darknet_market',       'Darknet Market',             95, 'Darknet marketplaces and onboarding services'),
  ('dark_service',         'Dark Service',               90, 'Other darknet services'),
  ('ransom',               'Ransomware',                 95, 'Ransomware payment addresses'),
  ('terrorism_financing',  'Terrorism Financing',       100, 'Terrorism financing related entities'),
  ('child_exploitation',   'Child Exploitation',        100, 'Child exploitation related entities'),
  ('illegal_service',      'Illegal Service',            85, 'Other illegal services'),
  ('seized_assets',        'Seized Assets',              60, 'Government-seized addresses'),
  ('gambling',             'Gambling',                   40, 'Online gambling services'),
  ('exchange_licensed',    'Exchange (Licensed)',        10, 'Licensed centralized exchange'),
  ('exchange_unlicensed',  'Exchange (Unlicensed)',      45, 'Unlicensed or unverified exchange'),
  ('exchange_fraudulent',  'Exchange (Fraudulent)',      90, 'Fraudulent exchange'),
  ('cex',                  'CEX',                        10, 'Major centralized exchange wallet'),
  ('p2p_exchange',         'P2P Exchange',               40, 'Peer to peer exchange'),
  ('atm',                  'Crypto ATM',                 25, 'Crypto ATM operator'),
  ('payment',              'Payment Processor',          15, 'Payment processor'),
  ('marketplace',          'Marketplace',                15, 'NFT or merchant marketplace'),
  ('miner',                'Miner / Mining Pool',        10, 'Mining pool or miner payout'),
  ('bridge',               'Bridge',                     20, 'Cross chain bridge'),
  ('defi',                 'DeFi',                       10, 'Established DeFi protocol'),
  ('dex',                  'DEX',                        10, 'Decentralized exchange'),
  ('lending',              'Lending',                    10, 'Lending protocol'),
  ('liquidity_pools',      'Liquidity Pool',             10, 'Liquidity pool'),
  ('wallet',               'Wallet',                      0, 'Generic wallet')
on conflict (id) do update set
  display_name = excluded.display_name,
  severity     = excluded.severity,
  description  = excluded.description;

insert into public.risk_sources (id, display_name, trust_level, url) values
  ('ofac-sdn',          'OFAC SDN',                95, 'https://home.treasury.gov/policy-issues/financial-sanctions/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists'),
  ('etherscan-public',  'Etherscan public tags',    70, 'https://etherscan.io/labelcloud'),
  ('community',         'Community attribution',    50, null),
  ('internal-research', 'Internal research',        80, null),
  ('seed-import',       'Seed import (repo lists)', 60, null)
on conflict (id) do update set
  display_name = excluded.display_name,
  trust_level  = excluded.trust_level,
  url          = excluded.url,
  updated_at   = now();

insert into public.risk_score_profiles (id, name, version, is_default, config) values
  ('default', 'Default', 'p1.0', true, jsonb_build_object(
    'categories', jsonb_build_object(
      'sanctioned',          jsonb_build_object('self', 100, 'direct', 90, '1hop', 60, '2hop', 30),
      'mixer',               jsonb_build_object('direct', 55,  '1hop', 35,  '2hop', 18),
      'exploit',             jsonb_build_object('direct', 65,  '1hop', 40,  '2hop', 18),
      'darknet_market',      jsonb_build_object('direct', 80,  '1hop', 50,  '2hop', 25),
      'dark_service',        jsonb_build_object('direct', 70,  '1hop', 40,  '2hop', 20),
      'ransom',              jsonb_build_object('direct', 75,  '1hop', 45,  '2hop', 22),
      'terrorism_financing', jsonb_build_object('direct', 95,  '1hop', 60,  '2hop', 30),
      'child_exploitation',  jsonb_build_object('direct', 95,  '1hop', 60,  '2hop', 30),
      'illegal_service',     jsonb_build_object('direct', 65,  '1hop', 40,  '2hop', 20),
      'phishing',            jsonb_build_object('direct', 60,  '1hop', 35,  '2hop', 18),
      'scam',                jsonb_build_object('direct', 60,  '1hop', 35,  '2hop', 18),
      'exchange_unlicensed', jsonb_build_object('direct', 25),
      'exchange_fraudulent', jsonb_build_object('direct', 70,  '1hop', 35),
      'gambling',            jsonb_build_object('direct', 25),
      'p2p_exchange',        jsonb_build_object('direct', 20),
      'atm',                 jsonb_build_object('direct', 15)
    ),
    'trust', jsonb_build_object(
      'cex',    20,
      'defi',   10,
      'dex',    10,
      'bridge',  5
    )
  ))
on conflict (id) do update set
  name       = excluded.name,
  version    = excluded.version,
  is_default = excluded.is_default,
  config     = excluded.config,
  updated_at = now();
