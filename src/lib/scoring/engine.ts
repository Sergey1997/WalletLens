import type { ChainId } from "../chains";
import { CHAIN_BY_ID } from "../chains";
import { listSnapshots } from "../lists";
import type {
  AddressReport,
  AlertGrade,
  ApiCounterparty,
  ApiCounterpartyConnection,
  ApiFields,
  ChainFacts,
  ConfidenceLevel,
  LabelEntry,
  RiskSignals,
  RiskFactor,
  RiskSeverity,
  TrustSignal,
} from "../types";
import { daysBetween } from "../utils";
import { log, logDebug } from "../logger";
import { METHODOLOGY_VERSION, RISK_PENALTY_MULTIPLIER, TRUST_WALLET_BOOST_MAX, TRUST_WEIGHTS, WEIGHTS } from "./weights";

interface ScoreInput {
  address: string;
  chains: ChainFacts[];
  ttlSeconds: number;
}

function severityFor(weight: number): RiskSeverity {
  if (weight >= 80) return "severe";
  if (weight >= 50) return "high";
  if (weight >= 25) return "medium";
  if (weight >= 10) return "low";
  return "info";
}

function factorKey(parts: (string | number | undefined)[]) {
  return parts.filter(Boolean).join(":");
}

function pushFactorDedup(list: RiskFactor[], f: RiskFactor) {
  if (!list.some((x) => x.id === f.id)) list.push(f);
}

function emptySignals(): RiskSignals {
  return {
    exchange_licensed: 0,
    exchange_unlicensed: 0,
    exchange_fraudulent: 0,
    mixer: 0,
    dark_market: 0,
    dark_service: 0,
    scam: 0,
    ransom: 0,
    stolen_coins: 0,
    sanctions: 0,
    terrorism_financing: 0,
    gambling: 0,
    miner: 0,
    atm: 0,
    wallet: 0,
    payment: 0,
    marketplace: 0,
    liquidity_pools: 0,
    illegal_service: 0,
    child_exploitation: 0,
    seized_assets: 0,
  };
}

function setMax(signals: RiskSignals, key: keyof RiskSignals, value: number) {
  signals[key] = Math.max(signals[key], Math.min(1, Math.max(0, value)));
}

function alertGradeFor(riskScore: number): AlertGrade {
  if (riskScore >= 75) return "high";
  if (riskScore >= 45) return "medium";
  if (riskScore >= 15) return "low";
  return "none";
}

function baseWeightForCategory(category: LabelEntry["category"]): number {
  switch (category) {
    case "sanctioned":
      return WEIGHTS.directSanctioned;
    case "mixer":
      return WEIGHTS.directMixer;
    case "exploit":
      return WEIGHTS.directExploit;
    case "phishing":
    case "scam":
      return WEIGHTS.directPhishingOrScam;
    case "darknet_market":
      return WEIGHTS.directDarknetMarket;
    case "ransom":
      return WEIGHTS.directRansom;
    case "gambling":
      return WEIGHTS.directGambling;
    case "exchange_unlicensed":
      return WEIGHTS.directExchangeUnlicensed;
    default:
      return 0;
  }
}

function stableId(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function signalFromLabel(label?: LabelEntry): RiskSignals {
  const s = emptySignals();
  if (!label) return s;
  switch (label.category) {
    case "sanctioned":
      setMax(s, "sanctions", 1);
      break;
    case "mixer":
      setMax(s, "mixer", 1);
      break;
    case "phishing":
    case "scam":
      setMax(s, "scam", 1);
      break;
    case "exploit":
      setMax(s, "stolen_coins", 1);
      break;
    case "darknet_market":
      setMax(s, "dark_market", 1);
      break;
    case "ransom":
      setMax(s, "ransom", 1);
      break;
    case "gambling":
      setMax(s, "gambling", 0.6);
      break;
    case "exchange_unlicensed":
      setMax(s, "exchange_unlicensed", 0.7);
      break;
    case "cex":
      setMax(s, "exchange_licensed", 0.2);
      break;
    case "dex":
    case "lending":
    case "defi":
      setMax(s, "liquidity_pools", 0.15);
      break;
    case "marketplace":
      setMax(s, "marketplace", 0.15);
      break;
    case "bridge":
      setMax(s, "payment", 0.1);
      break;
  }
  return s;
}

function mergeSignals(target: RiskSignals, source: RiskSignals, decay = 1) {
  for (const key of Object.keys(target) as (keyof RiskSignals)[]) {
    setMax(target, key, source[key] * decay);
  }
}

function counterpartyType(label?: LabelEntry): string {
  return label?.category ?? "wallet";
}

function buildApiCounterparties(chains: ChainFacts[]): ApiCounterparty[] {
  const byAddress = new Map<string, ApiCounterparty>();

  for (const chain of chains) {
    for (const cp of chain.topCounterparties) {
      const address = cp.address.toLowerCase();
      const existing =
        byAddress.get(address) ??
        ({
          id: stableId(address),
          address,
          name: cp.label?.name,
          type: counterpartyType(cp.label),
          received_fiat_amount: 0,
          sent_fiat_amount: 0,
          signals: { bwd: emptySignals(), fwd: emptySignals() },
          connections: [],
        } satisfies ApiCounterparty);
      mergeSignals(existing.signals.bwd, signalFromLabel(cp.label));
      mergeSignals(existing.signals.fwd, signalFromLabel(cp.label));
      if (!existing.name && cp.label?.name) existing.name = cp.label.name;
      if (existing.type === "wallet" && cp.label) existing.type = counterpartyType(cp.label);
      byAddress.set(address, existing);
    }

    for (const exposure of chain.graph?.exposures ?? []) {
      const address = exposure.address.toLowerCase();
      const existing =
        byAddress.get(address) ??
        ({
          id: stableId(address),
          address,
          type: "wallet",
          received_fiat_amount: 0,
          sent_fiat_amount: 0,
          signals: { bwd: emptySignals(), fwd: emptySignals() },
          connections: [],
        } satisfies ApiCounterparty);
      const decay = exposure.depth === 1 ? 0.65 : exposure.depth === 2 ? 0.35 : 0.18;
      mergeSignals(existing.signals.bwd, signalFromLabel(exposure.label), decay);
      const connection: ApiCounterpartyConnection = {
        address: exposure.label.address.toLowerCase(),
        name: exposure.label.name,
        type: exposure.label.category,
        hops: exposure.depth,
        exposure: decay,
        via: exposure.via,
      };
      if (!existing.connections.some((c) => c.address === connection.address && c.hops === connection.hops)) {
        existing.connections.push(connection);
      }
      byAddress.set(address, existing);
    }
  }

  return Array.from(byAddress.values())
    .sort((a, b) => b.connections.length - a.connections.length)
    .slice(0, 50);
}

export function scoreAddress(input: ScoreInput): AddressReport {
  const now = Date.now();
  const factors: RiskFactor[] = [];
  const trust: TrustSignal[] = [];

  let totalTxs = 0;
  let activeChains = 0;
  let firstSeenMs: number | undefined;
  let hasSanctionHit = false;
  let hasMixerHit = false;
  let graphWalletsScanned = 0;
  let graphExposures = 0;
  let graphMaxDepth = 0;
  let graphFanoutPerNode = 0;

  for (const chain of input.chains) {
    if (!chain.available) continue;
    if (chain.txCount > 0) activeChains += 1;
    totalTxs += chain.txCount;
    if (chain.firstSeenMs) {
      firstSeenMs = firstSeenMs ? Math.min(firstSeenMs, chain.firstSeenMs) : chain.firstSeenMs;
    }
    if (chain.graph) {
      graphWalletsScanned += chain.graph.walletsScanned;
      graphExposures += chain.graph.exposures.length;
      graphMaxDepth = Math.max(graphMaxDepth, chain.graph.maxDepth);
      graphFanoutPerNode = Math.max(graphFanoutPerNode, chain.graph.fanoutPerNode);
    }

    for (const label of chain.hitLabels) {
      const isSelf = label.address.toLowerCase() === input.address.toLowerCase();
      if (label.category === "sanctioned") {
        hasSanctionHit = true;
        pushFactorDedup(factors, {
          id: factorKey(["sanctioned", chain.chainId, label.address]),
          severity: "severe",
          weight: isSelf ? WEIGHTS.selfSanctioned : WEIGHTS.directSanctioned,
          title: isSelf
            ? "Address matches a public sanctions list"
            : "Direct interaction with a sanctioned address",
          description: isSelf
            ? `This address appears on the ${label.source} list as "${label.name ?? "sanctioned entity"}".`
            : `Transacted with ${label.name ?? label.address} (${label.source}).`,
          chainId: chain.chainId,
          evidence: [
            {
              address: label.address,
              label: label.name,
              url: label.sourceUrl ?? `${CHAIN_BY_ID[chain.chainId].explorerUrl}/address/${label.address}`,
            },
          ],
          source: label.source,
        });
      } else if (label.category === "mixer") {
        hasMixerHit = true;
        pushFactorDedup(factors, {
          id: factorKey(["mixer", chain.chainId, label.address]),
          severity: "high",
          weight: WEIGHTS.directMixer,
          title: "Direct interaction with a mixer / privacy pool",
          description: `Counterparty ${label.name ?? label.address} is labeled as a mixer. Elevated risk signal; not definitive.`,
          chainId: chain.chainId,
          evidence: [
            {
              address: label.address,
              label: label.name,
              url: `${CHAIN_BY_ID[chain.chainId].explorerUrl}/address/${label.address}`,
            },
          ],
          source: label.source,
        });
      } else if (label.category === "phishing" || label.category === "scam" || label.category === "exploit") {
        pushFactorDedup(factors, {
          id: factorKey([label.category, chain.chainId, label.address]),
          severity: "high",
          weight:
            label.category === "exploit"
              ? WEIGHTS.directExploit
              : WEIGHTS.directPhishingOrScam,
          title: `Direct interaction with a ${label.category} address`,
          description: `Counterparty ${label.name ?? label.address} is community-flagged as ${label.category}.`,
          chainId: chain.chainId,
          evidence: [{ address: label.address, label: label.name }],
          source: label.source,
        });
      } else if (
        label.category === "darknet_market" ||
        label.category === "ransom" ||
        label.category === "gambling" ||
        label.category === "exchange_unlicensed"
      ) {
        const weight =
          label.category === "darknet_market"
            ? WEIGHTS.directDarknetMarket
            : label.category === "ransom"
              ? WEIGHTS.directRansom
              : label.category === "gambling"
                ? WEIGHTS.directGambling
                : WEIGHTS.directExchangeUnlicensed;
        const titleByCat: Record<string, string> = {
          darknet_market: "Direct interaction with a darknet market",
          ransom: "Direct interaction with a ransomware-linked address",
          gambling: "Direct interaction with a gambling service",
          exchange_unlicensed: "Direct interaction with an unlicensed exchange",
        };
        pushFactorDedup(factors, {
          id: factorKey([label.category, chain.chainId, label.address]),
          severity: severityFor(weight),
          weight,
          title: titleByCat[label.category],
          description: `Counterparty ${label.name ?? label.address} is in the risk directory as ${label.category}.`,
          chainId: chain.chainId,
          evidence: [
            {
              address: label.address,
              label: label.name,
              url: label.sourceUrl ?? `${CHAIN_BY_ID[chain.chainId].explorerUrl}/address/${label.address}`,
            },
          ],
          source: label.source,
        });
      }
    }

    const knownPositives = chain.topCounterparties.filter((cp) =>
      cp.label && ["cex", "dex", "lending", "defi", "marketplace", "bridge"].includes(cp.label.category)
    );
    if (knownPositives.some((cp) => cp.label?.category === "cex")) {
      trust.push({
        id: factorKey(["cex", chain.chainId]),
        title: `Interacted with a major CEX on ${CHAIN_BY_ID[chain.chainId].name}`,
        description: "Known exchange counterparty is a positive public-attribution signal.",
        weight: TRUST_WEIGHTS.cexInteraction,
      });
    }
    if (knownPositives.some((cp) => ["dex", "defi", "lending", "marketplace"].includes(cp.label!.category))) {
      trust.push({
        id: factorKey(["defi", chain.chainId]),
        title: `Interacted with established DeFi on ${CHAIN_BY_ID[chain.chainId].name}`,
        description: "Attributed protocol counterparty increases confidence in wallet profile.",
        weight: TRUST_WEIGHTS.defiInteraction,
      });
    }
    if (knownPositives.some((cp) => cp.label?.category === "bridge")) {
      trust.push({
        id: factorKey(["bridge", chain.chainId]),
        title: `Used a known bridge on ${CHAIN_BY_ID[chain.chainId].name}`,
        description: "Cross-chain activity via attributed bridge contract.",
        weight: TRUST_WEIGHTS.bridgeInteraction,
      });
    }

    for (const exposure of chain.graph?.exposures ?? []) {
      const decay = exposure.depth === 1 ? 0.65 : exposure.depth === 2 ? 0.35 : 0.18;
      const base = baseWeightForCategory(exposure.label.category);
      if (base <= 0) continue;
      if (exposure.label.category === "sanctioned") hasSanctionHit = true;
      if (exposure.label.category === "mixer") hasMixerHit = true;
      const weight = Math.max(1, Math.round(base * decay));
      pushFactorDedup(factors, {
        id: factorKey(["graph", exposure.label.category, chain.chainId, exposure.depth, exposure.label.address]),
        severity: severityFor(weight),
        weight,
        title: `${exposure.depth}-hop exposure to ${exposure.label.category}`,
        description: `Graph scan found ${exposure.label.name ?? exposure.label.address} within ${exposure.depth} hop(s). Weight is decayed by distance.`,
        chainId: chain.chainId,
        evidence: [
          {
            address: exposure.label.address,
            label: exposure.label.name,
            url: exposure.label.sourceUrl ?? `${CHAIN_BY_ID[chain.chainId].explorerUrl}/address/${exposure.label.address}`,
          },
          {
            address: exposure.via,
            label: "via counterparty",
            url: `${CHAIN_BY_ID[chain.chainId].explorerUrl}/address/${exposure.via}`,
          },
        ],
        source: `${exposure.label.source} + graph-depth-${exposure.depth}`,
      });
    }
  }

  const ageDays = firstSeenMs ? daysBetween(firstSeenMs) : undefined;
  if (ageDays !== undefined) {
    if (ageDays >= 365) {
      trust.push({
        id: "longevity-365",
        title: "Long-lived wallet (1y+)",
        description: `First seen ~${ageDays} days ago across scanned chains.`,
        weight: TRUST_WEIGHTS.longevity365d,
      });
    } else if (ageDays >= 180) {
      trust.push({
        id: "longevity-180",
        title: "Established wallet (6m+)",
        description: `First seen ~${ageDays} days ago.`,
        weight: TRUST_WEIGHTS.longevity180d,
      });
    } else if (ageDays >= 90) {
      trust.push({
        id: "longevity-90",
        title: "Maturing wallet (3m+)",
        description: `First seen ~${ageDays} days ago.`,
        weight: TRUST_WEIGHTS.longevity90d,
      });
    } else if (ageDays < 14 && totalTxs > 50) {
      factors.push({
        id: "burst-young",
        severity: "low",
        weight: WEIGHTS.burstActivityYoung,
        title: "Young wallet with burst activity",
        description: `Wallet is <14 days old with ${totalTxs}+ tx — worth manual review.`,
        source: "heuristic",
      });
    }
  }

  const uniqueCps = input.chains.reduce((s, c) => s + (c.available ? c.uniqueCounterparties : 0), 0);
  if (uniqueCps >= 50) {
    trust.push({
      id: "diverse-counterparties",
      title: "Diverse counterparties",
      description: `${uniqueCps} unique counterparties across chains.`,
      weight: TRUST_WEIGHTS.diverseCounterparties,
    });
  }

  if (totalTxs > 0 && totalTxs < 5) {
    pushFactorDedup(factors, {
      id: "coverage-very-low",
      severity: "medium",
      weight: WEIGHTS.veryLowCoverage,
      title: "Very limited transaction history",
      description: `Only ${totalTxs} transaction(s) were observed. The score is reduced because there is too little evidence.`,
      source: "coverage-heuristic",
    });
  } else if (totalTxs >= 5 && totalTxs < 20) {
    pushFactorDedup(factors, {
      id: "coverage-low",
      severity: "low",
      weight: WEIGHTS.lowCoverage,
      title: "Limited transaction history",
      description: `${totalTxs} observed transactions is not enough to treat the wallet as fully established.`,
      source: "coverage-heuristic",
    });
  } else if (totalTxs >= 20 && totalTxs < 50) {
    pushFactorDedup(factors, {
      id: "coverage-medium",
      severity: "low",
      weight: WEIGHTS.mediumCoverage,
      title: "Moderate transaction history",
      description: `${totalTxs} observed transactions gives some coverage, but still leaves meaningful uncertainty.`,
      source: "coverage-heuristic",
    });
  }

  if (ageDays !== undefined && totalTxs > 0) {
    if (ageDays < 14) {
      pushFactorDedup(factors, {
        id: "age-very-young",
        severity: "medium",
        weight: WEIGHTS.veryYoungWallet,
        title: "Very young wallet",
        description: `First seen about ${ageDays} day(s) ago. New wallets receive a stricter score until more history exists.`,
        source: "age-heuristic",
      });
    } else if (ageDays < 45) {
      pushFactorDedup(factors, {
        id: "age-young",
        severity: "low",
        weight: WEIGHTS.youngWallet,
        title: "Young wallet",
        description: `First seen about ${ageDays} day(s) ago. This is below the maturity threshold for a top score.`,
        source: "age-heuristic",
      });
    } else if (ageDays < 90) {
      pushFactorDedup(factors, {
        id: "age-recent",
        severity: "low",
        weight: WEIGHTS.recentWallet,
        title: "Recent wallet",
        description: `First seen about ${ageDays} day(s) ago. Recent activity carries extra uncertainty.`,
        source: "age-heuristic",
      });
    }
  }

  const labeledTop = input.chains.reduce(
    (s, c) => s + (c.available ? c.topCounterparties.filter((cp) => cp.label).length : 0),
    0
  );
  const topCounterparties = input.chains.reduce((s, c) => s + (c.available ? c.topCounterparties.length : 0), 0);
  const labelRatio = topCounterparties > 0 ? labeledTop / topCounterparties : 0;
  if (uniqueCps >= 5 && labelRatio < 0.15) {
    pushFactorDedup(factors, {
      id: "counterparties-mostly-unknown",
      severity: "low",
      weight: WEIGHTS.mostlyUnknownCounterparties,
      title: "Mostly unattributed counterparties",
      description: "Most top counterparties are not in public attribution lists, so the score keeps an uncertainty discount.",
      source: "counterparty-heuristic",
    });
  }

  const failedChains = input.chains.filter((c) => !c.available).length;
  if (failedChains > 0 && totalTxs > 0) {
    pushFactorDedup(factors, {
      id: "partial-chain-coverage",
      severity: "low",
      weight: Math.min(18, failedChains * WEIGHTS.partialChainCoverage),
      title: "Partial chain coverage",
      description: `${failedChains} chain source(s) were unavailable or incomplete during this check.`,
      source: "coverage-heuristic",
    });
  }

  const rawRisk = factors.reduce((s, f) => s + f.weight, 0);
  const riskScore = Math.min(100, Math.round(rawRisk));

  const rawTrust = trust.reduce((s, t) => s + t.weight, 0);
  const trustScore = Math.min(100, Math.round(rawTrust));

  /**
   * Headline: 0–100, **100 = best**.
   * Each point of Risk burden subtracts `RISK_PENALTY_MULTIPLIER` points from the score so
   * mid-range risk is meaningfully visible (e.g. risk 6 → −9 pts, risk 20 → −30 pts).
   */
  const trustBoost = (trustScore / 100) * TRUST_WALLET_BOOST_MAX;
  const effectivePenalty = riskScore * RISK_PENALTY_MULTIPLIER;
  const walletScore = Math.min(100, Math.max(0, Math.round(100 - effectivePenalty + trustBoost)));

  const confidence: ConfidenceLevel = totalTxs < 10 ? "low" : totalTxs < 200 ? "medium" : "high";

  for (const f of factors) f.severity = severityFor(f.weight);

  factors.sort((a, b) => b.weight - a.weight);
  trust.sort((a, b) => b.weight - a.weight);

  const signals = emptySignals();
  for (const factor of factors) {
    const v = Math.min(1, factor.weight / 100);
    if (factor.id.startsWith("sanctioned")) setMax(signals, "sanctions", v);
    if (factor.id.startsWith("mixer")) setMax(signals, "mixer", v);
    if (factor.id.startsWith("phishing") || factor.id.startsWith("scam")) setMax(signals, "scam", v);
    if (factor.id.startsWith("exploit")) setMax(signals, "stolen_coins", v);
    if (factor.id.startsWith("darknet_market") || factor.id.startsWith("graph:darknet_market"))
      setMax(signals, "dark_market", v);
    if (factor.id.startsWith("ransom") || factor.id.startsWith("graph:ransom"))
      setMax(signals, "ransom", v);
    if (factor.id.startsWith("gambling") || factor.id.startsWith("graph:gambling"))
      setMax(signals, "gambling", v);
    if (
      factor.id.startsWith("exchange_unlicensed") ||
      factor.id.startsWith("graph:exchange_unlicensed")
    )
      setMax(signals, "exchange_unlicensed", v);
    if (factor.id === "burst-young") setMax(signals, "wallet", v);
  }
  for (const t of trust) {
    if (t.id.startsWith("cex")) setMax(signals, "exchange_licensed", Math.min(1, t.weight / 100));
    if (t.id.startsWith("defi")) setMax(signals, "liquidity_pools", Math.min(1, t.weight / 100));
    if (t.id.startsWith("bridge")) setMax(signals, "payment", Math.min(1, t.weight / 100));
  }

  const alertGrade = alertGradeFor(riskScore);
  const alertType = Object.entries(signals)
    .filter(([, value]) => value > 0)
    .map(([key]) => key);
  const flagged = alertGrade === "high" ? "flagged" : alertGrade === "medium" ? "watch" : "none";
  const flagReason = factors.map((f) => f.title);
  const partial = input.chains.some((c) => !c.available || c.error);
  const counterparty = buildApiCounterparties(input.chains);
  const checkId = `check_${stableId(`${input.address.toLowerCase()}:${now}`)}`;
  const apiFields: ApiFields = {
    ...signals,
    id: checkId,
    status: partial ? "partial" : "processed",
    address: input.address.toLowerCase(),
    currency: "evm",
    amount: 0,
    fiat: 0,
    fiat_code_effective: "USD",
    direction: "address_check",
    tx: null,
    time: Math.floor(now / 1000),
    is_pool: signals.liquidity_pools > 0,
    token_id: null,
    riskscore: Math.round((riskScore / 100) * 10_000) / 10_000,
    risky_volume: 0,
    risky_volume_fiat: 0,
    riskscore_profile: {
      id: "public-composite",
      name: "Public Signals + Graph Exposure",
      version: METHODOLOGY_VERSION,
      signals,
      factors,
      data_depth: {
        max_depth: graphMaxDepth,
        fanout_per_node: graphFanoutPerNode,
        wallets_scanned: graphWalletsScanned,
        exposures: graphExposures,
      },
    },
    alert_grade: alertGrade,
    alert_type: alertType,
    flagged,
    flag_reason: flagReason,
    archived: false,
    counterparty,
    customer: { name: null },
    customer_watched: false,
    calls_left: null,
    calls_used: null,
    error_code: partial ? 206 : null,
  };

  log("scoring", "info", "score_computed", {
    address: input.address.toLowerCase(),
    rawRisk: Math.round(rawRisk),
    riskScore,
    riskPenaltyMultiplier: RISK_PENALTY_MULTIPLIER,
    effectivePenalty: Math.round(effectivePenalty * 10) / 10,
    rawTrust: Math.round(rawTrust),
    trustScore,
    trustBoost: Math.round((trustScore / 100) * TRUST_WALLET_BOOST_MAX * 100) / 100,
    walletScore,
    confidence,
    factorCount: factors.length,
    trustSignalCount: trust.length,
    factorIds: factors.map((f) => f.id),
    alertGrade,
    flagged,
    graphWalletsScanned,
    graphExposures,
  });
  logDebug("scoring", "factors_detail", {
    factors: factors.map((f) => ({ id: f.id, weight: f.weight, severity: f.severity, source: f.source })),
  });
  logDebug("scoring", "trust_detail", { trust: trust.map((t) => ({ id: t.id, weight: t.weight })) });

  return {
    ...apiFields,
    address: input.address.toLowerCase(),
    methodologyVersion: METHODOLOGY_VERSION,
    createdAtMs: now,
    expiresAtMs: now + input.ttlSeconds * 1000,
    walletScore,
    riskScore,
    trustScore,
    confidence,
    alertGrade,
    alertType,
    flagged,
    flagReason,
    riskyVolume: 0,
    riskyVolumeFiat: 0,
    signals,
    dataDepth: {
      maxDepth: graphMaxDepth,
      fanoutPerNode: graphFanoutPerNode,
      walletsScanned: graphWalletsScanned,
      exposures: graphExposures,
    },
    summary: {
      totalTxs,
      activeChains,
      ageDays,
      hasSanctionHit,
      hasMixerHit,
    },
    chains: input.chains,
    factors,
    trust,
    listVersions: listSnapshots().map((s) => ({
      source: s.source,
      version: s.version,
      updatedAtMs: s.updatedAtMs,
    })),
  };
}

export function coverageWarning(chains: ChainFacts[]): string | undefined {
  const total = chains.length;
  const failed = chains.filter((c) => !c.available).length;
  if (failed === 0) return undefined;
  if (failed === total) return "All chain sources failed — report is empty.";
  return `${failed} of ${total} chains failed to load — confidence reduced.`;
}
