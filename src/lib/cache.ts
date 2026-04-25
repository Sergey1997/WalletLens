import type { AddressReport } from "./types";
import { getSupabaseServer } from "./supabase";
import { METHODOLOGY_VERSION } from "./scoring/weights";
import { listsVersionHash } from "./lists";
import { log, logDebug } from "./logger";

const memory = new Map<string, { payload: AddressReport; expiresAtMs: number }>();

function cacheKey(address: string): string {
  const graphDepth = process.env.GRAPH_MAX_DEPTH ?? "2";
  const graphFanout = process.env.GRAPH_FANOUT_PER_NODE ?? "3";
  return `${address.toLowerCase()}|${METHODOLOGY_VERSION}|${listsVersionHash()}|depth:${graphDepth}|fanout:${graphFanout}`;
}

export async function getCachedReport(address: string): Promise<AddressReport | null> {
  const key = cacheKey(address);
  const now = Date.now();
  const hit = memory.get(key);
  if (hit && hit.expiresAtMs > now) {
    logDebug("cache", "memory_hit", { keyPrefix: key.slice(0, 20), expiresInMs: hit.expiresAtMs - now });
    return hit.payload;
  }
  if (hit) memory.delete(key);

  const sb = getSupabaseServer();
  if (!sb) {
    logDebug("cache", "supabase_skipped", { reason: "no env", keyPrefix: key.slice(0, 20) });
    return null;
  }
  const { data, error } = await sb
    .from("report_cache")
    .select("payload, expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (error) {
    log("cache", "warn", "supabase_read_error", { err: error.message, keyPrefix: key.slice(0, 20) });
    return null;
  }
  if (!data) {
    logDebug("cache", "supabase_miss", { keyPrefix: key.slice(0, 20) });
    return null;
  }
  const expMs = new Date(data.expires_at).getTime();
  if (expMs <= now) {
    logDebug("cache", "supabase_stale", { keyPrefix: key.slice(0, 20), expiredAgoMs: now - expMs });
    return null;
  }
  log("cache", "info", "supabase_hit", { keyPrefix: key.slice(0, 20), expiresInMs: expMs - now });
  memory.set(key, { payload: data.payload as AddressReport, expiresAtMs: expMs });
  return data.payload as AddressReport;
}

export async function saveReport(report: AddressReport): Promise<void> {
  const key = cacheKey(report.address);
  memory.set(key, { payload: report, expiresAtMs: report.expiresAtMs });
  logDebug("cache", "memory_upsert", { keyPrefix: key.slice(0, 20), address: report.address });

  const sb = getSupabaseServer();
  if (!sb) {
    logDebug("cache", "supabase_upsert_skipped", { reason: "no env" });
    return;
  }
  const { error } = await sb.from("report_cache").upsert(
    {
      cache_key: key,
      address: report.address,
      methodology_version: report.methodologyVersion,
      payload: report,
      created_at: new Date(report.createdAtMs).toISOString(),
      expires_at: new Date(report.expiresAtMs).toISOString(),
    },
    { onConflict: "cache_key" }
  );
  if (error) {
    log("cache", "warn", "supabase_upsert_failed", { err: error.message, address: report.address });
    return;
  }
  log("cache", "info", "supabase_upsert_ok", { address: report.address, methodologyVersion: report.methodologyVersion });
}
