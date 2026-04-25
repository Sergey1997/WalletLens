import { cn } from "@/lib/utils";

interface Props {
  /** 0–100, **100 = best** (primary headline metric). */
  walletScore: number;
  riskBurden: number;
  trustScore: number;
  confidence: "low" | "medium" | "high";
}

/** band by wallet score: high = good = green */
function bandForWalletScore(score: number) {
  if (score >= 90)
    return {
      label: "Verified",
      color: "hsl(142 71% 52%)",
      bg: "bg-emerald-500/10 text-emerald-200 border-emerald-500/40",
    };
  if (score >= 75)
    return {
      label: "Good",
      color: "hsl(160 64% 48%)",
      bg: "bg-emerald-500/10 text-emerald-200/90 border-emerald-500/30",
    };
  if (score >= 55)
    return {
      label: "Fair",
      color: "hsl(45 95% 55%)",
      bg: "bg-amber-500/10 text-amber-200 border-amber-500/35",
    };
  if (score >= 35)
    return {
      label: "Weak",
      color: "hsl(25 95% 55%)",
      bg: "bg-orange-500/10 text-orange-200 border-orange-500/40",
    };
  return {
    label: "Critical",
    color: "hsl(0 84% 58%)",
    bg: "bg-red-500/10 text-red-200 border-red-500/40",
  };
}

export function RiskGauge({ walletScore, riskBurden, trustScore, confidence }: Props) {
  const s = Math.min(100, Math.max(0, walletScore));
  const band = bandForWalletScore(s);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-[135deg]">
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="10"
            strokeDasharray="226 400"
            strokeLinecap="round"
          />
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke={band.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(s / 100) * 226} 400`}
            style={{ transition: "stroke-dasharray 0.8s ease-out, stroke 0.4s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold tracking-tight" style={{ color: band.color }}>
            {s}
          </span>
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">wallet</span>
        </div>
      </div>
      <div className="flex-1 space-y-3">
        <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm", band.bg)}>
          <span className="h-2 w-2 rounded-full" style={{ background: band.color }} />
          {band.label} · 100 = strongest
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-widest">Risk burden</div>
            <div className="text-2xl font-semibold text-amber-200/90">{riskBurden}</div>
            <div className="text-[10px] text-muted-foreground">higher = worse</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-widest">Trust</div>
            <div className="text-2xl font-semibold text-emerald-300">{trustScore}</div>
            <div className="text-[10px] text-muted-foreground">raw sum</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-widest">Coverage</div>
            <div className="text-2xl font-semibold capitalize">{confidence}</div>
            <div className="text-[10px] text-muted-foreground">data depth</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground max-w-md">
          <strong className="text-foreground/90">Wallet score</strong> includes negative signals and uncertainty. A new
          wallet with little history should not receive a perfect score even when no direct sanctions hit is found.
        </p>
      </div>
    </div>
  );
}
