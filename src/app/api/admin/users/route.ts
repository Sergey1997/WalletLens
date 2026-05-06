import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth/supabase-server";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostBody = z.object({
  email: z.string().email().max(254),
  role: z.enum(["admin", "analyst"]).optional(),
  note: z.string().max(280).optional(),
});

const DeleteBody = z.object({
  user_id: z.string().uuid(),
});

interface AuthUserRow {
  id: string;
  email: string | null;
}

async function findAuthUserByEmail(email: string): Promise<AuthUserRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  // The auth.admin API returns *all* users so we paginate until we find a match.
  // For typical instances with <= a few hundred users this stays cheap.
  const PAGE = 200;
  for (let page = 1; page <= 25; page++) {
    const res = await sb.auth.admin.listUsers({ page, perPage: PAGE });
    const list = res.data?.users ?? [];
    const hit = list.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (hit) return { id: hit.id, email: hit.email ?? null };
    if (list.length < PAGE) break;
  }
  return null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "anon" ? 401 : 403 });
  }
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ admins: [], source: "fallback" });
  const { data, error } = await sb
    .from("admin_users")
    .select("user_id, email, role, note, created_at, created_by")
    .order("created_at", { ascending: true });
  if (error) {
    log("api/admin/users", "warn", "list_failed", { err: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ admins: data ?? [], current_user_id: auth.user_id });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "anon" ? 401 : 403 });
  }
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid body" }, { status: 400 });
  }

  const target = await findAuthUserByEmail(body.email);
  if (!target) {
    return NextResponse.json(
      { error: "User with that email has not signed up yet" },
      { status: 404 },
    );
  }
  const { error } = await sb.from("admin_users").upsert(
    {
      user_id: target.id,
      email: (target.email ?? body.email).toLowerCase(),
      role: body.role ?? "admin",
      note: body.note ?? null,
      created_by: auth.user_id,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await sb.from("audit_events").insert({
    actor: auth.email,
    action: "grant_admin",
    target_kind: "admin_user",
    target_id: target.id,
    payload: { email: body.email, role: body.role ?? "admin" },
  });
  return NextResponse.json({ ok: true, user_id: target.id });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "anon" ? 401 : 403 });
  }
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: z.infer<typeof DeleteBody>;
  try {
    body = DeleteBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid body" }, { status: 400 });
  }
  if (body.user_id === auth.user_id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }
  const { error } = await sb.from("admin_users").delete().eq("user_id", body.user_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await sb.from("audit_events").insert({
    actor: auth.email,
    action: "revoke_admin",
    target_kind: "admin_user",
    target_id: body.user_id,
  });
  return NextResponse.json({ ok: true });
}
