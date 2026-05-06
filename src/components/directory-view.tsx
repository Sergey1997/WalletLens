"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Filter,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { DirectoryEntity } from "@/app/api/directory/route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { categoryLabel, CategoryIcon } from "@/components/category-icon";
import { CHAIN_BY_ID, type ChainId } from "@/lib/chains";
import { cn, shortAddress } from "@/lib/utils";

interface DirectoryResponse {
  entities: DirectoryEntity[];
  total: number;
  source: "db" | "seed";
  snapshots: { source: string; version: string; size: number; updatedAtMs: number }[];
}

const CATEGORY_FILTERS: { id: string; label: string }[] = [
  { id: "", label: "All" },
  { id: "sanctioned", label: "Sanctioned" },
  { id: "mixer", label: "Mixers" },
  { id: "exploit", label: "Exploits" },
  { id: "scam", label: "Scams" },
  { id: "darknet_market", label: "Darknet" },
  { id: "ransom", label: "Ransom" },
  { id: "gambling", label: "Gambling" },
  { id: "exchange_unlicensed", label: "Unlicensed" },
  { id: "cex", label: "CEX" },
  { id: "defi", label: "DeFi" },
  { id: "bridge", label: "Bridges" },
];

function riskTone(level: number) {
  if (level >= 80) return "text-red-700";
  if (level >= 50) return "text-amber-700";
  if (level >= 25) return "text-sky-700";
  return "text-emerald-700";
}

function levelLabel(level: number) {
  if (level >= 80) return "Severe";
  if (level >= 50) return "High";
  if (level >= 25) return "Medium";
  if (level > 0) return "Low";
  return "Info";
}

export function DirectoryView() {
  const [data, setData] = useState<DirectoryResponse | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (category) params.set("category", category);
        params.set("limit", "120");
        const res = await fetch(`/api/directory?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DirectoryResponse;
        if (cancelled) return;
        setData(json);
        if (json.entities.length > 0) {
          setSelectedId((prev) =>
            prev && json.entities.some((e) => e.id === prev) ? prev : json.entities[0].id,
          );
        } else {
          setSelectedId(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unexpected error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const id = window.setTimeout(run, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [query, category]);

  const selected = useMemo(
    () => data?.entities.find((e) => e.id === selectedId) ?? null,
    [data, selectedId],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Risk Directory{" "}
            <span className="text-muted-foreground">({data?.total.toLocaleString() ?? "—"})</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse risky services and the addresses associated with them. Source:{" "}
            <span className="text-foreground/80">{data?.source ?? "—"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <Plus className="h-3.5 w-3.5" />
            Add entity
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Filter className="h-3.5 w-3.5" />
            Filters
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Entity name or 0x address"
                className="h-10 pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_FILTERS.map((c) => (
                <button
                  key={c.id || "all"}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                    category === c.id
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <div className="max-h-[640px] overflow-y-auto border-t border-border/60">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> loading entities…
              </div>
            )}
            {!loading && error && (
              <div className="px-4 py-6 text-sm text-red-700">{error}</div>
            )}
            {!loading && !error && data?.entities.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nothing matched your filter. Try a different search.
              </div>
            )}
            <ul>
              {data?.entities.map((e) => {
                const active = selectedId === e.id;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        active ? "bg-muted/40" : "hover:bg-muted/20",
                      )}
                    >
                      <CategoryIcon category={e.category} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{e.name}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {categoryLabel(e.category)} · {e.addresses.length} addr
                        </div>
                      </div>
                      <span className={cn("text-xs font-semibold tabular-nums", riskTone(e.risk_level))}>
                        {e.risk_level}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>

        <EntityDetail entity={selected} />
      </div>
    </div>
  );
}

function EntityDetail({ entity }: { entity: DirectoryEntity | null }) {
  if (!entity) {
    return (
      <Card>
        <CardContent className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
          <CategoryIcon category="wallet" size="lg" />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Select an entity from the list to see its addresses, sources and supported assets.
          </p>
        </CardContent>
      </Card>
    );
  }

  const grouped = entity.addresses.reduce<Record<number, typeof entity.addresses>>((acc, a) => {
    (acc[a.chain_id] ??= []).push(a);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <CategoryIcon category={entity.category} size="lg" />
          <div className="space-y-1">
            <CardTitle className="text-xl">{entity.name}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{categoryLabel(entity.category)}</Badge>
              <Badge variant={entity.status === "active" ? "success" : "outline"}>
                {entity.status}
              </Badge>
              <span>·</span>
              <span>
                Risk level{" "}
                <span className={cn("font-semibold", riskTone(entity.risk_level))}>
                  {entity.risk_level}% {levelLabel(entity.risk_level)}
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {entity.website && (
            <a
              href={entity.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {entity.website.replace(/^https?:\/\//, "")}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <Button variant="outline" size="sm" disabled>
            <ShieldCheck className="h-3.5 w-3.5" />
            View in explorer
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="addresses">
              Addresses
              <Badge variant="outline" className="ml-1 text-[10px]">
                {entity.addresses.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <KV label="Category" value={categoryLabel(entity.category)} />
              <KV label="Status" value={entity.status} />
              <KV label="Risk level" value={`${entity.risk_level}% (${levelLabel(entity.risk_level)})`} />
              <KV
                label="Tags"
                value={entity.tags.length > 0 ? entity.tags.join(", ") : "—"}
              />
            </div>
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                Description
              </div>
              <p className="text-sm text-muted-foreground">
                {entity.description ??
                  "No description provided. Add one in the Directory admin once that screen is enabled."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(grouped).map(([chainId, list]) => {
                const cfg = CHAIN_BY_ID[Number(chainId) as ChainId];
                return (
                  <div
                    key={chainId}
                    className="surface-muted rounded-xl px-3 py-3"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {cfg?.shortName ?? `chain ${chainId}`}
                    </div>
                    <div className="mt-1 text-lg font-semibold">{list.length}</div>
                    <div className="text-[11px] text-muted-foreground">addresses</div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="addresses" className="mt-4">
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Address</th>
                    <th className="px-3 py-2 text-left font-medium">Chain</th>
                    <th className="px-3 py-2 text-right font-medium">Confidence</th>
                    <th className="px-3 py-2 text-left font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {entity.addresses.map((a) => {
                    const cfg = CHAIN_BY_ID[a.chain_id as ChainId];
                    return (
                      <tr key={`${a.chain_id}-${a.address}`} className="table-row">
                        <td className="px-3 py-2">
                          <a
                            href={cfg ? `${cfg.explorerUrl}/address/${a.address}` : a.evidence_url ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="mono text-xs hover:underline"
                          >
                            {shortAddress(a.address, 8, 6)}
                          </a>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {cfg?.name ?? `Chain ${a.chain_id}`}
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">{a.confidence}%</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {a.source_id ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="sources" className="mt-4 space-y-2">
            {entity.addresses.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground"
              >
                <span>{a.source_id ?? "internal"}</span>
                {a.evidence_url ? (
                  <a
                    href={a.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    evidence <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span>no link</span>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium capitalize">{value}</div>
    </div>
  );
}
