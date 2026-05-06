import { getSupabaseServer } from "../supabase";
import type { LabelCategory, LabelEntry } from "../types";
import { log, logDebug } from "../logger";

/**
 * Maps risk_categories.id (rich taxonomy) to LabelCategory (legacy/UI),
 * so existing scoring/UI code keeps working while the DB carries the full set.
 */
const CATEGORY_MAP: Record<string, LabelCategory> = {
  sanctioned: "sanctioned",
  us_ofac_sanctions: "sanctioned",
  us_enforcement: "sanctioned",
  terrorism: "sanctioned",
  hamas_terrorism: "sanctioned",
  russian_terrorism: "sanctioned",
  terrorism_financing: "sanctioned",
  child_exploitation: "sanctioned",
  child_sexual_abuse_material: "sanctioned",

  mixer: "mixer",

  exploit: "exploit",
  hacking: "exploit",
  conti_hacking: "exploit",
  conti_leaks_hacking: "exploit",
  dharma_hacking: "exploit",
  illegal_service: "exploit",
  stolen_coins: "exploit",
  exmo_stolen_coins: "exploit",
  liquid_stolen_coins: "exploit",
  ronin_stolen_coins: "exploit",

  ransom: "ransom",
  extortion_ransom: "ransom",
  master_extortion_ransom: "ransom",
  robbinhood_extortion_ransom: "ransom",

  darknet_market: "darknet_market",
  dark_service: "darknet_market",
  nested_illicit: "darknet_market",
  hydra_nested: "darknet_market",
  suex_nested: "darknet_market",

  phishing: "phishing",

  scam: "scam",
  gainbitcoin_scam: "scam",
  plus_token_scam: "scam",
  exchange_fraudulent: "scam",
  abuse_reported: "scam",
  illicit_reported: "scam",
  user_reported: "scam",
  autodetected_alert: "scam",
  banned_by_contract: "scam",

  exchange_unlicensed: "exchange_unlicensed",
  gambling: "gambling",
  cex: "cex",
  exchange_licensed: "cex",
  defi: "defi",
  dex: "dex",
  lending: "lending",
  marketplace: "marketplace",
  bridge: "bridge",
};

interface DbAddressRow {
  address: string;
  chain_id: number | null;
  currency: string | null;
  confidence: number | null;
  source_id: string | null;
  evidence_url: string | null;
  valid_to: string | null;
  risk_entities: {
    id: string;
    name: string;
    category_id: string;
    risk_level: number | null;
    status: string;
  } | null;
}

interface DbCacheState {
  index: Map<string, LabelEntry>;
  version: string;
  size: number;
  loadedAtMs: number;
}

const REFRESH_TTL_MS = Number(process.env.RISK_DIRECTORY_TTL_MS ?? 5 * 60 * 1000);

let cache: DbCacheState | null = null;
let inflight: Promise<DbCacheState | null> | null = null;

function isExpired(state: DbCacheState): boolean {
  return Date.now() - state.loadedAtMs > REFRESH_TTL_MS;
}

async function loadFromDb(): Promise<DbCacheState | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;

  const t0 = Date.now();
  const { data, error } = await sb
    .from("risk_entity_addresses")
    .select(
      "address, chain_id, currency, confidence, source_id, evidence_url, valid_to, risk_entities!inner(id, name, category_id, risk_level, status)"
    )
    .eq("risk_entities.status", "active")
    .not("chain_id", "is", null);

  if (error) {
    log("resolver", "warn", "db_load_failed", { err: error.message });
    return null;
  }

  const rows = (data ?? []) as unknown as DbAddressRow[];
  const index = new Map<string, LabelEntry>();
  const now = Date.now();
  let kept = 0;

  for (const row of rows) {
    const entity = row.risk_entities;
    if (!entity) continue;
    if (row.valid_to && Date.parse(row.valid_to) < now) continue;
    const mapped = CATEGORY_MAP[entity.category_id];
    if (!mapped) continue;

    const address = row.address.toLowerCase();
    const next: LabelEntry = {
      address,
      category: mapped,
      name: entity.name,
      source: row.source_id ?? "risk-directory",
      sourceUrl: row.evidence_url ?? undefined,
      entityId: entity.id,
      riskLevel: entity.risk_level ?? undefined,
      confidence: row.confidence ?? undefined,
    };

    const existing = index.get(address);
    if (!existing || severityRank(next.category) > severityRank(existing.category)) {
      index.set(address, next);
      kept += 1;
    }
  }

  const version = `db-${rows.length}-${kept}-${now}`;
  log("resolver", "info", "db_index_loaded", {
    rows: rows.length,
    kept,
    ms: Date.now() - t0,
    version,
  });

  return { index, version, size: kept, loadedAtMs: now };
}

export async function ensureLabelIndex(): Promise<void> {
  if (cache && !isExpired(cache)) return;
  if (inflight) {
    await inflight;
    return;
  }
  inflight = loadFromDb()
    .then((state) => {
      if (state) cache = state;
      else logDebug("resolver", "db_index_skipped", { reason: "supabase_not_configured" });
      return state;
    })
    .finally(() => {
      inflight = null;
    });
  await inflight;
}

export function lookupLabelDb(address: string): LabelEntry | undefined {
  if (!cache) return undefined;
  return cache.index.get(address.toLowerCase());
}

export function dbIndexSnapshot():
  | { source: string; version: string; updatedAtMs: number; size: number }
  | undefined {
  if (!cache) return undefined;
  return {
    source: "Risk directory (DB)",
    version: cache.version,
    updatedAtMs: cache.loadedAtMs,
    size: cache.size,
  };
}

export function severityRank(cat: LabelCategory): number {
  switch (cat) {
    case "sanctioned":
      return 100;
    case "darknet_market":
      return 90;
    case "ransom":
      return 88;
    case "mixer":
      return 80;
    case "exploit":
      return 75;
    case "phishing":
    case "scam":
      return 70;
    case "exchange_unlicensed":
      return 50;
    case "gambling":
      return 45;
    case "bridge":
      return 30;
    case "cex":
      return 20;
    case "dex":
    case "lending":
    case "defi":
    case "marketplace":
      return 10;
    default:
      return 0;
  }
}
