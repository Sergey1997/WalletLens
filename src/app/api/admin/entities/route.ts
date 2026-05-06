import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth/supabase-server";
import { isEvmAddress, normalizeAddress } from "@/lib/address";
import { EVM_CURRENCY_TO_CHAIN } from "@/lib/admin/import";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AddressSchema = z.object({
  chain_id: z.number().int().optional(),
  currency: z.string().min(2).max(16).optional(),
  address: z.string().min(4),
  confidence: z.number().int().min(0).max(100).optional(),
  source_id: z.string().optional(),
  evidence_url: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  owner: z.string().max(160).optional(),
  mentions: z.number().int().min(0).optional(),
  description: z.string().max(2000).optional(),
});

const Body = z.object({
  name: z.string().min(2).max(160),
  category_id: z.string().min(2),
  risk_level: z.number().int().min(0).max(100).optional(),
  status: z.enum(["active", "archived", "pending_review"]).optional(),
  description: z.string().max(2000).optional(),
  website: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  tags: z.array(z.string()).optional(),
  addresses: z.array(AddressSchema).max(500).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "anon" ? 401 : 403 });
  }
  const sb = getSupabaseServer();
  if (!sb) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid body" }, { status: 400 });
  }

  const cleanAddresses = (body.addresses ?? [])
    .map((a) => {
      const currency = (a.currency ?? "").toUpperCase() ||
        Object.entries(EVM_CURRENCY_TO_CHAIN).find(([, id]) => id === a.chain_id)?.[0] ||
        "ETH";
      const isEvm = EVM_CURRENCY_TO_CHAIN[currency] !== undefined;
      if (isEvm && !isEvmAddress(a.address)) return null;
      return {
        ...a,
        currency,
        chain_id: a.chain_id ?? EVM_CURRENCY_TO_CHAIN[currency] ?? null,
        address: isEvm ? normalizeAddress(a.address) : a.address.trim(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const { data: entity, error: entityErr } = await sb
    .from("risk_entities")
    .insert({
      name: body.name,
      category_id: body.category_id,
      risk_level: body.risk_level ?? 50,
      status: body.status ?? "active",
      description: body.description ?? null,
      website: body.website ?? null,
      tags: body.tags ?? [],
      created_by: auth.email,
      updated_by: auth.email,
    })
    .select("id")
    .single();

  if (entityErr || !entity) {
    log("api/admin/entities", "warn", "create_failed", { err: entityErr?.message });
    return NextResponse.json({ error: entityErr?.message ?? "create failed" }, { status: 500 });
  }

  if (cleanAddresses.length > 0) {
    const rows = cleanAddresses.map((a) => ({
      entity_id: entity.id,
      chain_id: a.chain_id,
      currency: a.currency,
      address: a.address,
      confidence: a.confidence ?? 70,
      source_id: a.source_id ?? null,
      evidence_url: a.evidence_url ?? null,
      owner_label: a.owner ?? null,
      mentions: a.mentions ?? 0,
      entry_description: a.description ?? null,
    }));
    const { error: addrErr } = await sb.from("risk_entity_addresses").upsert(rows, {
      onConflict: "entity_id,currency,address",
    });
    if (addrErr) {
      log("api/admin/entities", "warn", "addresses_failed", { err: addrErr.message });
    }
  }

  await sb.from("audit_events").insert({
    actor: auth.email,
    action: "create_entity",
    target_kind: "risk_entity",
    target_id: entity.id,
    payload: { name: body.name, category: body.category_id, addresses: cleanAddresses.length },
  });

  return NextResponse.json({ ok: true, id: entity.id, addresses: cleanAddresses.length });
}

const PatchBody = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "archived", "pending_review"]).optional(),
  risk_level: z.number().int().min(0).max(100).optional(),
  description: z.string().max(2000).optional(),
  website: z.string().url().optional().or(z.literal("").transform(() => undefined)),
});

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "anon" ? 401 : 403 });
  }
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid body" }, { status: 400 });
  }
  const update: Record<string, unknown> = { updated_by: auth.email, updated_at: new Date().toISOString() };
  if (body.status !== undefined) update.status = body.status;
  if (body.risk_level !== undefined) update.risk_level = body.risk_level;
  if (body.description !== undefined) update.description = body.description;
  if (body.website !== undefined) update.website = body.website;
  const { error } = await sb.from("risk_entities").update(update).eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await sb.from("audit_events").insert({
    actor: auth.email,
    action: "update_entity",
    target_kind: "risk_entity",
    target_id: body.id,
    payload: update,
  });
  return NextResponse.json({ ok: true });
}
