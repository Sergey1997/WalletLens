import { NextResponse } from "next/server";
import { getSupabaseRSC } from "@/lib/auth/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const sb = getSupabaseRSC();
  if (sb) await sb.auth.signOut();
  return NextResponse.json({ ok: true });
}
