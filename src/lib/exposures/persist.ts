import type { AddressReport, ChainFacts, LabelEntry } from "../types";
import { getSupabaseServer } from "../supabase";
import { log } from "../logger";

const CATEGORY_TO_TAXONOMY: Record<LabelEntry["category"], string> = {
  sanctioned: "sanctioned",
  mixer: "mixer",
  exploit: "exploit",
  phishing: "phishing",
  scam: "scam",
  darknet_market: "darknet_market",
  ransom: "ransom",
  gambling: "gambling",
  exchange_unlicensed: "exchange_unlicensed",
  cex: "cex",
  bridge: "bridge",
  dex: "dex",
  lending: "lending",
  defi: "defi",
  marketplace: "marketplace",
};

const RISKY_CATEGORIES = new Set<LabelEntry["category"]>([
  "sanctioned",
  "mixer",
  "exploit",
  "phishing",
  "scam",
  "darknet_market",
  "ransom",
  "gambling",
  "exchange_unlicensed",
]);

interface ExposureRow {
  wallet_address: string;
  chain_id: number;
  entity_id: string | null;
  entity_address: string;
  category_id: string;
  direction: "received" | "sent" | "both" | "unknown";
  hops: number;
  via_address: string | null;
  tx_hash: string | null;
  amount_raw: number | null;
  amount_usd: number | null;
  first_seen_at: string;
  last_seen_at: string;
  confidence: number;
  score_contribution: number;
  evidence_url: string | null;
  source: string | null;
}

interface TaintCandidateRow {
  address: string;
  chain_id: number;
  status: "exposed" | "suspect";
  max_confidence: number;
  max_hops: number;
  reason: string;
  last_seen_at: string;
}

function buildRows(report: AddressReport): {
  exposures: ExposureRow[];
  candidates: TaintCandidateRow[];
} {
  const exposures: ExposureRow[] = [];
  const candidates = new Map<string, TaintCandidateRow>();
  const wallet = report.address.toLowerCase();
  const nowIso = new Date(report.createdAtMs).toISOString();

  for (const chain of report.chains) {
    if (!chain.available) continue;

    pushDirectExposures(chain, wallet, nowIso, exposures, candidates);
    pushGraphExposures(chain, wallet, nowIso, exposures, candidates);
  }

  return { exposures, candidates: Array.from(candidates.values()) };
}

function pushDirectExposures(
  chain: ChainFacts,
  wallet: string,
  nowIso: string,
  exposures: ExposureRow[],
  candidates: Map<string, TaintCandidateRow>,
) {
  for (const cp of chain.topCounterparties) {
    const label = cp.label;
    if (!label || !RISKY_CATEGORIES.has(label.category)) continue;
    const direction = cp.direction === "in" ? "received" : cp.direction === "out" ? "sent" : "both";
    exposures.push({
      wallet_address: wallet,
      chain_id: chain.chainId,
      entity_id: label.entityId ?? null,
      entity_address: label.address.toLowerCase(),
      category_id: CATEGORY_TO_TAXONOMY[label.category],
      direction,
      hops: 1,
      via_address: null,
      tx_hash: null,
      amount_raw: null,
      amount_usd: null,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      confidence: label.confidence ?? 70,
      score_contribution: 0,
      evidence_url: label.sourceUrl ?? null,
      source: label.source ?? null,
    });

    upsertCandidate(candidates, {
      address: wallet,
      chain_id: chain.chainId,
      status: "suspect",
      max_confidence: label.confidence ?? 70,
      max_hops: 1,
      reason: `direct exposure to ${label.category}`,
      last_seen_at: nowIso,
    });
  }
}

function pushGraphExposures(
  chain: ChainFacts,
  wallet: string,
  nowIso: string,
  exposures: ExposureRow[],
  candidates: Map<string, TaintCandidateRow>,
) {
  for (const exposure of chain.graph?.exposures ?? []) {
    const label = exposure.label;
    if (!RISKY_CATEGORIES.has(label.category)) continue;
    exposures.push({
      wallet_address: wallet,
      chain_id: chain.chainId,
      entity_id: label.entityId ?? null,
      entity_address: label.address.toLowerCase(),
      category_id: CATEGORY_TO_TAXONOMY[label.category],
      direction: "unknown",
      hops: exposure.depth,
      via_address: exposure.via ?? null,
      tx_hash: null,
      amount_raw: null,
      amount_usd: null,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      confidence: label.confidence ?? Math.max(20, 80 - exposure.depth * 20),
      score_contribution: 0,
      evidence_url: label.sourceUrl ?? null,
      source: label.source ?? null,
    });

    const status = exposure.depth === 1 ? "suspect" : "exposed";
    upsertCandidate(candidates, {
      address: wallet,
      chain_id: chain.chainId,
      status,
      max_confidence: label.confidence ?? Math.max(20, 80 - exposure.depth * 20),
      max_hops: exposure.depth,
      reason: `${exposure.depth}-hop exposure to ${label.category}`,
      last_seen_at: nowIso,
    });
  }
}

function upsertCandidate(
  map: Map<string, TaintCandidateRow>,
  next: TaintCandidateRow,
) {
  const key = `${next.chain_id}:${next.address}`;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, next);
    return;
  }
  const promote = next.status === "suspect" && existing.status !== "suspect";
  map.set(key, {
    ...existing,
    status: promote ? "suspect" : existing.status,
    max_confidence: Math.max(existing.max_confidence, next.max_confidence),
    max_hops: Math.max(existing.max_hops, next.max_hops),
    last_seen_at: next.last_seen_at,
    reason: existing.max_confidence >= next.max_confidence ? existing.reason : next.reason,
  });
}

export async function persistExposures(report: AddressReport): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;

  const { exposures, candidates } = buildRows(report);
  if (exposures.length === 0 && candidates.length === 0) return;

  if (exposures.length > 0) {
    const { error } = await sb.from("wallet_exposures").insert(exposures);
    if (error) {
      log("exposures", "warn", "exposures_insert_failed", {
        err: error.message,
        rows: exposures.length,
      });
    } else {
      log("exposures", "info", "exposures_inserted", {
        address: report.address,
        rows: exposures.length,
      });
    }
  }

  if (candidates.length > 0) {
    const { error } = await sb.from("taint_candidates").upsert(candidates, {
      onConflict: "chain_id,address",
    });
    if (error) {
      log("exposures", "warn", "taint_upsert_failed", {
        err: error.message,
        rows: candidates.length,
      });
    } else {
      log("exposures", "info", "taint_upserted", {
        address: report.address,
        rows: candidates.length,
      });
    }
  }
}
