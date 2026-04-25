"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, FileJson, Network, ShieldCheck } from "lucide-react";
import { AddressInput } from "@/components/address-input";
import { ReportView } from "@/components/report-view";
import { CHAINS } from "@/lib/chains";
import type { AddressReport } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface ApiSuccess {
  report: AddressReport;
  cached: boolean;
}

interface HistoryItem {
  address: string;
  walletScore: number;
  confidence: AddressReport["confidence"];
  alertGrade: AddressReport["alertGrade"];
  createdAtMs: number;
}

const HISTORY_KEY = "walletlens.analysis.history";

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
  const [history, setHistory] = useState<HistoryItem[]>([]);
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as HistoryItem[]);
    } catch {
      setHistory([]);
    }
  }, []);

  const saveHistory = useCallback((report: AddressReport) => {
    setHistory((prev) => {
      const next = [
        {
          address: report.address,
          walletScore: report.walletScore,
          confidence: report.confidence,
          alertGrade: report.alertGrade,
          createdAtMs: report.createdAtMs,
        },
        ...prev.filter((x) => x.address.toLowerCase() !== report.address.toLowerCase()),
      ].slice(0, 12);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

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
      saveHistory(ok.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [saveHistory]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-24 pt-10 sm:px-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative grid h-9 w-9 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/40">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">WalletLens</div>
            <div className="text-[11px] text-muted-foreground">EVM wallet risk reports</div>
          </div>
        </div>
        <div className="hidden items-center gap-5 text-xs text-muted-foreground sm:flex">
          <a className="hover:text-foreground" href="#products">Products</a>
          <a className="hover:text-foreground" href="#report">Reports</a>
          <a className="hover:text-foreground" href="/methodology" target="_blank" rel="noreferrer">Methodology</a>
        </div>
      </header>

      <section className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
            Real-time wallet intelligence for Ethereum and Base
          </span>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Understand wallet risk before funds move.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Run a fast wallet check, map connected addresses, detect public risk signals, and export a structured
            report with a strict 0-100 score.
          </p>
          <div className="grid w-full max-w-3xl grid-cols-3 gap-3">
            <Metric label="Chains" value={CHAINS.map((c) => c.shortName).join(" + ")} />
            <Metric label="Graph depth" value="up to 3 hops" />
            <Metric label="Output" value="Report + JSON" />
          </div>
        </div>

        <div className="glass rounded-3xl p-5 shadow-2xl" id="report">
          <div className="mb-4">
            <div className="text-sm font-semibold">Wallet check</div>
            <p className="text-xs text-muted-foreground">Enter an EVM address to start analysis.</p>
          </div>
          <AddressInput onSubmit={(a) => analyze(a)} loading={loading} />

          {loading && <ProgressPanel elapsed={elapsed} />}
        </div>

        {history.length > 0 && (
          <div className="lg:col-span-2 glass rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">History</h2>
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  localStorage.removeItem(HISTORY_KEY);
                  setHistory([]);
                }}
              >
                clear
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {history.slice(0, 6).map((h) => (
                <button
                  key={`${h.address}-${h.createdAtMs}`}
                  className="rounded-xl border border-border/80 p-3 text-left hover:border-primary/50"
                  onClick={() => analyze(h.address)}
                  disabled={loading}
                >
                  <div className="mono truncate text-xs text-foreground/90">{h.address}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>score {h.walletScore}</span>
                    <span>confidence {h.confidence}</span>
                    <span>alert {h.alertGrade}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="lg:col-span-2 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Couldn&rsquo;t generate report</div>
              <div className="text-red-200/80">{error}</div>
            </div>
          </div>
        )}
      </section>

      {!data && !loading && !error && (
        <section id="products" className="mt-16 grid gap-4 md:grid-cols-3">
          <ProductCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Wallet checks"
            text="Strict scoring for EVM addresses with sanctions, mixer, scam, exploit and coverage signals."
          />
          <ProductCard
            icon={<Network className="h-5 w-5" />}
            title="Graph review"
            text="Configurable connected-wallet scan with deduplication and distance-based exposure weighting."
          />
          <ProductCard
            icon={<FileJson className="h-5 w-5" />}
            title="Reports"
            text="Compact report for people, full JSON for integrations, and history of previous checks."
          />
        </section>
      )}

      {data && !loading && (
        <section className="mt-12">
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

      {!data && !loading && !error && (
        <section className="mt-16 max-w-3xl">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
              How the score is built
            </h2>
            <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">1. Ingest.</span> For each chain we pull normal and
                ERC-20 transfers, counterparties and balances via explorers/RPC, then scan connected wallets up to the configured depth.
              </li>
              <li>
                <span className="font-medium text-foreground">2. Label.</span> Counterparties are checked against
                curated public lists: OFAC SDN, mixers (Tornado, Railgun), major CEX wallets, bridges and DeFi routers.
              </li>
              <li>
                <span className="font-medium text-foreground">3. Score.</span> Weighted risk factors add &ldquo;risk
                burden&rdquo; (0–100, higher = worse). The headline <strong>wallet score</strong> also includes age,
                coverage, attribution and graph uncertainty, so limited data will not produce a perfect score.
              </li>
              <li>
                <span className="font-medium text-foreground">4. Explain.</span> Every factor lists weight, source,
                and a clickable evidence link on the relevant explorer.
              </li>
            </ol>
          </div>
        </section>
      )}

      <footer className="mt-auto pt-24 text-center text-xs text-muted-foreground">
        WalletLens · public signals only ·{" "}
        <a className="hover:text-foreground" href="/methodology" target="_blank" rel="noreferrer">
          methodology
        </a>
      </footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function ProductCard({ icon, title, text }: { icon: JSX.Element; title: string; text: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 inline-flex rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">{icon}</div>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ProgressPanel({ elapsed }: { elapsed: number }) {
  const active = Math.min(PROGRESS_STEPS.length - 1, Math.floor(elapsed / 2500));
  const percent = Math.min(96, Math.round(((active + 1) / PROGRESS_STEPS.length) * 100));
  const reviewed = Math.min(PROGRESS_STEPS.length, active + 1);
  const remaining = Math.max(0, PROGRESS_STEPS.length - reviewed);
  return (
    <div className="mt-5 rounded-2xl border border-border bg-black/10 p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" />
          Analysis in progress
        </span>
        <span>{Math.floor(elapsed / 1000)}s</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-border/80 p-2">
          <div className="text-muted-foreground">Reviewed</div>
          <div className="font-semibold">{reviewed} stages</div>
        </div>
        <div className="rounded-lg border border-border/80 p-2">
          <div className="text-muted-foreground">Remaining</div>
          <div className="font-semibold">{remaining} stages</div>
        </div>
        <div className="rounded-lg border border-border/80 p-2">
          <div className="text-muted-foreground">Current</div>
          <div className="truncate font-semibold">{PROGRESS_STEPS[active]}</div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {PROGRESS_STEPS.map((step, i) => (
          <div key={step} className="flex items-center justify-between text-xs">
            <span className={i <= active ? "text-foreground" : "text-muted-foreground"}>{step}</span>
            <span className={i < active ? "text-emerald-300" : i === active ? "text-primary" : "text-muted-foreground"}>
              {i < active ? "done" : i === active ? "running" : "queued"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        The scanner limits graph fanout for speed and avoids re-checking duplicate wallets.
      </p>
    </div>
  );
}
