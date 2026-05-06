import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase";
import { listSnapshots } from "@/lib/lists";
import { OFAC_SDN } from "@/lib/lists/ofac";
import { MIXERS } from "@/lib/lists/mixers";
import { CEX_ADDRESSES } from "@/lib/lists/cex";
import { BRIDGES } from "@/lib/lists/bridges";
import { DEFI_KNOWN } from "@/lib/lists/defi";
import { isEvmAddress, normalizeAddress } from "@/lib/address";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface DirectoryEntity {
  id: string;
  name: string;
  category: string;
  risk_level: number;
  status: string;
  description?: string;
  website?: string;
  tags: string[];
  source: string;
  addresses: { chain_id: number; address: string; confidence: number; source_id?: string; evidence_url?: string }[];
}

const QuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(60),
  offset: z.coerce.number().min(0).default(0),
});

const SEED_TO_CATEGORY: Record<string, string> = {
  sanctioned: "sanctioned",
  mixer: "mixer",
  exploit: "exploit",
  phishing: "phishing",
  scam: "scam",
  cex: "cex",
  bridge: "bridge",
  dex: "dex",
  lending: "lending",
  defi: "defi",
  marketplace: "marketplace",
};

function buildFromSeed(): DirectoryEntity[] {
  const groups = new Map<string, DirectoryEntity>();
  const collect = (
    entries: { address: string; category: string; name?: string; source: string; sourceUrl?: string }[],
  ) => {
    for (const e of entries) {
      const cat = SEED_TO_CATEGORY[e.category] ?? e.category;
      const name = e.name ?? cat;
      const id = `seed:${cat}:${name}`.toLowerCase();
      const ent =
        groups.get(id) ??
        ({
          id,
          name,
          category: cat,
          risk_level:
            cat === "sanctioned"
              ? 100
              : cat === "mixer"
                ? 80
                : cat === "exploit"
                  ? 75
                  : cat === "phishing" || cat === "scam"
                    ? 70
                    : cat === "cex"
                      ? 10
                      : 20,
          status: "active",
          tags: ["seed"],
          source: "seed-import",
          addresses: [],
          description: undefined,
          website: undefined,
        } satisfies DirectoryEntity);
      ent.addresses.push({
        chain_id: 1,
        address: e.address.toLowerCase(),
        confidence: cat === "sanctioned" ? 95 : 70,
        source_id: e.source,
        evidence_url: e.sourceUrl,
      });
      groups.set(id, ent);
    }
  };
  collect(OFAC_SDN);
  collect(MIXERS);
  collect(CEX_ADDRESSES);
  collect(BRIDGES);
  collect(DEFI_KNOWN);
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}

let seedCache: DirectoryEntity[] | null = null;
function seedEntities(): DirectoryEntity[] {
  if (!seedCache) seedCache = buildFromSeed();
  return seedCache;
}

function applyFilters(entities: DirectoryEntity[], q: string | undefined, category: string | undefined, status: string | undefined) {
  return entities.filter((e) => {
    if (status && e.status !== status) return false;
    if (category && e.category !== category) return false;
    if (q) {
      const needle = q.toLowerCase();
      const inName = e.name.toLowerCase().includes(needle);
      const inAddr = e.addresses.some((a) => a.address.includes(needle));
      if (!inName && !inAddr) return false;
    }
    return true;
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const { q, category, status, limit, offset } = parsed.data;

  const sb = getSupabaseServer();
  if (sb) {
    let query = sb
      .from("risk_entities")
      .select(
        "id, name, category_id, risk_level, status, description, website, tags, updated_at, risk_entity_addresses(chain_id, address, confidence, source_id, evidence_url, valid_to)",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);
    if (status) query = query.eq("status", status);
    if (category) query = query.eq("category_id", category);
    if (q) {
      const sanitized = q.replace(/[%]/g, "");
      const inAddress = isEvmAddress(q.trim()) ? normalizeAddress(q.trim()) : null;
      if (inAddress) {
        const { data: addrRows } = await sb
          .from("risk_entity_addresses")
          .select("entity_id")
          .eq("address", inAddress)
          .limit(50);
        const ids = (addrRows ?? []).map((r) => r.entity_id).filter(Boolean) as string[];
        if (ids.length === 0) {
          return NextResponse.json({ entities: [], total: 0, source: "db" });
        }
        query = query.in("id", ids);
      } else {
        query = query.ilike("name", `%${sanitized}%`);
      }
    }
    const { data, error, count } = await query;
    if (error) {
      log("api/directory", "warn", "list_failed", { err: error.message });
    } else {
      const now = Date.now();
      const entities: DirectoryEntity[] = (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        category: row.category_id as string,
        risk_level: (row.risk_level as number) ?? 0,
        status: (row.status as string) ?? "active",
        description: (row.description as string | null) ?? undefined,
        website: (row.website as string | null) ?? undefined,
        tags: ((row.tags as string[] | null) ?? []) as string[],
        source: "directory",
        addresses: ((row.risk_entity_addresses as unknown[] | null) ?? [])
          .map((raw) => raw as {
            chain_id: number;
            address: string;
            confidence: number | null;
            source_id: string | null;
            evidence_url: string | null;
            valid_to: string | null;
          })
          .filter((a) => !a.valid_to || Date.parse(a.valid_to) > now)
          .map((a) => ({
            chain_id: a.chain_id,
            address: a.address.toLowerCase(),
            confidence: a.confidence ?? 70,
            source_id: a.source_id ?? undefined,
            evidence_url: a.evidence_url ?? undefined,
          })),
      }));
      return NextResponse.json({
        entities,
        total: count ?? entities.length,
        source: "db",
        snapshots: listSnapshots(),
      });
    }
  }

  const all = seedEntities();
  const filtered = applyFilters(all, q, category, status);
  return NextResponse.json({
    entities: filtered.slice(offset, offset + limit),
    total: filtered.length,
    source: "seed",
    snapshots: listSnapshots(),
  });
}
