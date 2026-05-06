import Image from "next/image";
import Link from "next/link";
import { CHAINS } from "@/lib/chains";
import { listSnapshots } from "@/lib/lists";
import { METHODOLOGY_VERSION } from "@/lib/scoring/weights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, GitBranch, Layers, Shield, Sparkles } from "lucide-react";

export const metadata = { title: "WalletLens · Methodology" };

const LIVE = "https://wallet-lens.vercel.app/";

const PIPELINE_STEPS = [
  {
    n: "1",
    title: "Rate limit & normalize",
    body: "Each /api/report checks IP limits, then normalizes the address (EIP-55 / 0x+40 hex).",
  },
  {
    n: "2",
    title: "Report cache",
    body: "Lookup by a key that includes methodology version, lists hash, graph depth and fan-out. Cache hits return instantly and stay reproducible.",
  },
  {
    n: "3",
    title: "Risk Directory + seeds",
    body: "Active EVM rows from risk_entity_addresses are warmed into memory, merged with in-repo lists (OFAC snapshot, mixers, CEX, bridges, DeFi). Stricter label wins.",
  },
  {
    n: "4",
    title: "On-chain ingest",
    body: "Per chain: Etherscan V2 for transfers and activity, RPC for balances. Top counterparties are labeled from the resolver.",
  },
  {
    n: "5",
    title: "Bounded graph",
    body: "Optional BFS expands a few hops with strict depth/fan-out caps. Indirect hits use decayed weights so distance matters.",
  },
  {
    n: "6",
    title: "Score & persist",
    body: "Risk factors + trust signals → walletScore (0–100, higher is better), confidence, alert grade. The full JSON is saved; exposures and taint candidates update in the background for review—not automatic blocklisting.",
  },
];

export default function MethodologyPage() {
  const snapshots = listSnapshots();
  return (
    <main className="mx-auto max-w-4xl space-y-12 px-4 pb-20 pt-8 sm:px-6">
      <header className="space-y-4 text-center sm:text-left">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Methodology</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              How WalletLens turns an EVM wallet into an auditable risk report: directory, on-chain data, graph, and
              scoring—without equating &ldquo;exposure&rdquo; with guilt.
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            v{METHODOLOGY_VERSION}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <Link
            href={LIVE}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50"
          >
            Try live demo <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </Link>
          <span className="text-xs text-muted-foreground">Same engine as production checks.</span>
        </div>
      </header>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/30 pb-4">
          <div className="flex items-center gap-2 text-primary">
            <Layers className="h-5 w-5" />
            <CardTitle className="text-lg">Flow at a glance</CardTitle>
          </div>
          <p className="text-sm font-normal text-muted-foreground">
            From paste wallet → validate → internal directory → RPC & Etherscan → graph + score → report. The knowledge
            base grows from admin imports, future feeds, and every completed analysis.
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="relative mx-auto aspect-[16/10] w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-muted/20 shadow-[var(--shadow-pop)]">
            <Image
              src="/images/methodology-flow.png"
              alt="Wallet check pipeline: paste wallet, validate and cache, internal risk directory, on-chain ingest, graph expansion and scoring, final report; knowledge base fed by admin import, external feeds, and auto-capture from reports."
              fill
              className="object-contain object-center p-2 sm:p-4"
              sizes="(max-width: 896px) 100vw, 896px"
              priority
            />
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <GitBranch className="h-5 w-5 text-primary" />
          Check pipeline
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PIPELINE_STEPS.map((s) => (
            <div
              key={s.n}
              className="surface rounded-xl p-4 transition-shadow hover:shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-medium leading-snug">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Headline metrics</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Every report is JSON-serializable and version-pinned for audit.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">walletScore (0–100)</strong> — 100 is strongest; combines risk burden,
                capped trust boost, and uncertainty penalties.
              </li>
              <li>
                <strong className="text-foreground">riskScore / trustScore</strong> — raw sums behind the headline.
              </li>
              <li>
                <strong className="text-foreground">confidence (low / medium / high)</strong> — how much on-chain
                activity we saw, not a safety guarantee.
              </li>
              <li>
                <strong className="text-foreground">alertGrade</strong> — none · low · medium · high from risk burden
                bands.
              </li>
            </ul>
            <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Trust can add at most <strong className="text-foreground">15</strong> points to the headline (
              <code>TRUST_WALLET_BOOST_MAX</code>). Severe sanctions signal cannot be &ldquo;explained away&rdquo; by trust
              alone.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chains & labels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="mb-2 font-medium text-foreground">Chains covered</p>
              <ul className="space-y-1">
                {CHAINS.map((c) => (
                  <li key={c.id}>
                    <strong>{c.name}</strong> (chain {c.id}) · {c.explorerName}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 font-medium text-foreground">Directory vs scoring categories</p>
              <p>
                The database stores a rich taxonomy of tags. The engine maps them to a smaller set of{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">LabelCategory</code> values for
                consistent weights. Non-EVM addresses (e.g. BTC, TRX) can live in the catalog for imports; live wallet
                checks and resolver matching for scores are <strong className="text-foreground">EVM-only</strong> today.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Risk & trust (summary)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Direct hits</strong> — self-match on sanctions lists; direct counterparties
            flagged as mixer, exploit, scam, darknet market, ransom, gambling, unlicensed exchange, etc. Representative
            weights (full table in repo <code className="font-mono text-xs">weights.ts</code>): sanctions self 100,
            direct sanctioned 90, mixer 55, scam/phishing 60, exploit 65, darknet 80, ransom 75, lower tiers ~25.
          </p>
          <p>
            <strong className="text-foreground">Graph (indirect)</strong> — same categories, multiplied by hop decay
            (e.g. ~0.65 / ~0.35 / ~0.18 for distances 1–3) so farther exposure matters less.
          </p>
          <p>
            <strong className="text-foreground">Trust</strong> — wallet longevity (90d / 180d / 365d), interactions with
            attributed CEX / DeFi / bridge, diverse counterparties.
          </p>
          <p>
            <strong className="text-foreground">Uncertainty</strong> — low transaction count, very young wallet, burst
            activity patterns—we never pretend sparse data is a full picture.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">List & directory snapshots</CardTitle>
          </div>
          <p className="text-sm font-normal text-muted-foreground">
            In-memory meta for this build (plus DB-backed directory when Supabase is configured).
          </p>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {snapshots.map((s) => (
              <li
                key={s.source}
                className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
              >
                <span className="font-medium text-foreground">{s.source}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  version <code className="font-mono">{s.version}</code> · {s.size.toLocaleString()} entries
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <section className="surface-muted rounded-2xl border border-border/60 p-6 text-sm text-muted-foreground">
        <h2 className="mb-3 text-base font-semibold text-foreground">Limitations & disclaimer</h2>
        <p>
          WalletLens surfaces <strong className="text-foreground">public signals and your curated directory</strong>—not
          legal conclusions. For regulated workflows, combine this layer with policies, human review, and optionally a{" "}
          <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">RiskDataProvider</code> backed by a
          licensed oracle.
        </p>
        <p className="mt-3">
          Developer deep-dive (database schema, taint state machine, feed plans) lives in the repository file{" "}
          <code className="font-mono text-xs">ENGINE.md</code> alongside <code className="font-mono text-xs">METHODOLOGY.md</code>.
        </p>
      </section>
    </main>
  );
}
