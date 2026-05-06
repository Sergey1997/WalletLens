# Scoring methodology

**Version:** `mvp-1.4.0` (must stay in sync with `METHODOLOGY_VERSION` in [`src/lib/scoring/weights.ts`](src/lib/scoring/weights.ts))

This document explains **how WalletLens turns an EVM address into a report**, what the headline numbers mean, and how that fits the **Risk Directory**, **graph expansion**, and **report cache**.

For database tables, admin flows, and the architecture diagram, see [`ENGINE.md`](ENGINE.md). For product timeline, see [`ROADMAP.en.md`](ROADMAP.en.md) / [`ROADMAP.ru.md`](ROADMAP.ru.md).

---

## How a report is built (end-to-end)

When someone submits an address on `/` (or `POST /api/report`), the server runs this pipeline:

1. **Rate limit** — per IP against `rate_limit_log` (Supabase) or in-memory fallback.
2. **Cache lookup** — key is roughly  
   `address | methodologyVersion | listsVersionHash | graphDepth | graphFanout`.  
   A hit returns the stored JSON immediately (`cached: true`). Any change to methodology, seed list versions, or directory content changes `listsVersionHash`, so stale conclusions are not reused silently.
3. **Risk Directory warmup** — `ensureLabelIndex()` loads active `risk_entity_addresses` (with `chain_id` set, i.e. EVM rows used for on-chain matching) into an in-memory map, plus **seed lists** from `src/lib/lists/*` (OFAC, mixers, CEX, bridges, DeFi). `lookupLabel()` prefers the **stricter** of a DB hit vs a seed hit for the same address.
4. **Per-chain ingest** — for each configured chain (Ethereum, Base), the `RiskDataProvider` fetches balances/transfers/top counterparties via **Etherscan V2** and **RPC** (e.g. Alchemy). Each counterparty address is resolved through the label index.
5. **Bounded graph expansion** — optional BFS (`GRAPH_MAX_DEPTH`, `GRAPH_FANOUT_PER_NODE`) walks top counterparties and re-resolves labels at each hop. Indirect hits get **decayed** weights (see below).
6. **Scoring** — `scoreAddress()` merges direct label hits and graph exposures into **risk factors** and **trust signals**, then computes `walletScore`, `riskScore`, `trustScore`, `confidence`, `alertGrade`, and normalized `signals`.
7. **Persist** — `saveReport()` writes the JSON to `report_cache`. In the background, `persistExposures()` appends rows to `wallet_exposures` and upserts `taint_candidates` for analyst review (**exposure is not auto-promotion to a blocklist entity**).

**Non-EVM addresses** (BTC, TRX, …) can exist in the directory for catalog and import; the **live wallet check** and resolver index for scoring are **EVM-only** today.

---

## Headline metrics

| Metric         | Range | Meaning                                                                                    |
| -------------- | ----- | ------------------------------------------------------------------------------------------ |
| `walletScore`  | 0–100 | **100 = strongest.** Derived from risk burden, trust boost (capped), and uncertainty penalties. |
| `riskScore`    | 0–100 | Sum of negative and uncertainty factors (capped). Higher ⇒ more risk or uncertainty.     |
| `trustScore`   | 0–100 | Sum of positive attribution weights (capped). Feeds a limited boost to the headline.      |
| `confidence`   | l/m/h | Reflects **how much on-chain activity was observed** — not a guarantee of safety.          |
| `alertGrade`   | enum  | `none`, `low`, `medium`, `high` — derived from risk burden thresholds.                      |
| `signals`      | 0–1   | Normalized category map (sanctions, mixer, scam, etc.) for display and downstream use.       |

`TRUST_WALLET_BOOST_MAX` is **15** — trust can improve the headline by at most 15 points; it cannot fully erase severe risk.

Every report payload includes **`methodologyVersion`** and list snapshot metadata used in the cache key so past reports remain **reproducible** for audit.

---

## Label categories vs directory taxonomy

The database uses a **rich taxonomy** (`risk_categories`, hierarchical). The engine still reasons in a smaller set of **`LabelCategory`** values (sanctioned, mixer, exploit, scam, darknet_market, ransom, …). Directory categories are **mapped** into these engine categories for scoring (see [`src/lib/lists/resolver.ts`](src/lib/lists/resolver.ts)). That keeps the UI/directory expressive while the scoring code stays maintainable.

---

## Direct risk factors (representative weights)

Exact numbers live in [`src/lib/scoring/weights.ts`](src/lib/scoring/weights.ts). Typical **direct** counterparty matches:

| Scenario                         | Weight (illustrative) | Notes |
| -------------------------------- | --------------------: | ----- |
| Self — address on sanctions list |                   100 | `selfSanctioned` |
| Direct — sanctioned counterparty  |                    90 | `directSanctioned` |
| Mixer / privacy pool              |                    55 | `directMixer` |
| Phishing / scam                   |                    60 | `directPhishingOrScam` |
| Exploit / stolen-coins style      |                    65 | `directExploit` |
| Darknet market                    |                    80 | `directDarknetMarket` |
| Ransom-oriented                   |                    75 | `directRansom` |
| Gambling / unlicensed exchange   |                    25 | lower tier |

Additional **uncertainty / behaviour** factors (coverage, wallet age, burst activity, unknown counterparties) use separate weights in the same `WEIGHTS` object.

## Indirect (graph) exposure

When a risky label appears **within N hops** via BFS, the engine applies a **base weight** from the label category, then multiplies by a **depth decay** (e.g. hop 1 ≈ 0.65, hop 2 ≈ 0.35, hop 3 ≈ 0.18 of the direct-style signal). Sanctions and mixer hits through the graph still contribute but are distance-aware.

---

## Trust weights (raw sum → `trustScore`)

| ID / pattern             | Trigger                         | Weight |
| ------------------------ | ------------------------------- | -----: |
| `longevity-*`            | First seen 90d / 180d / 365d+  | 8 / 15 / 25 |
| `cex:*`                  | Major CEX counterparty          |     20 |
| `defi:*`                 | Attributed DeFi / DEX / lending |     10 |
| `bridge:*`               | Known bridge use                |      5 |
| `diverse-counterparties` | Many unique counterparties      |     15 |

---

## Confidence tiers

Based on **observed transaction count** across scanned chains:

- **high** — ≥ 200 transactions  
- **medium** — 10 ≤ tx < 200  
- **low** — < 10 tx (report is weakly supported)

---

## Design principles

1. **One comparable headline** — higher `walletScore` means a better relative standing; underlying factors stay visible.
2. **Every factor is falsifiable** — factors carry source, weight, and explorer or evidence links where applicable.
3. **Public-first MVP** — we surface **matches and heuristics**, not legal accusations. Directory + admin import adds **your** curated intelligence on top of public seeds.
4. **Exposure ≠ blocklist** — automatic graph hits feed **exposure logs** and **taint candidates** for review; they do not silently become sanctioned entities.
5. **Pluggable data** — `RiskDataProvider` and the directory model allow licensed or proprietary feeds without rewriting the report UI.
