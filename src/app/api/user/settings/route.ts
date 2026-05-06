import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UserSettings {
  active_profile_id: string | null;
  notify_email: boolean;
  notify_grade_change: boolean;
  default_chains: number[];
  ui_density: "comfortable" | "compact";
}

const DEFAULTS: UserSettings = {
  active_profile_id: null,
  notify_email: true,
  notify_grade_change: true,
  default_chains: [1, 8453],
  ui_density: "comfortable",
};

const Body = z.object({
  active_profile_id: z.string().nullable().optional(),
  notify_email: z.boolean().optional(),
  notify_grade_change: z.boolean().optional(),
  default_chains: z.array(z.number().int()).max(12).optional(),
  ui_density: z.enum(["comfortable", "compact"]).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ authenticated: false });
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ authenticated: true, settings: DEFAULTS, source: "fallback" });
  const { data } = await sb
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return NextResponse.json({
    authenticated: true,
    settings: (data as UserSettings | null) ?? DEFAULTS,
    source: "db",
  });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "anon" }, { status: 401 });
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid body" }, { status: 400 });
  }
  const update: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  if (body.active_profile_id !== undefined) update.active_profile_id = body.active_profile_id;
  if (body.notify_email !== undefined) update.notify_email = body.notify_email;
  if (body.notify_grade_change !== undefined) update.notify_grade_change = body.notify_grade_change;
  if (body.default_chains !== undefined) update.default_chains = body.default_chains;
  if (body.ui_density !== undefined) update.ui_density = body.ui_density;
  const { error } = await sb
    .from("user_settings")
    .upsert(update, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
