import type { ChainId } from "./chains";

export type RiskSeverity = "info" | "low" | "medium" | "high" | "severe";
export type ConfidenceLevel = "low" | "medium" | "high";
export type AlertGrade = "none" | "low" | "medium" | "high";

export type RiskSignalKey =
  | "exchange_licensed"
  | "exchange_unlicensed"
  | "exchange_fraudulent"
  | "mixer"
  | "dark_market"
  | "dark_service"
  | "scam"
  | "ransom"
  | "stolen_coins"
  | "sanctions"
  | "terrorism_financing"
  | "gambling"
  | "miner"
  | "atm"
  | "wallet"
  | "payment"
  | "marketplace"
  | "liquidity_pools"
  | "illegal_service"
  | "child_exploitation"
  | "seized_assets";

export type RiskSignals = Record<RiskSignalKey, number>;

export interface ApiCounterpartyConnection {
  address: string;
  name?: string;
  type: string;
  hops: number;
  exposure: number;
  via?: string;
}

export interface ApiCounterparty {
  id: number;
  address: string;
  name?: string;
  type: string;
  received_fiat_amount: number;
  sent_fiat_amount: number;
  signals: {
    bwd: RiskSignals;
    fwd: RiskSignals;
  };
  connections: ApiCounterpartyConnection[];
}

export interface ApiRiskScoreProfile {
  id: string;
  name: string;
  version: string;
  signals: RiskSignals;
  factors: RiskFactor[];
  data_depth: {
    max_depth: number;
    fanout_per_node: number;
    wallets_scanned: number;
    exposures: number;
  };
}

export interface ApiFields extends RiskSignals {
  id: string;
  status: "processed" | "partial" | "failed";
  address: string;
  currency: string;
  amount: number;
  fiat: number;
  fiat_code_effective: string;
  direction: "address_check";
  tx: string | null;
  time: number;
  is_pool: boolean;
  token_id: number | null;
  riskscore: number;
  risky_volume: number;
  risky_volume_fiat: number;
  riskscore_profile: ApiRiskScoreProfile;
  alert_grade: AlertGrade;
  alert_type: string[];
  flagged: "none" | "watch" | "flagged";
  flag_reason: string[];
  archived: boolean;
  counterparty: ApiCounterparty[];
  customer: { name: string | null };
  customer_watched: boolean;
  calls_left: number | null;
  calls_used: number | null;
  error_code: number | null;
}

export interface LabelEntry {
  address: string;
  category: LabelCategory;
  name?: string;
  source: string;
  sourceUrl?: string;
}

export type LabelCategory =
  | "sanctioned"
  | "mixer"
  | "phishing"
  | "scam"
  | "exploit"
  | "cex"
  | "bridge"
  | "dex"
  | "lending"
  | "defi"
  | "marketplace";

export interface Counterparty {
  address: string;
  txCount: number;
  label?: LabelEntry;
  direction: "in" | "out" | "both";
}

export interface GraphExposure {
  address: string;
  label: LabelEntry;
  depth: number;
  via: string;
  chainId: ChainId;
}

export interface GraphScan {
  maxDepth: number;
  fanoutPerNode: number;
  walletsScanned: number;
  uniqueWallets: number;
  exposures: GraphExposure[];
}

export interface ChainFacts {
  chainId: ChainId;
  available: boolean;
  error?: string;
  balanceWei?: string;
  txCount: number;
  firstSeenMs?: number;
  lastSeenMs?: number;
  uniqueCounterparties: number;
  topCounterparties: Counterparty[];
  hitLabels: LabelEntry[];
  graph?: GraphScan;
  scanned: {
    normalTxs: number;
    tokenTxs: number;
  };
}

export interface RiskFactor {
  id: string;
  severity: RiskSeverity;
  weight: number;
  title: string;
  description: string;
  chainId?: ChainId;
  evidence?: {
    address?: string;
    txHash?: string;
    url?: string;
    label?: string;
  }[];
  source: string;
}

export interface TrustSignal {
  id: string;
  title: string;
  description: string;
  weight: number;
}

export interface AddressReport extends ApiFields {
  address: string;
  methodologyVersion: string;
  createdAtMs: number;
  expiresAtMs: number;
  /** Single headline metric: 0–100, **100 = best** (cleanest / most favorable). */
  walletScore: number;
  /** Internal risk sum (0–100), higher = more negative signals; shown for transparency. */
  riskScore: number;
  trustScore: number;
  confidence: ConfidenceLevel;
  /** API-compatible top-level fields for downstream consumers. */
  alertGrade: AlertGrade;
  alertType: string[];
  flagged: "none" | "watch" | "flagged";
  flagReason: string[];
  riskyVolume: number;
  riskyVolumeFiat: number;
  signals: RiskSignals;
  dataDepth: {
    maxDepth: number;
    fanoutPerNode: number;
    walletsScanned: number;
    exposures: number;
  };
  summary: {
    totalTxs: number;
    activeChains: number;
    ageDays?: number;
    hasSanctionHit: boolean;
    hasMixerHit: boolean;
  };
  chains: ChainFacts[];
  factors: RiskFactor[];
  trust: TrustSignal[];
  listVersions: { source: string; version: string; updatedAtMs: number }[];
}

export interface PartialReportProgress {
  chainId: ChainId;
  status: "pending" | "loading" | "done" | "error";
  error?: string;
}
