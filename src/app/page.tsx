"use client";

import { useCallback, useEffect, useState } from "react";
import { AddressInput } from "@/components/address-input";
import { ReportView } from "@/components/report-view";
import { CHAINS } from "@/lib/chains";
import type { AddressReport } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface ApiSuccess {
  report: AddressReport;
  cached: boolean;
}

interface ReportsSuccess {
  reports: AddressReport[];
}

const PROGRESS_STEPS = [
  "Validate address",
  "Fetch Ethereum activity",
  "Fetch Base activity",
  "Expand graph counterparties",
  "Match public risk lists",
  "Build report and JSON output",
];

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiSuccess | null>(null);
  const [latestReports, setLatestReports] = useState<AddressReport[]>([]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 500);
    return () => window.clearInterval(timer);
  }, [loading]);

  const fetchLatestReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as ReportsSuccess;
      setLatestReports(json.reports ?? []);
    } catch {
      setLatestReports([]);
    }
  }, []);

  useEffect(() => {
    void fetchLatestReports();
  }, [fetchLatestReports]);

  const analyze = useCallback(async (address: string, force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, force }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `Request failed: HTTP ${res.status}`);
        setData(null);
        return;
      }
      const ok = json as ApiSuccess;
      setData(ok);
      setLatestReports((prev) => [
        ok.report,
        ...prev.filter((x) => x.address.toLowerCase() !== ok.report.address.toLowerCase()),
      ].slice(0, 8));
      void fetchLatestReports();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetchLatestReports]);

  const showLanding = !data && !loading && !error;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 pb-24 pt-8 sm:px-6">
      <header className="flex items-center justify-between border-b border-border/60 pb-5">
        <div className="font-semibold tracking-tight">WalletLens</div>
        <a
          className="text-xs text-muted-foreground hover:text-foreground"
          href="/methodology"
          target="_blank"
          rel="noreferrer"
        >
          Methodology
        </a>
      </header>

      <section
        className={
          showLanding
            ? "mt-24 flex flex-col items-center text-center"
            : "mt-10 flex flex-col items-center text-center"
        }
      >
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Check any EVM wallet.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Strict 0–100 score with public risk signals across {CHAINS.map((c) => c.shortName).join(" and ")}.
        </p>
        <div className="mt-8 w-full max-w-2xl">
          <AddressInput onSubmit={(a) => analyze(a)} loading={loading} />
        </div>
        {loading && (
          <div className="mt-6 w-full max-w-2xl">
            <ProgressPanel elapsed={elapsed} />
          </div>
        )}
      </section>

      {latestReports.length > 0 && !loading && (
        <section className="mt-10">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground">Latest reports</h2>
            <span className="text-xs text-muted-foreground">all recent checks</span>
          </div>
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {latestReports.slice(0, 8).map((report) => (
              <li key={`${report.address}-${report.createdAtMs}`}>
                <button
                  className="flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left hover:bg-muted/30"
                  onClick={() => {
                    setError(null);
                    setData({ report, cached: true });
                  }}
                  disabled={loading}
                >
                  <span className="mono truncate text-xs text-foreground/90">{report.address}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>score {report.walletScore}</span>
                    <span className="hidden sm:inline">{report.confidence} confidence</span>
                    <span>{report.alertGrade}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && !loading && (
        <div className="mt-8 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          <div className="font-medium">Couldn&rsquo;t generate report</div>
          <div className="text-red-200/80">{error}</div>
        </div>
      )}

      {data && !loading && (
        <section className="mt-10">
          <ReportView report={data.report} cached={data.cached} />
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => analyze(data.report.address, true)}
              disabled={loading}
            >
              Force re-scan (bypass cache)
            </Button>
          </div>
        </section>
      )}

      {showLanding && (
        <section className="mt-16 max-w-2xl text-sm text-muted-foreground">
          <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground">How the score is built</h2>
          <p className="mt-3">
            WalletLens combines public risk lists, chain activity and graph exposure into a strict score, with source
            and weight shown for every finding.
          </p>
        </section>
      )}

      <footer className="mt-auto pt-16 text-center text-xs text-muted-foreground">
        WalletLens · public signals only ·{" "}
        <a className="hover:text-foreground" href="/methodology" target="_blank" rel="noreferrer">
          methodology
        </a>
      </footer>
    </main>
  );
}

function ProgressPanel({ elapsed }: { elapsed: number }) {
  const active = Math.min(PROGRESS_STEPS.length - 1, Math.floor(elapsed / 2500));
  const percent = Math.min(96, Math.round(((active + 1) / PROGRESS_STEPS.length) * 100));
  return (
    <div className="rounded-xl border border-border/60 p-4 text-left">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Analysis in progress · {PROGRESS_STEPS[active]}</span>
        <span>{Math.floor(elapsed / 1000)}s</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        {PROGRESS_STEPS.map((step, i) => (
          <li key={step} className="flex items-center justify-between">
            <span className={i <= active ? "text-foreground" : "text-muted-foreground"}>{step}</span>
            <span
              className={
                i < active
                  ? "text-emerald-300"
                  : i === active
                    ? "text-primary"
                    : "text-muted-foreground"
              }
            >
              {i < active ? "done" : i === active ? "running" : "queued"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
