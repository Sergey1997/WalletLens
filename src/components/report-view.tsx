"use client";

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
  const activeSignals = Object.entries(report.signals)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5 animate-fade-in">
      <Card>
        <CardHeader className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Wallet report</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {report.methodologyVersion}
              </Badge>
              {cached && <Badge variant="info">cached</Badge>}
            </div>
            <p className="mono text-xs text-muted-foreground break-all">{report.address}</p>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <div>generated {created}</div>
            <div>fresh until {expires}</div>
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
            <Field label="Risk score (raw)" value={report.riskscore.toFixed(2)} />
            <Field
              label="Graph"
              value={`${report.dataDepth.maxDepth} hops · ${report.dataDepth.exposures} exp.`}
            />
            <Field label="Counterparties" value={String(report.counterparty.length)} />
            <Field
              label="Reasons"
              value={report.flagReason.length ? `${report.flagReason.length} listed` : "none"}
            />
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge
              variant={
                report.flagged === "flagged"
                  ? "severe"
                  : report.flagged === "watch"
                    ? "warning"
                    : "success"
              }
            >
              flagged: {report.flagged}
            </Badge>
            {activeSignals.slice(0, 6).map(([key, value]) => (
              <Badge key={key} variant="outline" className="mono">
                {key} {value.toFixed(2)}
              </Badge>
            ))}
          </div>
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
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
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
            <pre className="mt-2 max-h-[460px] overflow-auto rounded-lg border border-border bg-black/30 p-3 text-[11px] leading-relaxed">
              {json}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
