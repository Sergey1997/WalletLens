import { NextResponse } from "next/server";
import { z } from "zod";
import { CHAINS } from "@/lib/chains";
import { isEvmAddress, normalizeAddress } from "@/lib/address";
import { BETWEEN_CHAIN_MS } from "@/lib/providers/etherscan-v2";
import { defaultProvider } from "@/lib/providers/public-composite";
import { scoreAddress } from "@/lib/scoring/engine";
import { getCachedReport, saveReport } from "@/lib/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { ensureLabelIndex } from "@/lib/lists";
import { persistExposures } from "@/lib/exposures/persist";
import { getRequestId, log, runWithRequestId } from "@/lib/logger";
import type { ChainFacts, GraphExposure } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  address: z.string().min(4).max(128),
  force: z.boolean().optional(),
});

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(raw)));
}

function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "anon"
  );
}

function withRequestHeaders(res: NextResponse) {
  const id = getRequestId();
  if (id) res.headers.set("X-Request-Id", id);
  return res;
}

async function expandGraph(rootAddress: string, rootChains: ChainFacts[]): Promise<ChainFacts[]> {
  const maxDepth = envInt("GRAPH_MAX_DEPTH", 2, 0, 3);
  const fanoutPerNode = envInt("GRAPH_FANOUT_PER_NODE", 3, 1, 10);
  if (maxDepth <= 0) {
    return rootChains.map((c) => ({
      ...c,
      graph: { maxDepth, fanoutPerNode, walletsScanned: 0, uniqueWallets: 1, exposures: [] },
    }));
  }

  const out: ChainFacts[] = [];
  for (const root of rootChains) {
    if (!root.available) {
      out.push(root);
      continue;
    }

    const seen = new Set<string>([rootAddress.toLowerCase()]);
    const queue = root.topCounterparties.slice(0, fanoutPerNode).map((cp) => ({
      address: cp.address.toLowerCase(),
      depth: 1,
      via: rootAddress.toLowerCase(),
    }));
    const exposures: GraphExposure[] = [];
    let walletsScanned = 0;

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node.depth > maxDepth || seen.has(node.address)) continue;
      seen.add(node.address);

      const facts = await defaultProvider.fetchChainFacts(node.address, root.chainId);
      walletsScanned += 1;

      for (const label of facts.hitLabels) {
        if (label.address.toLowerCase() === rootAddress.toLowerCase()) continue;
        const id = `${label.address.toLowerCase()}:${node.depth}:${node.via}`;
        if (!exposures.some((e) => `${e.label.address.toLowerCase()}:${e.depth}:${e.via}` === id)) {
          exposures.push({
            address: node.address,
            label,
            depth: node.depth,
            via: node.via,
            chainId: root.chainId,
          });
        }
      }

      if (node.depth < maxDepth && facts.available) {
        for (const cp of facts.topCounterparties.slice(0, fanoutPerNode)) {
          const addr = cp.address.toLowerCase();
          if (!seen.has(addr)) queue.push({ address: addr, depth: node.depth + 1, via: node.address });
        }
      }
    }

    log("graph", "info", "chain_graph_done", {
      chainId: root.chainId,
      maxDepth,
      fanoutPerNode,
      walletsScanned,
      uniqueWallets: seen.size,
      exposures: exposures.length,
    });

    out.push({
      ...root,
      graph: { maxDepth, fanoutPerNode, walletsScanned, uniqueWallets: seen.size, exposures },
    });
  }

  return out;
}

export async function POST(req: Request) {
  return runWithRequestId(async () => {
    const t0 = Date.now();
    const ip = clientIp(req);
    log("api/report", "info", "request_received", { method: "POST", clientIp: ip });

    const rl = await checkRateLimit(ip);
    if (!rl.ok) {
      log("api/report", "warn", "rate_limit_blocked", { clientIp: ip, limit: rl.limit, remaining: rl.remaining });
      return withRequestHeaders(
        NextResponse.json(
          { error: "Rate limit exceeded", limit: rl.limit },
          { status: 429, headers: { "X-RateLimit-Remaining": String(rl.remaining) } }
        )
      );
    }
    log("api/report", "debug", "rate_limit_ok", { clientIp: ip, remaining: rl.remaining, limit: rl.limit });

    let parsed: z.infer<typeof Body>;
    try {
      const json = await req.json();
      parsed = Body.parse(json);
    } catch (e) {
      log("api/report", "warn", "body_parse_failed", { err: e instanceof Error ? e.message : String(e) });
      return withRequestHeaders(NextResponse.json({ error: "Invalid request body" }, { status: 400 }));
    }

    if (!isEvmAddress(parsed.address)) {
      log("api/report", "warn", "address_invalid", { input: parsed.address });
      return withRequestHeaders(NextResponse.json({ error: "Not a valid EVM address" }, { status: 400 }));
    }

    const address = normalizeAddress(parsed.address);
    log("api/report", "info", "address_normalized", { address, force: parsed.force === true });

    await ensureLabelIndex();

    if (!parsed.force) {
      const tCache = Date.now();
      const cached = await getCachedReport(address);
      log("api/report", "debug", "cache_lookup_ms", { ms: Date.now() - tCache });
      if (cached) {
        log("api/report", "info", "response_cache_hit", {
          address,
          walletScore: cached.walletScore,
          durationMs: Date.now() - t0,
        });
        return withRequestHeaders(
          NextResponse.json(
            { report: cached, cached: true },
            { headers: { "X-RateLimit-Remaining": String(rl.remaining) } }
          )
        );
      }
      log("api/report", "info", "cache_miss", { address });
    } else {
      log("api/report", "info", "cache_bypassed", { address, force: true });
    }

    const tIngest = Date.now();
    // Sequential chains + stagger: avoids 5×3=15 parallel Etherscan calls (free tier rate limits hard).
    const chainResults: ChainFacts[] = [];
    for (let i = 0; i < CHAINS.length; i++) {
      if (i > 0) {
        await new Promise<void>((r) => setTimeout(r, BETWEEN_CHAIN_MS));
      }
      chainResults.push(await defaultProvider.fetchChainFacts(address, CHAINS[i].id));
    }
    log("api/report", "info", "ingest_chains_done", {
      address,
      durationMs: Date.now() - tIngest,
      chains: chainResults.map((c) => ({
        chainId: c.chainId,
        available: c.available,
        txCount: c.txCount,
        error: c.error,
      })),
    });

    const tGraph = Date.now();
    const enrichedChains = await expandGraph(address, chainResults);
    log("api/report", "info", "graph_expand_done", {
      address,
      durationMs: Date.now() - tGraph,
      walletsScanned: enrichedChains.reduce((s, c) => s + (c.graph?.walletsScanned ?? 0), 0),
      exposures: enrichedChains.reduce((s, c) => s + (c.graph?.exposures.length ?? 0), 0),
    });

    const ttl = Number(process.env.REPORT_CACHE_TTL_SECONDS || "3600");
    const tScore = Date.now();
    const report = scoreAddress({ address, chains: enrichedChains, ttlSeconds: ttl });
    log("api/report", "debug", "scoring_ms", { ms: Date.now() - tScore });

    const saveStart = Date.now();
    await saveReport(report)
      .then(() => {
        log("api/report", "debug", "cache_save_ok", { ms: Date.now() - saveStart });
      })
      .catch((e) => {
        log("api/report", "warn", "cache_save_failed", {
          err: e instanceof Error ? e.message : String(e),
          ms: Date.now() - saveStart,
        });
      });

    persistExposures(report).catch((e) => {
      log("api/report", "warn", "exposures_persist_failed", {
        err: e instanceof Error ? e.message : String(e),
      });
    });

    log("api/report", "info", "response_fresh", {
      address,
      walletScore: report.walletScore,
      riskScore: report.riskScore,
      trustScore: report.trustScore,
      confidence: report.confidence,
      factorCount: report.factors.length,
      trustSignalCount: report.trust.length,
      totalTxs: report.summary.totalTxs,
      durationMs: Date.now() - t0,
    });

    return withRequestHeaders(
      NextResponse.json(
        { report, cached: false },
        { headers: { "X-RateLimit-Remaining": String(rl.remaining) } }
      )
    );
  });
}
