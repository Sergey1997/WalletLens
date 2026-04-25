import { ExternalLink } from "lucide-react";
import type { RiskFactor, RiskSeverity, TrustSignal } from "@/lib/types";
import { Badge } from "./ui/badge";
import { CHAIN_BY_ID } from "@/lib/chains";

const SEVERITY_MAP: Record<RiskSeverity, { variant: "info" | "success" | "warning" | "danger" | "severe"; label: string }> = {
  info: { variant: "info", label: "Info" },
  low: { variant: "success", label: "Low" },
  medium: { variant: "warning", label: "Medium" },
  high: { variant: "danger", label: "High" },
  severe: { variant: "severe", label: "Severe" },
};

export function FactorRow({ f }: { f: RiskFactor }) {
  const s = SEVERITY_MAP[f.severity];
  return (
    <div className="glass flex flex-col gap-2 rounded-xl p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={s.variant}>{s.label}</Badge>
          <span className="text-sm font-semibold">{f.title}</span>
          {f.chainId && (
            <Badge variant="outline" className="text-[10px]">
              {CHAIN_BY_ID[f.chainId].shortName}
            </Badge>
          )}
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            weight {f.weight}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{f.description}</p>
        {f.evidence && f.evidence.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {f.evidence.map((ev, i) => {
              const url = ev.url ?? (ev.address && f.chainId
                ? `${CHAIN_BY_ID[f.chainId].explorerUrl}/address/${ev.address}`
                : undefined);
              const label = ev.label ?? ev.address ?? ev.txHash ?? "evidence";
              return url ? (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="mono inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:border-primary/60"
                >
                  {label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span key={i} className="mono rounded-md border border-border px-2 py-1">
                  {label}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div className="text-right text-xs text-muted-foreground">{f.source}</div>
    </div>
  );
}

export function TrustRow({ t }: { t: TrustSignal }) {
  return (
    <div className="glass flex items-start justify-between gap-3 rounded-xl p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="success">+{t.weight}</Badge>
          <span className="text-sm font-semibold">{t.title}</span>
        </div>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>
    </div>
  );
}
