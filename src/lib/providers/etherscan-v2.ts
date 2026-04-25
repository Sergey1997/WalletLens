import type { ChainId } from "../chains";
import { CHAIN_BY_ID, rpcUrl } from "../chains";
import { log, logDebug } from "../logger";
import type { ChainFacts, Counterparty, LabelEntry } from "../types";
import { lookupLabel } from "../lists";
import type { RiskDataProvider } from "./types";

const BASE = "https://api.etherscan.io/v2/api";

/** Space out Explorer calls: free keys allow ~5 calls/sec; we stay well under. */
const BETWEEN_SUBCALLS_MS = 120;
const BETWEEN_CHAIN_MS = 200;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError?: string;
  contractAddress?: string;
}

interface EtherscanResp<T> {
  status: string;
  message: string;
  result: T;
}

interface AlchemyTransfer {
  hash?: string;
  from?: string;
  to?: string;
  value?: number | null;
  rawContract?: { value?: string | null };
  metadata?: { blockTimestamp?: string };
}

interface AlchemyTransferResponse {
  transfers?: AlchemyTransfer[];
  pageKey?: string;
}

function isRetryableEtherscanError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /rate|limit|Max|temporarily|429|Too Many|timeout|ECONNRESET|ETIMEDOUT|network/i.test(m);
}

function parseEtherscanErrorMessage(data: EtherscanResp<unknown>): string {
  if (data.message === "No transactions found") return "";
  const r = data.result;
  if (typeof r === "string") return r;
  if (r != null) return String(r);
  return data.message || "NOTOK";
}

async function call<T>(
  params: Record<string, string>,
  signal: AbortSignal | undefined,
  label: string
): Promise<T> {
  const key = process.env.ETHERSCAN_API_KEY || "";
  const t0 = Date.now();
  const url = new URL(BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (key) url.searchParams.set("apikey", key);

  const res = await fetch(url.toString(), {
    signal,
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  const httpMs = Date.now() - t0;
  if (!res.ok) {
    log("etherscan", "warn", "http_error", {
      label,
      action: params.action,
      chainid: params.chainid,
      status: res.status,
      ms: httpMs,
    });
    throw new Error(`Etherscan HTTP ${res.status}`);
  }
  const data = (await res.json()) as EtherscanResp<T>;

  if (data.status === "1") {
    logDebug("etherscan", "ok", {
      label,
      action: params.action,
      chainid: params.chainid,
      ms: httpMs,
      status: data.status,
    });
    return data.result;
  }

  if (data.message === "No transactions found") {
    logDebug("etherscan", "no_txs", {
      label,
      action: params.action,
      chainid: params.chainid,
      ms: httpMs,
    });
    return [] as unknown as T;
  }

  const msg = parseEtherscanErrorMessage(data);
  const full = [data.message, msg].filter(Boolean).join(" — ");

  if (/rate limit|Max rate|Too Many Requests|per second|Visit/i.test(msg + data.message)) {
    log("etherscan", "warn", "api_rate_limited", {
      label,
      action: params.action,
      chainid: params.chainid,
      ms: httpMs,
      detail: full,
    });
    throw new Error(`Etherscan rate limit: ${full}`);
  }
  if (/invalid api key|missing api key|Invalid API Key/i.test(msg + data.message)) {
    log("etherscan", "error", "invalid_api_key", { label, ms: httpMs, detail: full });
    throw new Error("Invalid or missing Etherscan API key");
  }

  log("etherscan", "warn", "api_error", {
    label,
    action: params.action,
    chainid: params.chainid,
    ms: httpMs,
    status: data.status,
    message: data.message,
    result: typeof data.result === "string" ? data.result : undefined,
  });
  throw new Error(`Etherscan NOTOK: ${full}`);
}

async function callWithRetry<T>(
  params: Record<string, string>,
  signal: AbortSignal | undefined,
  label: string
): Promise<T> {
  const max = 4;
  let last: unknown;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await call<T>(params, signal, label);
    } catch (e) {
      last = e;
      if (attempt < max - 1 && isRetryableEtherscanError(e)) {
        const wait = 400 * 2 ** attempt;
        log("etherscan", "info", "retry", { label, attempt: attempt + 1, waitMs: wait });
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  throw last;
}

async function rpcCall<T>(chainId: ChainId, method: string, params: unknown[], signal?: AbortSignal): Promise<T> {
  const chain = CHAIN_BY_ID[chainId];
  const url = rpcUrl(chain);
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) {
    log("rpc", "warn", "http_error", { chainId, chain: chain.name, method, status: res.status, ms });
    throw new Error(`RPC HTTP ${res.status}`);
  }
  const json = (await res.json()) as { result?: T; error?: { message?: string; code?: number } };
  if (json.error) {
    log("rpc", "warn", "rpc_error", {
      chainId,
      chain: chain.name,
      method,
      code: json.error.code,
      message: json.error.message,
      ms,
    });
    throw new Error(json.error.message || `RPC error ${json.error.code ?? ""}`.trim());
  }
  logDebug("rpc", "ok", { chainId, chain: chain.name, method, ms });
  return json.result as T;
}

function toEtherscanLikeTx(t: AlchemyTransfer): EtherscanTx {
  const value =
    typeof t.rawContract?.value === "string" && t.rawContract.value
      ? BigInt(t.rawContract.value).toString()
      : String(t.value ?? 0);
  return {
    hash: t.hash ?? "",
    from: t.from ?? "",
    to: t.to ?? "",
    value,
    timeStamp: t.metadata?.blockTimestamp
      ? String(Math.floor(new Date(t.metadata.blockTimestamp).getTime() / 1000))
      : "0",
  };
}

async function fetchAlchemyTransfers(
  chainId: ChainId,
  address: string,
  direction: "fromAddress" | "toAddress",
  signal?: AbortSignal
): Promise<EtherscanTx[]> {
  const transfers: AlchemyTransfer[] = [];
  let pageKey: string | undefined;
  do {
    const params: Record<string, unknown> = {
      [direction]: address,
      category: ["external", "erc20", "erc721", "erc1155", "specialnft"],
      withMetadata: true,
      excludeZeroValue: false,
      maxCount: "0x3e8",
      order: "desc",
    };
    if (pageKey) params.pageKey = pageKey;
    const result = await rpcCall<AlchemyTransferResponse>(chainId, "alchemy_getAssetTransfers", [params], signal);
    transfers.push(...(result.transfers ?? []));
    pageKey = result.pageKey;
  } while (pageKey && transfers.length < 1000);
  return transfers.map(toEtherscanLikeTx);
}

async function fetchRpcFallbackFacts(
  address: string,
  chainId: ChainId,
  signal?: AbortSignal
): Promise<ChainFacts> {
  const chain = CHAIN_BY_ID[chainId];
  const t0 = Date.now();
  log("rpc", "info", "fallback_start", { address, chainId, chain: chain.name });

  const [balance, inbound, outbound] = await Promise.all([
    rpcCall<string>(chainId, "eth_getBalance", [address, "latest"], signal).catch((e) => {
      log("rpc", "warn", "balance_failed", { chainId, err: e instanceof Error ? e.message : String(e) });
      return "0x0";
    }),
    fetchAlchemyTransfers(chainId, address, "toAddress", signal),
    fetchAlchemyTransfers(chainId, address, "fromAddress", signal),
  ]);

  const byHash = new Map<string, EtherscanTx>();
  for (const tx of [...inbound, ...outbound]) {
    byHash.set(tx.hash || `${tx.from}:${tx.to}:${tx.timeStamp}:${byHash.size}`, tx);
  }
  const allTxs = Array.from(byHash.values());
  const { counterparties, unique } = summarizeCounterparties(allTxs, address);
  const timestamps = allTxs
    .map((t) => Number(t.timeStamp) * 1000)
    .filter((t) => Number.isFinite(t) && t > 0);
  const firstSeenMs = timestamps.length ? Math.min(...timestamps) : undefined;
  const lastSeenMs = timestamps.length ? Math.max(...timestamps) : undefined;
  const hitLabels: LabelEntry[] = [];
  const seen = new Set<string>();
  for (const cp of counterparties) {
    if (cp.label && !seen.has(cp.label.address)) {
      hitLabels.push(cp.label);
      seen.add(cp.label.address);
    }
  }
  const self = lookupLabel(address);
  if (self && !seen.has(self.address)) hitLabels.unshift(self);

  log("rpc", "info", "fallback_ok", {
    address,
    chainId,
    chain: chain.name,
    durationMs: Date.now() - t0,
    totalTxs: allTxs.length,
    uniqueCounterparties: unique,
    labelHits: hitLabels.length,
  });

  return {
    chainId,
    available: true,
    balanceWei: BigInt(balance).toString(),
    txCount: allTxs.length,
    firstSeenMs,
    lastSeenMs,
    uniqueCounterparties: unique,
    topCounterparties: counterparties,
    hitLabels,
    scanned: { normalTxs: inbound.length + outbound.length, tokenTxs: 0 },
  };
}

export class EtherscanV2Provider implements RiskDataProvider {
  id = "etherscan-v2";
  version = "1.1.0";

  async fetchChainFacts(address: string, chainId: ChainId): Promise<ChainFacts> {
    const chainName = CHAIN_BY_ID[chainId].name;
    const tChain = Date.now();
    log("etherscan", "info", "chain_fetch_start", { address, chainId, chain: chainName });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const subErrors: string[] = [];

    const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        subErrors.push(`${label}: ${m}`);
        log("etherscan", "warn", "subcall_failed", { chain: chainName, label, err: m });
        return fallback;
      }
    };

    try {
      const balance = await safe(
        "balance",
        () =>
          callWithRetry<string>(
            {
              chainid: String(chainId),
              module: "account",
              action: "balance",
              address,
              tag: "latest",
            },
            controller.signal,
            `balance:${CHAIN_BY_ID[chainId].key}`
          ).then((r) => (typeof r === "string" ? r : "0")),
        "0"
      );
      await sleep(BETWEEN_SUBCALLS_MS);

      const normal = await safe(
        "txlist",
        () =>
          callWithRetry<EtherscanTx[] | string>(
            {
              chainid: String(chainId),
              module: "account",
              action: "txlist",
              address,
              startblock: "0",
              endblock: "99999999",
              page: "1",
              offset: "1000",
              sort: "desc",
            },
            controller.signal,
            `txlist:${CHAIN_BY_ID[chainId].key}`
          ).then((r) => (Array.isArray(r) ? r : [])),
        []
      );
      await sleep(BETWEEN_SUBCALLS_MS);

      const tokens = await safe(
        "tokentx",
        () =>
          callWithRetry<EtherscanTx[] | string>(
            {
              chainid: String(chainId),
              module: "account",
              action: "tokentx",
              address,
              page: "1",
              offset: "1000",
              sort: "desc",
            },
            controller.signal,
            `tokentx:${CHAIN_BY_ID[chainId].key}`
          ).then((r) => (Array.isArray(r) ? r : [])),
        []
      );

      const allTxs = [...normal, ...tokens];
      const { counterparties, unique } = summarizeCounterparties(allTxs, address);

      const timestamps = allTxs
        .map((t) => Number(t.timeStamp) * 1000)
        .filter((t) => Number.isFinite(t) && t > 0);
      const firstSeenMs = timestamps.length ? Math.min(...timestamps) : undefined;
      const lastSeenMs = timestamps.length ? Math.max(...timestamps) : undefined;

      const hitLabels: LabelEntry[] = [];
      const seen = new Set<string>();
      for (const cp of counterparties) {
        if (cp.label && !seen.has(cp.label.address)) {
          hitLabels.push(cp.label);
          seen.add(cp.label.address);
        }
      }

      const self = lookupLabel(address);
      if (self && !seen.has(self.address)) hitLabels.unshift(self);

      const allSubFailed = allTxs.length === 0 && subErrors.length === 3;
      const likelyRateLimited =
        allTxs.length === 0 && subErrors.length >= 2 && subErrors.some((e) => /rate limit/i.test(e));

      if (allSubFailed) {
        const err = `Etherscan: all calls failed for ${chainName}. ${subErrors.join(" | ")}`;
        log("etherscan", "warn", "chain_fetch_degraded", {
          address,
          chainId,
          chain: chainName,
          durationMs: Date.now() - tChain,
          subErrors,
        });
        try {
          return await fetchRpcFallbackFacts(address, chainId, controller.signal);
        } catch (fallbackErr) {
          const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          log("rpc", "warn", "fallback_failed", { address, chainId, chain: chainName, err: fallbackMsg });
        }
        return {
          chainId,
          available: false,
          error: err,
          balanceWei: balance,
          txCount: 0,
          uniqueCounterparties: 0,
          topCounterparties: [],
          hitLabels: [],
          scanned: { normalTxs: 0, tokenTxs: 0 },
        };
      }

      if (likelyRateLimited) {
        const err = "Etherscan rate limit: transaction list calls failed; data may be incomplete. Wait ~1 min or upgrade API key.";
        log("etherscan", "warn", "chain_fetch_likely_incomplete", {
          address,
          chainId,
          subErrors,
        });
        try {
          return await fetchRpcFallbackFacts(address, chainId, controller.signal);
        } catch (fallbackErr) {
          const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          log("rpc", "warn", "fallback_failed", { address, chainId, chain: chainName, err: fallbackMsg });
        }
        return {
          chainId,
          available: false,
          error: err,
          balanceWei: balance,
          txCount: 0,
          uniqueCounterparties: 0,
          topCounterparties: [],
          hitLabels: self ? [self] : [],
          scanned: { normalTxs: normal.length, tokenTxs: tokens.length },
        };
      }

      log("etherscan", "info", "chain_fetch_ok", {
        address,
        chainId,
        chain: chainName,
        durationMs: Date.now() - tChain,
        normalTxs: normal.length,
        tokenTxs: tokens.length,
        totalTxs: allTxs.length,
        uniqueCounterparties: unique,
        labelHits: hitLabels.length,
        balancePresent: balance !== "0",
        subErrorCount: subErrors.length,
      });
      return {
        chainId,
        available: true,
        error: subErrors.length ? `Partial: ${subErrors.join("; ")}` : undefined,
        balanceWei: balance,
        txCount: allTxs.length,
        firstSeenMs,
        lastSeenMs,
        uniqueCounterparties: unique,
        topCounterparties: counterparties,
        hitLabels,
        scanned: { normalTxs: normal.length, tokenTxs: tokens.length },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      log("etherscan", "warn", "chain_fetch_error", {
        address,
        chainId,
        chain: chainName,
        durationMs: Date.now() - tChain,
        error: msg,
      });
      return {
        chainId,
        available: false,
        error: msg,
        txCount: 0,
        uniqueCounterparties: 0,
        topCounterparties: [],
        hitLabels: [],
        scanned: { normalTxs: 0, tokenTxs: 0 },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // Helper so consumers know which explorer link to construct (for labels).
  static explorer(chainId: ChainId) {
    return CHAIN_BY_ID[chainId].explorerUrl;
  }
}

function summarizeCounterparties(
  txs: EtherscanTx[],
  owner: string
): { counterparties: Counterparty[]; unique: number } {
  const byAddr = new Map<string, { inTx: number; outTx: number }>();
  const ownerLc = owner.toLowerCase();
  for (const t of txs) {
    const from = (t.from || "").toLowerCase();
    const to = (t.to || "").toLowerCase();
    if (from && from !== ownerLc) {
      const rec = byAddr.get(from) || { inTx: 0, outTx: 0 };
      rec.inTx += 1;
      byAddr.set(from, rec);
    }
    if (to && to !== ownerLc) {
      const rec = byAddr.get(to) || { inTx: 0, outTx: 0 };
      rec.outTx += 1;
      byAddr.set(to, rec);
    }
  }
  const all: Counterparty[] = Array.from(byAddr.entries()).map(([addr, rec]) => ({
    address: addr,
    txCount: rec.inTx + rec.outTx,
    direction: rec.inTx > 0 && rec.outTx > 0 ? "both" : rec.inTx > 0 ? "in" : "out",
    label: lookupLabel(addr),
  }));
  all.sort((a, b) => b.txCount - a.txCount);
  return { counterparties: all.slice(0, 15), unique: byAddr.size };
}

/** Call between sequential chain fetches in the route to avoid cross-chain bursts. */
export { BETWEEN_CHAIN_MS };
