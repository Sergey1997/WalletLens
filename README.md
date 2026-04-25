# WalletLens - EVM wallet risk reports

Transparent wallet risk reports across **Ethereum and Base**. Paste an EVM
address to get a **wallet score 0-100 (100 = strongest)**, risk burden / trust / confidence, per-chain profile and clickable
evidence for every factor.

Built on **public signals only** (OFAC SDN snapshot, curated mixer / CEX / bridge / DeFi label sets,
Etherscan V2 and Alchemy RPC ingestion). The architecture is intentionally pluggable so licensed
risk data can be added through the `RiskDataProvider` interface without UI changes.

---

## Stack

- **Next.js 14** (App Router, RSC + Route Handlers)
- **TypeScript**, **Tailwind**, shadcn-style UI primitives, **lucide-react**
- **viem** for EIP-55 address utilities
- **Zod** for request validation
- **Supabase** (Postgres) for report cache, label storage, rate limits (graceful in-memory fallback)

## Quick start

```bash
pnpm install
cp .env.example .env.local
# fill in ETHERSCAN_API_KEY (free) + optional Supabase creds
pnpm dev
```

Open `http://localhost:3000`, paste a wallet (e.g. Vitalik: `0xd8da6bf26964af9d7eed9e03e53415d37aa96045`).

## Environment

| Variable                         | Purpose                                                |
| -------------------------------- | ------------------------------------------------------ |
| `ETHERSCAN_API_KEY`              | One key works across Ethereum + Base via Etherscan V2. |
| `RPC_URL_ETHEREUM` / `RPC_URL_BASE` | Alchemy RPC fallback for balances + `alchemy_getAssetTransfers`. |
| `NEXT_PUBLIC_SUPABASE_URL`       | Supabase project URL (optional).                       |
| `SUPABASE_SERVICE_ROLE_KEY`      | Server-only Supabase service role (never exposed).     |
| `REPORT_CACHE_TTL_SECONDS`       | How long reports are cached (default 3600).            |
| `RATE_LIMIT_PER_MINUTE`          | Sliding-window per IP (default 20).                    |
| `GRAPH_MAX_DEPTH`                | Connected-wallet scan depth, clamped 0–3 (default 2).  |
| `GRAPH_FANOUT_PER_NODE`          | Top counterparties scanned per node, clamped 1–10 (default 3). |
| `LOG_LEVEL`                      | `debug` \| `info` \| `warn` \| `error` — default `info`.  |

Without Supabase credentials the cache and rate-limit degrade gracefully to in-memory.

### Server logs

All server-side steps emit **one JSON object per line** (stdout/stderr). Correlation id: `requestId` in
each line (also returned as **response header** `X-Request-Id`). Scopes: `api/report`, `rate-limit`, `cache`,
`etherscan`, `scoring`. Set `LOG_LEVEL=debug` in `.env.local` to see every Etherscan API sub-call and cache decision.
Example: `{"ts":"...","level":"info","scope":"api/report","msg":"response_fresh","walletScore":92,...}`.

## Supabase setup

```bash
# apply schema (one-off)
supabase db push --linked
```

See [`supabase/migrations/20260423000000_init.sql`](supabase/migrations/20260423000000_init.sql).
RLS is enabled on all tables with no policies — clients cannot read directly; the service role key
(server-only) bypasses RLS.

## Architecture

```
UI (Next.js RSC)
  └─ /api/report  (Node runtime)
       ├─ rate limit (Supabase + in-mem)
       ├─ cache lookup (Supabase + in-mem)
       ├─ ChainOrchestrator
       │    └─ RiskDataProvider (PublicCompositeProvider → Etherscan V2)
       ├─ ScoringEngine (weights.ts + engine.ts)
       └─ cache upsert
```

## Extending

- **Add a chain**: append to `src/lib/chains.ts`; everything else is generic.
- **Plug a licensed oracle**: implement `RiskDataProvider` (`src/lib/providers/types.ts`) and swap
  `defaultProvider` in `public-composite.ts`.
- **Expand lists**: drop entries into `src/lib/lists/*.ts`, bump the `_VERSION` constant. Alternatively,
  populate `public.label_entries` in Supabase and add a reader (TODO).

## Disclaimer

WalletLens surfaces **public signals** and does not publish accusations. For regulated workflows,
combine this signal layer with a licensed risk oracle.
