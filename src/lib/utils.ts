import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(addr: string, head = 6, tail = 4) {
  if (!addr) return "";
  const clean = addr.toLowerCase();
  if (clean.length <= head + tail + 2) return clean;
  return `${clean.slice(0, head)}…${clean.slice(-tail)}`;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n * 100) / 100);
}

export function daysBetween(ms: number): number {
  const now = Date.now();
  return Math.max(0, Math.floor((now - ms) / (1000 * 60 * 60 * 24)));
}
