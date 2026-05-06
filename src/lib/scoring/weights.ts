/** Max points trust can add to `walletScore` (on top of 100 − riskScore). Capped in engine. */
export const TRUST_WALLET_BOOST_MAX = 15;

/**
 * How aggressively each point of Risk burden subtracts from the headline `walletScore`.
 * 1.5 means a Risk burden of 6 removes 9 points, 20 removes 30, etc. Result is clamped to [0, 100].
 */
export const RISK_PENALTY_MULTIPLIER = 1.5;

export const WEIGHTS = {
  directSanctioned: 90,
  selfSanctioned: 100,
  directMixer: 55,
  directPhishingOrScam: 60,
  directExploit: 65,
  directDarknetMarket: 80,
  directRansom: 75,
  directGambling: 25,
  directExchangeUnlicensed: 25,
  mixerVolumeShareMultiplier: 1.2,
  largeShareToUnknown: 12,
  burstActivityYoung: 8,
  noTrustSignalPenalty: 6,
  veryLowCoverage: 28,
  lowCoverage: 18,
  mediumCoverage: 8,
  veryYoungWallet: 20,
  youngWallet: 16,
  recentWallet: 10,
  mostlyUnknownCounterparties: 6,
  partialChainCoverage: 6,
} as const;

export const TRUST_WEIGHTS = {
  longevity365d: 25,
  longevity180d: 15,
  longevity90d: 8,
  cexInteraction: 20,
  defiInteraction: 10,
  bridgeInteraction: 5,
  diverseCounterparties: 15,
} as const;

export const METHODOLOGY_VERSION = "mvp-1.4.0";
