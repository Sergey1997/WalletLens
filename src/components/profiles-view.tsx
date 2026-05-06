"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Settings2, Sliders } from "lucide-react";
import type { ProfileCategoryConfig, RiskScoreProfile } from "@/app/api/profiles/route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryIcon, categoryLabel } from "@/components/category-icon";
import { cn } from "@/lib/utils";

interface ProfilesResponse {
  profiles: RiskScoreProfile[];
  default_id: string;
  source: "db" | "fallback";
}

const INFLUENCE_TONE: Record<string, string> = {
  none: "text-emerald-700",
  low: "text-sky-700",
  medium: "text-amber-700",
  high: "text-red-700",
};

function influenceLabel(value?: string) {
  if (!value || value === "none") return "None";
  return value[0].toUpperCase() + value.slice(1);
}

function inferInfluence(weight: number | undefined): "none" | "low" | "medium" | "high" {
  if (!weight || weight <= 0) return "none";
  if (weight < 25) return "low";
  if (weight < 60) return "medium";
  return "high";
}

function riskTone(score: number) {
  if (score >= 80) return "text-red-700";
  if (score >= 50) return "text-amber-700";
  if (score >= 25) return "text-sky-700";
  return "text-emerald-700";
}

export function ProfilesView() {
  const [data, setData] = useState<ProfilesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profiles", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ProfilesResponse;
        if (cancelled) return;
        setData(json);
        setSelectedId(json.default_id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unexpected error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => data?.profiles.find((p) => p.id === selectedId) ?? null,
    [data, selectedId],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Risk Score Profiles</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Profiles control how each risk category influences a wallet score. Change a profile to
            stress-test the impact of receiving versus sending and direct versus indirect exposure.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <Plus className="h-3.5 w-3.5" />
            New profile
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Settings2 className="h-3.5 w-3.5" />
            Edit profile
          </Button>
        </div>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> loading profiles…
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="py-8 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && data && (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Profiles</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {data.profiles.length}
              </Badge>
            </CardHeader>
            <ul className="border-t border-border/60">
              {data.profiles.map((p) => {
                const active = selectedId === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={cn(
                        "flex w-full items-center justify-between px-4 py-3 text-left transition-colors",
                        active ? "bg-muted/40" : "hover:bg-muted/20",
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {p.name}
                          {p.is_default && <Badge variant="success">default</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.version} · {p.source}
                          {p.created_by ? ` · by ${p.created_by}` : ""}
                        </div>
                      </div>
                      <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <ProfileDetail profile={selected} />
        </div>
      )}
    </div>
  );
}

function ProfileDetail({ profile }: { profile: RiskScoreProfile | null }) {
  if (!profile) return null;
  const categories = Object.entries(profile.config.categories ?? {});
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">{profile.name}</CardTitle>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{profile.version}</Badge>
            <Badge variant={profile.is_default ? "success" : "outline"}>
              {profile.is_default ? "default" : "custom"}
            </Badge>
            <span>·</span>
            <span>{profile.source}</span>
            {profile.updated_at && (
              <>
                <span>·</span>
                <span>updated {new Date(profile.updated_at).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="categories">
          <TabsList>
            <TabsTrigger value="categories">Risk categories</TabsTrigger>
            <TabsTrigger value="trust">Trust signals</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-4">
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Entity type</th>
                    <th className="px-3 py-2 text-right font-medium">Self</th>
                    <th className="px-3 py-2 text-right font-medium">Direct</th>
                    <th className="px-3 py-2 text-right font-medium">1 hop</th>
                    <th className="px-3 py-2 text-right font-medium">2 hop</th>
                    <th className="px-3 py-2 text-left font-medium">Receiving</th>
                    <th className="px-3 py-2 text-left font-medium">Sending</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(([cat, cfg]) => (
                    <CategoryRow key={cat} cat={cat} cfg={cfg} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Direct = 1-on-1 interaction. 1/2 hop apply when the risky entity is reached through one
              or two intermediate wallets. Receiving and sending influence levels show how the
              direction of the flow affects the score for this category.
            </p>
          </TabsContent>

          <TabsContent value="trust" className="mt-4 space-y-2">
            {Object.entries(profile.config.trust ?? {}).length === 0 && (
              <p className="text-sm text-muted-foreground">No trust weights configured for this profile.</p>
            )}
            {Object.entries(profile.config.trust ?? {}).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <CategoryIcon category={key} size="sm" />
                  <span>{categoryLabel(key)}</span>
                </div>
                <span className="text-emerald-700 tabular-nums">+{value}</span>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="json" className="mt-4">
            <pre className="code-block mono max-h-[420px] overflow-auto rounded-lg p-3 text-[11px] leading-relaxed">
              {JSON.stringify(profile.config, null, 2)}
            </pre>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function CategoryRow({ cat, cfg }: { cat: string; cfg: ProfileCategoryConfig }) {
  const direct = cfg.direct ?? 0;
  const recv = cfg.received ?? inferInfluence(direct);
  const send = cfg.sent ?? inferInfluence(direct);
  return (
    <tr className="table-row">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2.5">
          <CategoryIcon category={cat} size="sm" />
          <div>
            <div className="text-sm font-medium">{categoryLabel(cat)}</div>
            <div className="text-[11px] text-muted-foreground">{cat}</div>
          </div>
        </div>
      </td>
      <td className={cn("px-3 py-2 text-right tabular-nums", riskTone(cfg.self ?? 0))}>
        {cfg.self ? `${cfg.self}%` : "—"}
      </td>
      <td className={cn("px-3 py-2 text-right tabular-nums", riskTone(direct))}>
        {direct ? `${direct}%` : "—"}
      </td>
      <td className={cn("px-3 py-2 text-right tabular-nums", riskTone(cfg["1hop"] ?? 0))}>
        {cfg["1hop"] ? `${cfg["1hop"]}%` : "—"}
      </td>
      <td className={cn("px-3 py-2 text-right tabular-nums", riskTone(cfg["2hop"] ?? 0))}>
        {cfg["2hop"] ? `${cfg["2hop"]}%` : "—"}
      </td>
      <td className={cn("px-3 py-2", INFLUENCE_TONE[recv])}>{influenceLabel(recv)}</td>
      <td className={cn("px-3 py-2", INFLUENCE_TONE[send])}>{influenceLabel(send)}</td>
    </tr>
  );
}
