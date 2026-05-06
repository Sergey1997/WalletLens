import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth/supabase-server";
import { parseImport, type ImportRow } from "@/lib/admin/import";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  text: z.string().min(2).max(2_000_000),
  defaults: z
    .object({
      entity_name: z.string().optional(),
      category_id: z.string().optional(),
      chain_id: z.number().int().optional(),
      currency: z.string().optional(),
    })
    .optional(),
});

interface EntityCacheRow {
  id: string;
  name: string;
  category_id: string;
}

async function ensureEntities(
  sb: NonNullable<ReturnType<typeof getSupabaseServer>>,
  rows: ImportRow[],
  actor: string,
): Promise<{ idsByKey: Map<string, string>; created: number; reused: number; errors: string[] }> {
  const idsByKey = new Map<string, string>();
  const errors: string[] = [];
  let created = 0;
  let reused = 0;

  const groups = new Map<string, { name: string; category_id: string; meta: ImportRow }>();
  for (const r of rows) {
    const key = `${r.category_id}|${r.entity_name.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { name: r.entity_name, category_id: r.category_id, meta: r });
  }

  for (const [key, group] of groups) {
    const { data: existing, error: findErr } = await sb
      .from("risk_entities")
      .select("id, name, category_id")
      .eq("category_id", group.category_id)
      .ilike("name", group.name)
      .limit(1)
      .maybeSingle<EntityCacheRow>();
    if (findErr) {
      errors.push(`lookup ${group.name}: ${findErr.message}`);
      continue;
    }
    if (existing?.id) {
      idsByKey.set(key, existing.id);
      reused += 1;
      continue;
    }
    const { data: ins, error: insErr } = await sb
      .from("risk_entities")
      .insert({
        name: group.name,
        category_id: group.category_id,
        risk_level: 50,
        status: "active",
        tags: group.meta.tags ?? [],
        description: group.meta.description ?? null,
        website: group.meta.website ?? null,
        created_by: actor,
        updated_by: actor,
      })
      .select("id")
      .single();
    if (insErr || !ins) {
      errors.push(`create ${group.name}: ${insErr?.message ?? "unknown"}`);
      continue;
    }
    idsByKey.set(key, ins.id);
    created += 1;
  }

  return { idsByKey, created, reused, errors };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "anon" ? 401 : 403 });
  }
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid body" }, { status: 400 });
  }

  const parsed = parseImport(body.text, body.defaults);
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "no valid rows", errors: parsed.errors }, { status: 400 });
  }

  const { idsByKey, created, reused, errors } = await ensureEntities(sb, parsed.rows, auth.email);

  const addresses = parsed.rows
    .map((r) => {
      const id = idsByKey.get(`${r.category_id}|${r.entity_name.toLowerCase()}`);
      if (!id) return null;
      return {
        entity_id: id,
        chain_id: r.chain_id ?? null,
        currency: r.currency,
        address: r.address,
        confidence: r.confidence ?? 70,
        source_id: r.source_id ?? null,
        evidence_url: r.evidence_url ?? null,
        owner_label: r.owner ?? null,
        mentions: r.mentions ?? 0,
        entry_description: r.description ?? null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  let inserted = 0;
  if (addresses.length > 0) {
    const { error: addrErr, count } = await sb
      .from("risk_entity_addresses")
      .upsert(addresses, { onConflict: "entity_id,currency,address", count: "exact" });
    if (addrErr) {
      log("api/admin/import", "warn", "addresses_failed", { err: addrErr.message });
      errors.push(`addresses: ${addrErr.message}`);
    } else {
      inserted = count ?? addresses.length;
    }
  }

  await sb.from("audit_events").insert({
    actor: auth.email,
    action: "bulk_import",
    target_kind: "risk_entity_addresses",
    payload: {
      rows: parsed.rows.length,
      entities_created: created,
      entities_reused: reused,
      addresses: inserted,
      parse_errors: parsed.errors,
      backend_errors: errors,
    },
  });

  return NextResponse.json({
    ok: true,
    summary: {
      rows: parsed.rows.length,
      entities_created: created,
      entities_reused: reused,
      addresses_inserted: inserted,
    },
    parse_errors: parsed.errors,
    backend_errors: errors,
  });
}
