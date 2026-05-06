"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AddressInput } from "@/components/address-input";
import { ReportView } from "@/components/report-view";
import { CHAINS } from "@/lib/chains";
import type { AddressReport } from "@/lib/types";
import { isEvmAddress } from "@/lib/address";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
  "Match risk directory",
  "Build report and JSON output",
];

function CheckPageInner() {
  const params = useSearchParams();
  const queryAddress = params.get("address");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiSuccess | null>(null);
  const [latestReports, setLatestReports] = useState<AddressReport[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [autoTriggered, setAutoTriggered] = useState(false);

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

  const analyze = useCallback(
    async (address: string, force = false) => {
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
        setLatestReports((prev) =>
          [
            ok.report,
            ...prev.filter((x) => x.address.toLowerCase() !== ok.report.address.toLowerCase()),
          ].slice(0, 8),
        );
        void fetchLatestReports();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [fetchLatestReports],
  );

  useEffect(() => {
    if (!queryAddress || autoTriggered) return;
    if (isEvmAddress(queryAddress)) {
      setAutoTriggered(true);
      void analyze(queryAddress);
    }
  }, [queryAddress, autoTriggered, analyze]);

  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 pt-6 sm:px-6">
      <section className="flex flex-col items-center text-center">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Analyze wallet</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          0–100 score across {CHAINS.map((c) => c.shortName).join(" / ")} with public risk signals.
        </p>
        <div className="mt-4 w-full max-w-xl">
          <AddressInput onSubmit={(a) => analyze(a)} loading={loading} />
        </div>
        {loading && (
          <div className="mt-4 w-full max-w-xl">
            <ProgressPanel elapsed={elapsed} />
          </div>
        )}
      </section>

      {latestReports.length > 0 && !loading && (
        <section className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Latest reports
            </h2>
            <span className="text-[11px] text-muted-foreground">shared across all users</span>
          </div>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border/60">
                {latestReports.slice(0, 12).map((report) => (
                  <li key={`${report.address}-${report.createdAtMs}`}>
                    <button
                      className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left hover:bg-muted/30"
                      onClick={() => {
                        setError(null);
                        setData({ report, cached: true });
                      }}
                      disabled={loading}
                    >
                      <span className="mono truncate text-[11px] text-foreground/90">{report.address}</span>
                      <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>score {report.walletScore}</span>
                        <span className="hidden sm:inline">{report.confidence}</span>
                        <span>{report.alertGrade}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {error && !loading && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="font-medium">Couldn&rsquo;t generate report</div>
          <div className="text-red-700/80">{error}</div>
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
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <CheckPageInner />
    </Suspense>
  );
}

function ProgressPanel({ elapsed }: { elapsed: number }) {
  const active = Math.min(PROGRESS_STEPS.length - 1, Math.floor(elapsed / 2500));
  const percent = Math.min(96, Math.round(((active + 1) / PROGRESS_STEPS.length) * 100));
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2.5 text-left">
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{PROGRESS_STEPS[active]}</span>
        <span className="tabular-nums">{Math.floor(elapsed / 1000)}s</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
