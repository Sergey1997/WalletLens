"use client";

import { useMemo, useState } from "react";
import {
  Bookmark,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type {
  AddressReport,
  ApiCounterparty,
  ChainFacts,
  GraphExposure,
  LabelEntry,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { RiskGauge } from "./risk-gauge";
import { ChainCard } from "./chain-card";
import { FactorRow, TrustRow } from "./factor-row";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { CategoryIcon, categoryLabel } from "./category-icon";
import { CHAIN_BY_ID, type ChainId, explorerAddressUrl } from "@/lib/chains";
import { cn, shortAddress } from "@/lib/utils";

interface DirectExposure {
  category: LabelEntry["category"];
  label: LabelEntry;
  chainId: ChainId;
  direction: "in" | "out" | "both";
  txCount: number;
}

function collectDirectExposures(chains: ChainFacts[]): DirectExposure[] {
  const out: DirectExposure[] = [];
  for (const c of chains) {
    if (!c.available) continue;
    for (const cp of c.topCounterparties) {
      if (!cp.label) continue;
      out.push({
        category: cp.label.category,
        label: cp.label,
        chainId: c.chainId,
        direction: cp.direction,
        txCount: cp.txCount,
      });
    }
  }
  return out;
}

function collectIndirectExposures(chains: ChainFacts[]): GraphExposure[] {
  const out: GraphExposure[] = [];
  for (const c of chains) {
    out.push(...(c.graph?.exposures ?? []));
  }
  return out.sort((a, b) => a.depth - b.depth);
}

function gradeMeta(grade: string) {
  switch (grade) {
    case "high":
      return { label: "High risk", tone: "text-red-700", chip: "border-red-200 bg-red-50" };
    case "medium":
      return {
        label: "Medium risk",
        tone: "text-amber-700",
        chip: "border-amber-200 bg-amber-50",
      };
    case "low":
      return {
        label: "Low risk",
        tone: "text-sky-700",
        chip: "border-sky-200 bg-sky-50",
      };
    default:
      return {
        label: "Clean",
        tone: "text-emerald-700",
        chip: "border-emerald-200 bg-emerald-50",
      };
  }
}

function flaggedMeta(flag: string) {
  if (flag === "flagged") return { label: "FLAGGED", variant: "severe" as const };
  if (flag === "watch") return { label: "WATCH", variant: "warning" as const };
  return { label: "CLEAR", variant: "success" as const };
}

export function ReportView({ report, cached }: { report: AddressReport; cached?: boolean }) {
  const [adding, setAdding] = useState<"idle" | "loading" | "added">("idle");
  const created = new Date(report.createdAtMs).toLocaleString();
  const expires = new Date(report.expiresAtMs).toLocaleString();
  const json = JSON.stringify(report, null, 2);
  const grade = gradeMeta(report.alertGrade);
  const flag = flaggedMeta(report.flagged);

  const directExposures = useMemo(() => collectDirectExposures(report.chains), [report.chains]);
  const indirectExposures = useMemo(() => collectIndirectExposures(report.chains), [report.chains]);
  const directLabels = useMemo(() => {
    const map = new Map<string, DirectExposure>();
    for (const ex of directExposures) {
      const key = `${ex.label.address.toLowerCase()}-${ex.chainId}`;
      if (!map.has(key)) map.set(key, ex);
    }
    return Array.from(map.values());
  }, [directExposures]);

  const profileImpact = useMemo(() => buildProfileImpact(report), [report]);

  const addToWatchlist = async () => {
    setAdding("loading");
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: report.address }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAdding("added");
    } catch {
      setAdding("idle");
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <Card>
        <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Wallet report</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {report.methodologyVersion}
              </Badge>
              <Badge variant={flag.variant}>{flag.label}</Badge>
              <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[11px]", grade.chip)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", grade.tone, "bg-current")} />
                <span className={grade.tone}>{grade.label}</span>
              </span>
              {cached && <Badge variant="info">cached</Badge>}
            </div>
            <p className="mono text-xs text-muted-foreground break-all">{report.address}</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Button
              variant="outline"
              size="sm"
              onClick={addToWatchlist}
              disabled={adding !== "idle"}
            >
              {adding === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : adding === "added" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
              {adding === "added" ? "Added" : "Watchlist"}
            </Button>
            <a
              href={explorerAddressUrl(report.chains[0]?.chainId ?? 1, report.address)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 hover:border-primary/60"
            >
              Explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <RiskGauge
            walletScore={report.walletScore}
            riskBurden={report.riskScore}
            trustScore={report.trustScore}
            confidence={report.confidence}
          />

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border/60 pt-4 text-sm sm:grid-cols-4">
            <Field label="Total scanned txs" value={report.summary.totalTxs.toLocaleString()} />
            <Field
              label="Active chains"
              value={`${report.summary.activeChains} / ${report.chains.length}`}
            />
            <Field label="Depth wallets" value={String(report.dataDepth.walletsScanned)} />
            <Field label="Alert grade" value={report.alertGrade.toUpperCase()} />
            <Field label="Counterparties" value={String(report.counterparty.length)} />
            <Field
              label="Graph"
              value={`${report.dataDepth.maxDepth} hops · ${report.dataDepth.exposures} exp.`}
            />
            <Field label="Direct hits" value={String(directLabels.length)} />
            <Field
              label="Reasons"
              value={report.flagReason.length ? `${report.flagReason.length} listed` : "none"}
            />
          </div>

          <div className="text-[11px] text-muted-foreground">
            generated {created} · fresh until {expires} · profile{" "}
            <span className="text-foreground/80">{report.riskscore_profile.id}</span> ·{" "}
            {report.riskscore_profile.version}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-1 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Risk Score Profile</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Categories that influenced this score, with direction of flow.
            </p>
          </div>
          <Badge variant="outline">{report.riskscore_profile.id}</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          {profileImpact.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No risky categories were triggered for this wallet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Entity type</th>
                    <th className="px-3 py-2 text-right font-medium">Score impact</th>
                    <th className="px-3 py-2 text-left font-medium">Receiving</th>
                    <th className="px-3 py-2 text-left font-medium">Sending</th>
                    <th className="px-3 py-2 text-left font-medium">Direct / hops</th>
                  </tr>
                </thead>
                <tbody>
                  {profileImpact.map((row) => (
                    <tr key={row.category} className="table-row">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <CategoryIcon category={row.category} size="sm" />
                          <div>
                            <div className="font-medium">{categoryLabel(row.category)}</div>
                            <div className="text-[11px] text-muted-foreground">{row.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", impactTone(row.maxWeight))}>
                        −{row.totalWeight}
                      </td>
                      <td className={cn("px-3 py-2", influenceTone(row.received))}>
                        {row.received === "none" ? "—" : capitalize(row.received)}
                      </td>
                      <td className={cn("px-3 py-2", influenceTone(row.sent))}>
                        {row.sent === "none" ? "—" : capitalize(row.sent)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {row.direct > 0 && <span>direct ×{row.direct}</span>}
                        {row.indirect > 0 && (
                          <span className="ml-2">
                            graph ×{row.indirect} (depth {row.maxDepth})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Risk Exposure</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Direct hits are 1-on-1 transfers with risky entities. Indirect exposures are reached via
            the counterparty graph.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue="direct">
            <TabsList>
              <TabsTrigger value="direct">
                Direct
                <Badge variant="outline" className="ml-1 text-[10px]">
                  {directLabels.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="indirect">
                Indirect
                <Badge variant="outline" className="ml-1 text-[10px]">
                  {indirectExposures.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="direct" className="mt-4">
              {directLabels.length === 0 ? (
                <p className="text-sm text-muted-foreground">No direct risky counterparties.</p>
              ) : (
                <div className="space-y-2">
                  {directLabels.map((ex) => (
                    <ExposureRow
                      key={`${ex.label.address}-${ex.chainId}`}
                      category={ex.label.category}
                      name={ex.label.name ?? shortAddress(ex.label.address)}
                      address={ex.label.address}
                      chainId={ex.chainId}
                      meta={`Direct · ${ex.direction.toUpperCase()} · ${ex.txCount} tx`}
                      source={ex.label.source}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="indirect" className="mt-4">
              {indirectExposures.length === 0 ? (
                <p className="text-sm text-muted-foreground">No indirect exposures within the scanned graph depth.</p>
              ) : (
                <div className="space-y-2">
                  {indirectExposures.slice(0, 20).map((ex) => (
                    <ExposureRow
                      key={`${ex.label.address}-${ex.depth}-${ex.via}`}
                      category={ex.label.category}
                      name={ex.label.name ?? shortAddress(ex.label.address)}
                      address={ex.label.address}
                      chainId={ex.chainId}
                      meta={`${ex.depth}-hop via ${shortAddress(ex.via)}`}
                      source={ex.label.source}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Counterparties</CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {report.counterparty.length}
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          {report.counterparty.length === 0 ? (
            <p className="text-sm text-muted-foreground">No counterparties were enriched for this wallet.</p>
          ) : (
            <CounterpartyTable counterparties={report.counterparty} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Per-chain profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {report.chains.map((c) => (
              <ChainCard key={c.chainId} chain={c} address={report.address} />
            ))}
          </div>
        </CardContent>
      </Card>

      {(report.factors.length > 0 || report.trust.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Findings</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Weighted risk factors and positive trust signals; each row is independently verifiable.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.factors.map((f) => (
              <FactorRow key={f.id} f={f} />
            ))}
            {report.trust.map((t) => (
              <TrustRow key={t.id} t={t} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sources & raw output</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            {report.listVersions.map((l) => (
              <li
                key={l.source}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-1.5"
              >
                <span>{l.source}</span>
                <span className="mono">{l.version}</span>
              </li>
            ))}
          </ul>
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              Show full JSON response
            </summary>
            <div className="mt-3 flex justify-end">
              <button
                className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => navigator.clipboard?.writeText(json)}
              >
                copy
              </button>
            </div>
            <pre className="code-block mono mt-2 max-h-[460px] overflow-auto rounded-lg p-3 text-[11px] leading-relaxed">
              {json}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

function ExposureRow({
  category,
  name,
  address,
  chainId,
  meta,
  source,
}: {
  category: LabelEntry["category"];
  name: string;
  address: string;
  chainId: ChainId;
  meta: string;
  source: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <CategoryIcon category={category} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="text-[11px] text-muted-foreground">
            {categoryLabel(category)} · {meta}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <a
          href={explorerAddressUrl(chainId, address)}
          target="_blank"
          rel="noreferrer"
          className="mono inline-flex items-center gap-1 hover:text-foreground"
        >
          {shortAddress(address)} <ExternalLink className="h-3 w-3" />
        </a>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:inline">{source}</span>
      </div>
    </div>
  );
}

function CounterpartyTable({ counterparties }: { counterparties: ApiCounterparty[] }) {
  const display = counterparties.slice(0, 25);
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-[11px] uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Entity</th>
            <th className="px-3 py-2 text-left font-medium">Type</th>
            <th className="px-3 py-2 text-left font-medium">Address</th>
            <th className="px-3 py-2 text-right font-medium">Hops</th>
            <th className="px-3 py-2 text-right font-medium">Exposure</th>
            <th className="px-3 py-2 text-right font-medium">Conn.</th>
          </tr>
        </thead>
        <tbody>
          {display.map((cp) => {
            const minHops = cp.connections.length
              ? Math.min(...cp.connections.map((c) => c.hops))
              : 0;
            const maxExposure = cp.connections.length
              ? Math.max(...cp.connections.map((c) => c.exposure))
              : 0;
            return (
              <tr key={cp.id} className="table-row">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={cp.type} size="sm" />
                    <span className="truncate">{cp.name ?? shortAddress(cp.address)}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{categoryLabel(cp.type)}</td>
                <td className="px-3 py-2 mono text-xs text-muted-foreground">
                  {shortAddress(cp.address)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                  {minHops > 0 ? minHops : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs">
                  {maxExposure > 0 ? maxExposure.toFixed(2) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs">{cp.connections.length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {counterparties.length > display.length && (
        <div className="border-t border-border/60 bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
          showing {display.length} of {counterparties.length}; full list in JSON
        </div>
      )}
    </div>
  );
}

interface ProfileImpactRow {
  category: LabelEntry["category"];
  totalWeight: number;
  maxWeight: number;
  direct: number;
  indirect: number;
  maxDepth: number;
  received: "none" | "low" | "medium" | "high";
  sent: "none" | "low" | "medium" | "high";
}

function buildProfileImpact(report: AddressReport): ProfileImpactRow[] {
  const map = new Map<string, ProfileImpactRow>();
  for (const f of report.factors) {
    const cat = inferCategoryFromFactorId(f.id);
    if (!cat) continue;
    const prev = map.get(cat) ?? {
      category: cat,
      totalWeight: 0,
      maxWeight: 0,
      direct: 0,
      indirect: 0,
      maxDepth: 0,
      received: inferInfluence(0),
      sent: inferInfluence(0),
    };
    prev.totalWeight += f.weight;
    prev.maxWeight = Math.max(prev.maxWeight, f.weight);
    if (f.id.startsWith("graph:")) {
      prev.indirect += 1;
      const depth = Number(f.id.split(":")[3]);
      if (Number.isFinite(depth)) prev.maxDepth = Math.max(prev.maxDepth, depth);
    } else {
      prev.direct += 1;
    }
    prev.received = strongerInfluence(prev.received, inferInfluence(prev.maxWeight));
    prev.sent = strongerInfluence(prev.sent, inferInfluence(prev.maxWeight));
    map.set(cat, prev);
  }
  return Array.from(map.values()).sort((a, b) => b.maxWeight - a.maxWeight);
}

function inferCategoryFromFactorId(id: string): LabelEntry["category"] | null {
  const parts = id.startsWith("graph:") ? id.split(":")[1] : id.split(":")[0];
  switch (parts) {
    case "sanctioned":
    case "mixer":
    case "exploit":
    case "phishing":
    case "scam":
    case "darknet_market":
    case "ransom":
    case "gambling":
    case "exchange_unlicensed":
      return parts;
    default:
      return null;
  }
}

function inferInfluence(weight: number): "none" | "low" | "medium" | "high" {
  if (weight <= 0) return "none";
  if (weight < 25) return "low";
  if (weight < 60) return "medium";
  return "high";
}

const INFLUENCE_RANK: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 };
function strongerInfluence(
  a: "none" | "low" | "medium" | "high",
  b: "none" | "low" | "medium" | "high",
) {
  return INFLUENCE_RANK[a] >= INFLUENCE_RANK[b] ? a : b;
}

function influenceTone(level: "none" | "low" | "medium" | "high") {
  switch (level) {
    case "high":
      return "text-red-700";
    case "medium":
      return "text-amber-700";
    case "low":
      return "text-sky-700";
    default:
      return "text-emerald-700";
  }
}

function impactTone(weight: number) {
  if (weight >= 80) return "text-red-700";
  if (weight >= 50) return "text-amber-700";
  if (weight >= 25) return "text-sky-700";
  return "text-emerald-700";
}

function capitalize(s: string) {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
