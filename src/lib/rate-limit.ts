import { getSupabaseServer } from "./supabase";
import { log, logDebug } from "./logger";

const WINDOW_MS = 60_000;
const memory = new Map<string, number[]>();

function limit(): number {
  const raw = Number(process.env.RATE_LIMIT_PER_MINUTE || "20");
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

export async function checkRateLimit(ip: string): Promise<{ ok: boolean; remaining: number; limit: number }> {
  const max = limit();
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const buf = memory.get(ip) || [];
  const kept = buf.filter((t) => t > windowStart);
  kept.push(now);
  memory.set(ip, kept);

  let count = kept.length;

  const sb = getSupabaseServer();
  if (sb) {
    try {
      const ins = await sb.from("rate_limit_log").insert({ ip, created_at: new Date(now).toISOString() });
      if (ins.error) log("rate-limit", "debug", "db_insert_note", { err: ins.error.message });
      const { count: dbCount } = await sb
        .from("rate_limit_log")
        .select("*", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("created_at", new Date(windowStart).toISOString());
      if (typeof dbCount === "number") count = dbCount;
    } catch (e) {
      log("rate-limit", "debug", "db_fallback_mem", { err: e instanceof Error ? e.message : String(e) });
    }
  }

  const remaining = Math.max(0, max - count);
  const ok = count <= max;
  if (ok) {
    logDebug("rate-limit", "allowed", { ip, count, remaining, limit: max });
  }
  return { ok, remaining, limit: max };
}
