import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { METHODOLOGY_VERSION, WEIGHTS, TRUST_WEIGHTS } from "@/lib/scoring/weights";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ProfileCategoryConfig {
  self?: number;
  direct?: number;
  "1hop"?: number;
  "2hop"?: number;
  received?: "none" | "low" | "medium" | "high";
  sent?: "none" | "low" | "medium" | "high";
}

export interface RiskScoreProfile {
  id: string;
  name: string;
  version: string;
  is_default: boolean;
  source: "db" | "fallback";
  config: {
    categories: Record<string, ProfileCategoryConfig>;
    trust?: Record<string, number>;
  };
  created_by?: string;
  updated_at?: string;
}

function fallbackProfile(): RiskScoreProfile {
  return {
    id: "default",
    name: "Default",
    version: `engine-${METHODOLOGY_VERSION}`,
    is_default: true,
    source: "fallback",
    config: {
      categories: {
        sanctioned: {
          self: WEIGHTS.selfSanctioned,
          direct: WEIGHTS.directSanctioned,
          "1hop": Math.round(WEIGHTS.directSanctioned * 0.65),
          "2hop": Math.round(WEIGHTS.directSanctioned * 0.35),
          received: "high",
          sent: "high",
        },
        mixer: {
          direct: WEIGHTS.directMixer,
          "1hop": Math.round(WEIGHTS.directMixer * 0.65),
          "2hop": Math.round(WEIGHTS.directMixer * 0.35),
          received: "high",
          sent: "high",
        },
        exploit: {
          direct: WEIGHTS.directExploit,
          "1hop": Math.round(WEIGHTS.directExploit * 0.65),
          "2hop": Math.round(WEIGHTS.directExploit * 0.35),
          received: "high",
          sent: "high",
        },
        darknet_market: {
          direct: WEIGHTS.directDarknetMarket,
          "1hop": Math.round(WEIGHTS.directDarknetMarket * 0.65),
          "2hop": Math.round(WEIGHTS.directDarknetMarket * 0.35),
          received: "high",
          sent: "high",
        },
        ransom: {
          direct: WEIGHTS.directRansom,
          "1hop": Math.round(WEIGHTS.directRansom * 0.65),
          "2hop": Math.round(WEIGHTS.directRansom * 0.35),
          received: "high",
          sent: "high",
        },
        phishing: {
          direct: WEIGHTS.directPhishingOrScam,
          "1hop": Math.round(WEIGHTS.directPhishingOrScam * 0.65),
          received: "high",
          sent: "high",
        },
        scam: {
          direct: WEIGHTS.directPhishingOrScam,
          "1hop": Math.round(WEIGHTS.directPhishingOrScam * 0.65),
          received: "high",
          sent: "high",
        },
        gambling: { direct: WEIGHTS.directGambling, received: "low", sent: "none" },
        exchange_unlicensed: { direct: WEIGHTS.directExchangeUnlicensed, received: "medium", sent: "none" },
      },
      trust: {
        cex: TRUST_WEIGHTS.cexInteraction,
        defi: TRUST_WEIGHTS.defiInteraction,
        bridge: TRUST_WEIGHTS.bridgeInteraction,
      },
    },
  };
}

export async function GET() {
  const sb = getSupabaseServer();
  const fallback = fallbackProfile();

  if (!sb) {
    return NextResponse.json({ profiles: [fallback], default_id: fallback.id, source: "fallback" });
  }

  const { data, error } = await sb
    .from("risk_score_profiles")
    .select("id, name, version, is_default, config, created_by, updated_at")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error || !data || data.length === 0) {
    if (error) log("api/profiles", "warn", "list_failed", { err: error.message });
    return NextResponse.json({ profiles: [fallback], default_id: fallback.id, source: "fallback" });
  }

  const profiles: RiskScoreProfile[] = data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    version: row.version as string,
    is_default: !!row.is_default,
    source: "db",
    config: (row.config as RiskScoreProfile["config"]) ?? { categories: {} },
    created_by: (row.created_by as string | null) ?? undefined,
    updated_at: (row.updated_at as string | null) ?? undefined,
  }));
  const def = profiles.find((p) => p.is_default) ?? profiles[0];
  return NextResponse.json({ profiles, default_id: def.id, source: "db" });
}
