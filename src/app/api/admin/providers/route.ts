import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  id: z.string().min(2).max(64),
  display_name: z.string().min(2).max(160),
  trust_level: z.number().int().min(0).max(100),
  url: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  notes: z.string().max(500).optional(),
});

const DeleteBody = z.object({ id: z.string().min(2).max(64) });

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.reason === "anon" ? 401 : 403 });
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ providers: [], source: "fallback" });
  const { data, error } = await sb.from("risk_sources").select("*").order("display_name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ providers: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.reason === "anon" ? 401 : 403 });
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid body" }, { status: 400 });
  }
  const { error } = await sb.from("risk_sources").upsert(
    {
      id: body.id,
      display_name: body.display_name,
      trust_level: body.trust_level,
      url: body.url ?? null,
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sb.from("audit_events").insert({
    actor: auth.email,
    action: "upsert_provider",
    target_kind: "risk_source",
    target_id: body.id,
    payload: body,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.reason === "anon" ? 401 : 403 });
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: z.infer<typeof DeleteBody>;
  try {
    body = DeleteBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid body" }, { status: 400 });
  }
  const { error } = await sb.from("risk_sources").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sb.from("audit_events").insert({
    actor: auth.email,
    action: "delete_provider",
    target_kind: "risk_source",
    target_id: body.id,
  });
  return NextResponse.json({ ok: true });
}
