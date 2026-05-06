import type { LabelEntry } from "../types";
import { OFAC_SDN, OFAC_VERSION, OFAC_UPDATED_AT_MS } from "./ofac";
import { MIXERS, MIXERS_VERSION, MIXERS_UPDATED_AT_MS } from "./mixers";
import { CEX_ADDRESSES, CEX_VERSION, CEX_UPDATED_AT_MS } from "./cex";
import { BRIDGES, BRIDGES_VERSION, BRIDGES_UPDATED_AT_MS } from "./bridges";
import { DEFI_KNOWN, DEFI_VERSION, DEFI_UPDATED_AT_MS } from "./defi";
import { dbIndexSnapshot, lookupLabelDb, severityRank } from "./resolver";

export interface ListSnapshotMeta {
  source: string;
  version: string;
  updatedAtMs: number;
  size: number;
}

const STATIC_ENTRIES: LabelEntry[] = [
  ...OFAC_SDN.map((l) => ({ ...l, address: l.address.toLowerCase() })),
  ...MIXERS.map((l) => ({ ...l, address: l.address.toLowerCase() })),
  ...CEX_ADDRESSES.map((l) => ({ ...l, address: l.address.toLowerCase() })),
  ...BRIDGES.map((l) => ({ ...l, address: l.address.toLowerCase() })),
  ...DEFI_KNOWN.map((l) => ({ ...l, address: l.address.toLowerCase() })),
];

const STATIC_INDEX: Map<string, LabelEntry> = (() => {
  const m = new Map<string, LabelEntry>();
  for (const e of STATIC_ENTRIES) {
    const existing = m.get(e.address);
    if (!existing || severityRank(e.category) > severityRank(existing.category)) {
      m.set(e.address, e);
    }
  }
  return m;
})();

/**
 * Resolve an address to a label.
 *
 * Lookup order:
 *   1. DB-backed risk directory (warmed via `ensureLabelIndex` from resolver.ts).
 *   2. Seeded in-repo static lists (always available).
 *
 * The DB hit wins when its mapped category is stricter than the seed-list one,
 * so an OFAC entry from the DB does not get downgraded by a CEX seed entry.
 */
export function lookupLabel(address: string): LabelEntry | undefined {
  const key = address.toLowerCase();
  const dbHit = lookupLabelDb(key);
  const staticHit = STATIC_INDEX.get(key);
  if (dbHit && staticHit) {
    return severityRank(dbHit.category) >= severityRank(staticHit.category) ? dbHit : staticHit;
  }
  return dbHit ?? staticHit;
}

export function listSnapshots(): ListSnapshotMeta[] {
  const base: ListSnapshotMeta[] = [
    { source: "OFAC SDN (seed)", version: OFAC_VERSION, updatedAtMs: OFAC_UPDATED_AT_MS, size: OFAC_SDN.length },
    { source: "Mixers (community)", version: MIXERS_VERSION, updatedAtMs: MIXERS_UPDATED_AT_MS, size: MIXERS.length },
    { source: "CEX hot wallets", version: CEX_VERSION, updatedAtMs: CEX_UPDATED_AT_MS, size: CEX_ADDRESSES.length },
    { source: "Bridges", version: BRIDGES_VERSION, updatedAtMs: BRIDGES_UPDATED_AT_MS, size: BRIDGES.length },
    { source: "DeFi known", version: DEFI_VERSION, updatedAtMs: DEFI_UPDATED_AT_MS, size: DEFI_KNOWN.length },
  ];
  const db = dbIndexSnapshot();
  return db ? [db, ...base] : base;
}

export function listsVersionHash(): string {
  return listSnapshots().map((s) => `${s.source}:${s.version}`).join("|");
}

export { ensureLabelIndex } from "./resolver";
