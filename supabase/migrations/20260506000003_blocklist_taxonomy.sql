-- WalletLens — Crystal-style blocklist taxonomy and address metadata.
--
-- Goal: let an admin upload entries that look like a Crystal blocklist row:
--   address | currency | tag | owner | mentions | description | date_added
--
-- Two changes:
--   1) `risk_entity_addresses` gains `currency`, `owner_label`, `mentions`,
--      `entry_description`. `chain_id` becomes optional (so we can track
--      addresses on non-EVM networks too: BTC, TRX, BCH, …).
--   2) `risk_categories` is seeded with the rich Crystal-style tag set
--      (Conti Hacking, GainBitcoin Scam, US OFAC Sanctions, …) using the
--      existing `parent_id` column to keep groupings tidy.

-- =======================================================================
-- 1. Address metadata: currency-aware, owner attribution, mentions, blurb
-- =======================================================================

alter table public.risk_entity_addresses
  add column if not exists currency          text,
  add column if not exists owner_label       text,
  add column if not exists mentions          integer not null default 0,
  add column if not exists entry_description text;

-- Backfill currency from existing chain_id and default the rest to ETH.
update public.risk_entity_addresses
   set currency = case chain_id
                    when 1     then 'ETH'
                    when 8453  then 'BASE'
                    when 137   then 'MATIC'
                    when 56    then 'BSC'
                    when 42161 then 'ARB'
                    when 10    then 'OP'
                    when 61    then 'ETC'
                    else 'ETH'
                  end
 where currency is null;

alter table public.risk_entity_addresses alter column currency set not null;
alter table public.risk_entity_addresses alter column chain_id drop not null;

-- Drop the original (chain_id, address, entity_id) unique constraint so the
-- new (entity_id, currency, address) one can take over. Lookup by name is
-- avoided in case Postgres auto-generated something different on this DB.
do $$
declare cname text;
begin
  select c.conname into cname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
   where t.relname = 'risk_entity_addresses'
     and c.contype = 'u'
     and (
       select array_agg(att.attname order by att.attname)
         from unnest(c.conkey) k
         join pg_attribute att on att.attrelid = t.oid and att.attnum = k
     ) = array['address','chain_id','entity_id']::name[];
  if cname is not null then
    execute format('alter table public.risk_entity_addresses drop constraint %I', cname);
  end if;
end $$;

create unique index if not exists risk_entity_addresses_uniq_currency_addr
  on public.risk_entity_addresses (entity_id, currency, address);

create index if not exists risk_entity_addresses_currency_idx
  on public.risk_entity_addresses (currency);

-- =======================================================================
-- 2. Crystal-style tag taxonomy (seeded under existing parents where
--    possible; new top-level groups only when the existing seed didn't
--    cover them).
-- =======================================================================

-- Top-level groups added on top of the existing seed
insert into public.risk_categories (id, display_name, severity, description) values
  ('us_enforcement',         'US Enforcement',          85, 'US law enforcement / DoJ designations'),
  ('extortion_ransom',       'Extortion / Ransom',      95, 'Generic extortion / ransom payment cluster'),
  ('hacking',                'Hacking',                 90, 'Hacking groups and proceeds of hacks'),
  ('stolen_coins',           'Stolen Coins',            85, 'Stolen funds (exchange / bridge / wallet hacks)'),
  ('nested_illicit',         'Nested (Illicit)',        80, 'Nested service operating on top of an illicit cluster'),
  ('terrorism',              'Terrorism',              100, 'Terrorism-related entities (umbrella tag)'),
  ('political_organization', 'Political Organization',  20, 'Political organisations and movements'),
  ('banned_by_contract',     'Banned By Contract',      70, 'Banned by an on-chain contract policy'),
  ('autodetected_alert',     'Autodetected Alert',      55, 'Auto-detected suspicious address'),
  ('pending_review',         'Pending Review',          30, 'Awaiting analyst review'),
  ('abuse_reported',         'Abuse Reported',          50, 'Reported as abusive behaviour'),
  ('illicit_reported',       'Illicit Reported',        65, 'Reported as illicit by a trusted source'),
  ('user_reported',          'User Reported',           40, 'Reported by an end user / community')
on conflict (id) do update set
  display_name = excluded.display_name,
  severity     = excluded.severity,
  description  = excluded.description;

-- Sub-tags
insert into public.risk_categories (id, display_name, severity, description, parent_id) values
  -- Sanctions
  ('us_ofac_sanctions',             'US OFAC Sanctions',             100, 'Specifically OFAC SDN list',                              'sanctioned'),
  -- CSAM (UN-style top-level severity, kept under existing child_exploitation)
  ('child_sexual_abuse_material',   'Child Sexual Abuse Material',   100, 'CSAM material distribution / monetisation',               'child_exploitation'),
  -- Extortion / Ransom (parents + sub-clusters)
  ('master_extortion_ransom',       'Master Extortion / Ransom',      95, 'Master node for an extortion cluster',                    'extortion_ransom'),
  ('robbinhood_extortion_ransom',   'Robbinhood Extortion / Ransom',  95, 'Robbinhood ransomware cluster',                           'extortion_ransom'),
  -- Hacking sub-tags
  ('conti_hacking',                 'Conti Hacking',                  95, 'Conti ransomware-as-a-service operations',                'hacking'),
  ('conti_leaks_hacking',           'Conti Leaks Hacking',            90, 'Hacks tied to Conti leaks',                               'hacking'),
  ('dharma_hacking',                'Dharma Hacking',                 90, 'Dharma ransomware-as-a-service',                          'hacking'),
  -- Nested illicit
  ('hydra_nested',                  'Hydra Nested (Illicit)',         85, 'Nested service on top of Hydra darknet',                  'nested_illicit'),
  ('suex_nested',                   'SUEX Nested (Illicit)',          85, 'Nested service on top of SUEX',                           'nested_illicit'),
  -- Scams
  ('gainbitcoin_scam',              'GainBitcoin Scam',               80, 'GainBitcoin Ponzi scheme cluster',                        'scam'),
  ('plus_token_scam',               'Plus Token Scam',                80, 'Plus Token Ponzi scheme cluster',                         'scam'),
  -- Stolen coins
  ('exmo_stolen_coins',             'EXMO Stolen Coins',              85, 'Funds stolen from EXMO',                                  'stolen_coins'),
  ('liquid_stolen_coins',           'Liquid Stolen Coins',            85, 'Funds stolen from Liquid',                                'stolen_coins'),
  ('ronin_stolen_coins',            'Ronin Stolen Coins',             85, 'Funds stolen from Ronin Bridge',                          'stolen_coins'),
  -- Terrorism sub-tags
  ('hamas_terrorism',               'Hamas Terrorism',               100, 'Hamas-affiliated addresses',                              'terrorism'),
  ('russian_terrorism',             'Russian Terrorism',             100, 'Russian terrorism-affiliated addresses',                  'terrorism')
on conflict (id) do update set
  display_name = excluded.display_name,
  severity     = excluded.severity,
  description  = excluded.description,
  parent_id    = excluded.parent_id;
