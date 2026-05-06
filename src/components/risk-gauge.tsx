import { cn } from "@/lib/utils";
import { RISK_PENALTY_MULTIPLIER } from "@/lib/scoring/weights";

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
      color: "hsl(142 71% 38%)",
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  if (score >= 75)
    return {
      label: "Good",
      color: "hsl(160 64% 36%)",
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  if (score >= 55)
    return {
      label: "Fair",
      color: "hsl(38 92% 45%)",
      bg: "bg-amber-50 text-amber-700 border-amber-200",
    };
  if (score >= 35)
    return {
      label: "Weak",
      color: "hsl(25 95% 48%)",
      bg: "bg-orange-50 text-orange-700 border-orange-200",
    };
  return {
    label: "Critical",
    color: "hsl(0 78% 48%)",
    bg: "bg-red-50 text-red-700 border-red-200",
  };
}

export function RiskGauge({ walletScore, riskBurden, trustScore, confidence }: Props) {
  const s = Math.min(100, Math.max(0, walletScore));
  const band = bandForWalletScore(s);
  const effectivePenalty = Math.round(riskBurden * RISK_PENALTY_MULTIPLIER);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative h-36 w-36 shrink-0">
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
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">wallet</span>
        </div>
      </div>
      <div className="flex-1 space-y-3">
        <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm", band.bg)}>
          <span className="h-2 w-2 rounded-full" style={{ background: band.color }} />
          {band.label} · 100 = strongest
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Risk burden</div>
            <div className="text-xl font-semibold text-amber-700">
              {riskBurden}
              <span className="ml-1 text-xs text-amber-700/80">−{effectivePenalty} pts</span>
            </div>
            <div className="text-[10px] text-muted-foreground">×{RISK_PENALTY_MULTIPLIER} multiplier</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Trust</div>
            <div className="text-xl font-semibold text-emerald-700">{trustScore}</div>
            <div className="text-[10px] text-muted-foreground">positive boost</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Coverage</div>
            <div className="text-xl font-semibold capitalize">{confidence}</div>
            <div className="text-[10px] text-muted-foreground">data depth</div>
          </div>
        </div>
        <p className="max-w-md text-xs text-muted-foreground">
          Each Risk burden point removes {RISK_PENALTY_MULTIPLIER}× from the headline score. Limited history and
          unattributed counterparties also reduce the score, so a sparse wallet should not reach the top band.
        </p>
      </div>
    </div>
  );
}
