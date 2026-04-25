import type { LabelEntry } from "../types";
import { OFAC_SDN, OFAC_VERSION, OFAC_UPDATED_AT_MS } from "./ofac";
import { MIXERS, MIXERS_VERSION, MIXERS_UPDATED_AT_MS } from "./mixers";
import { CEX_ADDRESSES, CEX_VERSION, CEX_UPDATED_AT_MS } from "./cex";
import { BRIDGES, BRIDGES_VERSION, BRIDGES_UPDATED_AT_MS } from "./bridges";
import { DEFI_KNOWN, DEFI_VERSION, DEFI_UPDATED_AT_MS } from "./defi";

export interface ListSnapshotMeta {
  source: string;
  version: string;
  updatedAtMs: number;
  size: number;
}

const ALL: LabelEntry[] = [
  ...OFAC_SDN.map((l) => ({ ...l, address: l.address.toLowerCase() })),
  ...MIXERS.map((l) => ({ ...l, address: l.address.toLowerCase() })),
  ...CEX_ADDRESSES.map((l) => ({ ...l, address: l.address.toLowerCase() })),
  ...BRIDGES.map((l) => ({ ...l, address: l.address.toLowerCase() })),
  ...DEFI_KNOWN.map((l) => ({ ...l, address: l.address.toLowerCase() })),
];

const INDEX: Map<string, LabelEntry> = (() => {
  const m = new Map<string, LabelEntry>();
  for (const e of ALL) {
    // Severity order: sanctioned > mixer > phishing/scam/exploit > bridge/cex/defi
    const existing = m.get(e.address);
    if (!existing || severityRank(e.category) > severityRank(existing.category)) {
      m.set(e.address, e);
    }
  }
  return m;
})();

function severityRank(cat: LabelEntry["category"]): number {
  switch (cat) {
    case "sanctioned":
      return 100;
    case "mixer":
      return 80;
    case "phishing":
    case "scam":
    case "exploit":
      return 70;
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

export function lookupLabel(address: string): LabelEntry | undefined {
  return INDEX.get(address.toLowerCase());
}

export function listSnapshots(): ListSnapshotMeta[] {
  return [
    { source: "OFAC SDN (seed)", version: OFAC_VERSION, updatedAtMs: OFAC_UPDATED_AT_MS, size: OFAC_SDN.length },
    { source: "Mixers (community)", version: MIXERS_VERSION, updatedAtMs: MIXERS_UPDATED_AT_MS, size: MIXERS.length },
    { source: "CEX hot wallets", version: CEX_VERSION, updatedAtMs: CEX_UPDATED_AT_MS, size: CEX_ADDRESSES.length },
    { source: "Bridges", version: BRIDGES_VERSION, updatedAtMs: BRIDGES_UPDATED_AT_MS, size: BRIDGES.length },
    { source: "DeFi known", version: DEFI_VERSION, updatedAtMs: DEFI_UPDATED_AT_MS, size: DEFI_KNOWN.length },
  ];
}

export function listsVersionHash(): string {
  const parts = listSnapshots().map((s) => `${s.source}:${s.version}`);
  return parts.join("|");
}
