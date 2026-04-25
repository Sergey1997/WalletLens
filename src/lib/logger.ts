import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type Level = "debug" | "info" | "warn" | "error";

const order: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function minLevel(): Level {
  const raw = (process.env.LOG_LEVEL || "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return "info";
}

function shouldLog(level: Level): boolean {
  return order[level] >= order[minLevel()];
}

type Ctx = { requestId: string };
const requestStore = new AsyncLocalStorage<Ctx>();

/** Run an async handler with a fresh correlation id (use at API entry). */
export function runWithRequestId<T>(fn: () => Promise<T>): Promise<T> {
  return requestStore.run({ requestId: randomUUID() }, fn);
}

export function getRequestId(): string | undefined {
  return requestStore.getStore()?.requestId;
}

/**
 * Single-line JSON logs for easy grep / jq. Example:
 * {"ts":"...","level":"info","scope":"api/report","msg":"ingest_done","requestId":"...","durationMs":1234}
 */
export function log(scope: string, level: Level, msg: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    msg,
    requestId: getRequestId() ?? null,
    ...meta,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logDebug(scope: string, msg: string, meta?: Record<string, unknown>) {
  log(scope, "debug", msg, meta);
}
