# Scoring methodology

**Version:** `mvp-1.2.0`

WalletLens reports expose a **headline `walletScore` (0-100, 100 = strongest)**, the underlying **risk burden** and **trust** raw scores, and **confidence** (coverage), plus a factor list.

| Metric         | Range | Meaning                                                                                    |
| -------------- | ----- | ------------------------------------------------------------------------------------------ |
| `walletScore`  | 0-100 | **100 = strongest.** `min(100, 100 - riskScore + trustBoost)`, with uncertainty penalties. |
| `riskScore`    | 0-100 | Sum of negative factors and uncertainty factors (capped). Higher = more risk / uncertainty. |
| `trustScore`   | 0-100 | Sum of positive attribution signal weights (capped). Feeds a limited boost to the headline. |
| `confidence`   | l/m/h | How much on-chain activity we observed — not a "safety" guarantee.                        |
| `alertGrade`   | enum  | Alert grade: `none`, `low`, `medium`, `high`.                                            |
| `signals`      | 0-1   | Normalized category map (`sanctions`, `mixer`, `scam`, etc.).                            |

`TRUST_WALLET_BOOST_MAX` is **15** — trust can only improve the headline by up to 15 points; it cannot override severe risk entirely.

## Factors & weights (risk)

| ID prefix                 | Trigger                                               | Weight |
| ------------------------- | ----------------------------------------------------- | ------ |
| `sanctioned:self`         | Address itself is on the OFAC SDN snapshot            | 100    |
| `sanctioned:*`            | Direct counterparty is on OFAC SDN                    | 90     |
| `mixer:*`                 | Direct counterparty is a mixer / privacy pool         | 55     |
| `exploit:*`               | Direct counterparty is a known exploit address         | 65     |
| `phishing:*` / `scam:*`   | Direct counterparty is community-flagged              | 60     |
| `burst-young`             | Wallet <14d old with >50 tx (heuristic)               | 8      |

## Trust weights (raw sum → `trustScore`)

| ID                       | Trigger                            | Weight |
| ------------------------ | ---------------------------------- | ------ |
| `longevity-365`          | First tx 1+ year ago               | 25     |
| `longevity-180`          | First tx 6+ months ago              | 15     |
| `longevity-90`           | First tx 3+ months ago              | 8      |
| `cex:*`                  | Interacted with a major CEX wallet  | 20     |
| `defi:*`                 | Interacted with attributed DeFi     | 10     |
| `bridge:*`               | Used a known bridge contract        | 5      |
| `diverse-counterparties` | ≥ 50 unique counterparties         | 15     |

## Confidence tiers

- `high` — ≥ 200 observed transactions
- `medium` — 10 ≤ tx < 200
- `low` — < 10 tx (report is inconclusive)

## Design principles

1. **One comparable headline** — `walletScore` is oriented so that **higher = better**; internal risk remains auditable.
2. **Every factor is falsifiable.** Each row in the report lists its weight, source and a link to the chain explorer.
3. **Public data only (MVP).** We do not publish accusations. We surface *matches* and *heuristics* with confidence.
4. **Pluggable provider.** The `RiskDataProvider` interface allows a licensed oracle without UI changes.
