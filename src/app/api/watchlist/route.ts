import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import { isEvmAddress, normalizeAddress } from "@/lib/address";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface WatchlistEntry {
  id: string;
  address: string;
  label?: string;
  note?: string;
  last_score?: number;
  last_grade?: string;
  last_checked_at?: string;
  created_at: string;
}

const PostBody = z.object({
  address: z.string().min(4).max(64),
  label: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
});

const DeleteBody = z.object({
  id: z.string().min(1).optional(),
  address: z.string().min(4).max(64).optional(),
});

interface MemoryRow {
  id: string;
  owner: string;
  address: string;
  label?: string;
  note?: string;
  last_score?: number;
  last_grade?: string;
  last_checked_at?: string;
  created_at: string;
}

const memoryStore = new Map<string, MemoryRow>();

function memoryRowsFor(owner: string): WatchlistEntry[] {
  return Array.from(memoryStore.values())
    .filter((r) => r.owner === owner)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((r) => ({
      id: r.id,
      address: r.address,
      label: r.label,
      note: r.note,
      last_score: r.last_score,
      last_grade: r.last_grade,
      last_checked_at: r.last_checked_at,
      created_at: r.created_at,
    }));
}

async function ownerKey(): Promise<{ user_id: string | null; owner: string }> {
  const user = await getCurrentUser();
  if (user) return { user_id: user.id, owner: user.id };
  return { user_id: null, owner: "anon" };
}

export async function GET() {
  const { user_id, owner } = await ownerKey();
  const sb = getSupabaseServer();
  if (!sb) {
    return NextResponse.json({ items: memoryRowsFor(owner), source: "memory" });
  }
  let query = sb
    .from("watchlist_items")
    .select("id, address, label, note, last_score, last_grade, last_checked_at, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(100);
  query = user_id ? query.eq("user_id", user_id) : query.is("user_id", null).eq("owner", "system");
  const { data, error } = await query;
  if (error) {
    log("api/watchlist", "warn", "list_failed", { err: error.message });
    return NextResponse.json({ items: [], source: "db", error: error.message }, { status: 200 });
  }
  return NextResponse.json({ items: data ?? [], source: "db" });
}

export async function POST(req: Request) {
  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!isEvmAddress(body.address)) {
    return NextResponse.json({ error: "Not a valid EVM address" }, { status: 400 });
  }
  const address = normalizeAddress(body.address);
  const { user_id, owner } = await ownerKey();
  const sb = getSupabaseServer();
  if (!sb) {
    const row: MemoryRow = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      owner,
      address,
      label: body.label,
      note: body.note,
      created_at: new Date().toISOString(),
    };
    memoryStore.set(`${owner}:${address}`, row);
    return NextResponse.json({ ok: true, item: row, source: "memory" });
  }

  const { data, error } = await sb
    .from("watchlist_items")
    .upsert(
      {
        owner: user_id ?? "system",
        address,
        user_id,
        label: body.label ?? null,
        note: body.note ?? null,
      },
      { onConflict: "owner,address" },
    )
    .select("id, address, label, note, last_score, last_grade, last_checked_at, created_at")
    .single();
  if (error) {
    log("api/watchlist", "warn", "insert_failed", { err: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, item: data, source: "db" });
}

export async function DELETE(req: Request) {
  let body: z.infer<typeof DeleteBody>;
  try {
    body = DeleteBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { user_id, owner } = await ownerKey();
  const sb = getSupabaseServer();
  if (!sb) {
    if (body.address && isEvmAddress(body.address)) {
      memoryStore.delete(`${owner}:${normalizeAddress(body.address)}`);
    } else if (body.id) {
      for (const [k, v] of memoryStore.entries()) {
        if (v.id === body.id && v.owner === owner) {
          memoryStore.delete(k);
          break;
        }
      }
    }
    return NextResponse.json({ ok: true, source: "memory" });
  }
  let query = sb.from("watchlist_items").delete();
  if (body.id) query = query.eq("id", body.id);
  else if (body.address && isEvmAddress(body.address))
    query = query.eq("address", normalizeAddress(body.address));
  else return NextResponse.json({ error: "id or address required" }, { status: 400 });

  query = user_id ? query.eq("user_id", user_id) : query.is("user_id", null).eq("owner", "system");

  const { error } = await query;
  if (error) {
    log("api/watchlist", "warn", "delete_failed", { err: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, source: "db" });
}
