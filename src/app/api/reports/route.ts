import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import type { AddressReport } from "@/lib/types";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getSupabaseServer();
  if (!sb) {
    return NextResponse.json({ reports: [] });
  }

  const { data, error } = await sb
    .from("report_cache")
    .select("payload, created_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    log("api/reports", "warn", "latest_reports_failed", { err: error.message });
    return NextResponse.json({ reports: [] }, { status: 200 });
  }

  const seen = new Set<string>();
  const reports = (data ?? [])
    .map((row) => row.payload as AddressReport)
    .filter((report) => {
      const address = report.address.toLowerCase();
      if (seen.has(address)) return false;
      seen.add(address);
      return true;
    })
    .slice(0, 8);

  return NextResponse.json({ reports });
}
