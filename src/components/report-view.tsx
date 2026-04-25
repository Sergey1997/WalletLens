"use client";

import { Copy, ExternalLink, Info } from "lucide-react";
import type { AddressReport } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { RiskGauge } from "./risk-gauge";
import { ChainCard } from "./chain-card";
import { FactorRow, TrustRow } from "./factor-row";
import { Badge } from "./ui/badge";

export function ReportView({ report, cached }: { report: AddressReport; cached?: boolean }) {
  const created = new Date(report.createdAtMs).toLocaleString();
  const expires = new Date(report.expiresAtMs).toLocaleString();
  const json = JSON.stringify(report, null, 2);

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle>Wallet report</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {report.methodologyVersion}
              </Badge>
              {cached && <Badge variant="info">cached</Badge>}
            </div>
            <p className="mono text-xs text-muted-foreground break-all">{report.address}</p>
          </div>
          <div className="text-xs text-muted-foreground text-right">
            <div>generated {created}</div>
            <div>fresh until {expires}</div>
          </div>
        </CardHeader>
        <CardContent>
          <RiskGauge
            walletScore={report.walletScore}
            riskBurden={report.riskScore}
            trustScore={report.trustScore}
            confidence={report.confidence}
          />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Total scanned txs" value={report.summary.totalTxs.toLocaleString()} />
            <Kpi label="Active chains" value={`${report.summary.activeChains} / ${report.chains.length}`} />
            <Kpi label="Depth wallets" value={String(report.dataDepth.walletsScanned)} />
            <Kpi label="Alert grade" value={report.alertGrade.toUpperCase()} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Badge variant={report.flagged === "flagged" ? "severe" : report.flagged === "watch" ? "warning" : "success"}>
              flagged: {report.flagged}
            </Badge>
            <Badge variant="outline">risky volume: {report.riskyVolume}</Badge>
            <Badge variant="outline">risky fiat: {report.riskyVolumeFiat}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compact report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Compact label="Score" value={`${report.walletScore}/100`} />
            <Compact label="Risk score" value={report.riskscore.toFixed(2)} />
            <Compact label="Confidence" value={report.confidence} />
            <Compact label="Graph depth" value={`${report.dataDepth.maxDepth} hops · ${report.dataDepth.walletsScanned} wallets`} />
            <Compact label="Flagged" value={report.flagged} />
            <Compact label="Reasons" value={report.flagReason.length ? report.flagReason.slice(0, 3).join("; ") : "none"} />
          </div>
        </CardContent>
      </Card>

      {report.alertType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Risk signals</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Normalized signals from 0 to 1 for the categories detected in this check.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(report.signals)
                .filter(([, value]) => value > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([key, value]) => (
                  <div key={key} className="glass rounded-lg p-3">
                    <div className="mono text-xs text-muted-foreground">{key}</div>
                    <div className="mt-1 text-xl font-semibold">{value.toFixed(2)}</div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>API fields</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Structured fields for integrations and downstream review.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <Compact label="id" value={report.id} />
            <Compact label="status" value={report.status} />
            <Compact label="currency" value={report.currency} />
            <Compact label="riskscore" value={report.riskscore.toFixed(4)} />
            <Compact label="alert_grade" value={report.alert_grade} />
            <Compact label="counterparty" value={String(report.counterparty.length)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-chain profile</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Facts collected from public explorers. Chain hits are shown as tags; unknown counterparties are left un-tagged.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {report.chains.map((c) => (
              <ChainCard key={c.chainId} chain={c} address={report.address} />
            ))}
          </div>
        </CardContent>
      </Card>

      {report.factors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Risk factors</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Weighted signals. Sum is capped at 100; each row is independently verifiable.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.factors.map((f) => (
              <FactorRow key={f.id} f={f} />
            ))}
          </CardContent>
        </Card>
      )}

      {report.trust.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trust signals</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Positive attribution data. Not a certificate of safety.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.trust.map((t) => (
              <TrustRow key={t.id} t={t} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4" /> Sources & limitations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ul className="grid gap-2 sm:grid-cols-2">
            {report.listVersions.map((l) => (
              <li key={l.source} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span>{l.source}</span>
                <span className="mono text-xs">{l.version}</span>
              </li>
            ))}
          </ul>
          <p>
            This report surfaces <em> public signals</em> (sanctions-list matches, community labels, behavioural
            heuristics) with explicit confidence and weight. It does not publish accusations; for regulated workflows,
            combine this signal layer with a licensed risk-oracle (TRM, Chainalysis, Elliptic, Merkle Science).
          </p>
          <a
            href="https://home.treasury.gov/policy-issues/financial-sanctions/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-foreground hover:underline"
          >
            OFAC SDN list <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>JSON output</CardTitle>
          <button
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigator.clipboard?.writeText(json)}
          >
            <Copy className="h-3 w-3" /> copy
          </button>
        </CardHeader>
        <CardContent>
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">Show full API response</summary>
            <pre className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-border bg-black/30 p-4 text-xs">
              {json}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function Compact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/80 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
