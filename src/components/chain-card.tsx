import { ExternalLink } from "lucide-react";
import { CHAIN_BY_ID, explorerAddressUrl } from "@/lib/chains";
import type { ChainFacts } from "@/lib/types";
import { Badge } from "./ui/badge";
import { shortAddress } from "@/lib/utils";

function fmtAge(ms?: number) {
  if (!ms) return "—";
  const days = Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
  if (days < 1) return "today";
  if (days < 60) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

export function ChainCard({ chain, address }: { chain: ChainFacts; address: string }) {
  const cfg = CHAIN_BY_ID[chain.chainId];
  return (
    <div className="rounded-xl border border-border/60 p-4 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: `hsl(${cfg.accentHsl})` }}
          />
          <span className="text-sm font-semibold">{cfg.name}</span>
        </div>
        <a
          href={explorerAddressUrl(chain.chainId, address)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {cfg.explorerName} <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {!chain.available ? (
        <p className="mt-4 text-sm text-amber-300/90">
          Source unavailable{chain.error ? ` — ${chain.error}` : ""}. Shown as inconclusive.
        </p>
      ) : (
        <>
          {chain.error && (
            <p className="mt-3 text-xs text-amber-200/80 border border-amber-500/20 rounded-md px-2 py-1.5 bg-amber-500/5">
              {chain.error}
            </p>
          )}
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <Stat label="Txs" value={String(chain.txCount)} />
            <Stat label="Counterparties" value={String(chain.uniqueCounterparties)} />
            <Stat label="Age" value={fmtAge(chain.firstSeenMs)} />
          </div>
          {chain.hitLabels.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {chain.hitLabels.slice(0, 6).map((l) => (
                <Badge
                  key={l.address}
                  variant={
                    l.category === "sanctioned"
                      ? "severe"
                      : l.category === "mixer"
                        ? "danger"
                        : ["phishing", "scam", "exploit"].includes(l.category)
                          ? "warning"
                          : l.category === "cex"
                            ? "success"
                            : "info"
                  }
                >
                  {l.name || l.category}
                </Badge>
              ))}
            </div>
          )}
          {chain.topCounterparties.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Top counterparties</div>
              <ul className="space-y-1.5">
                {chain.topCounterparties.slice(0, 5).map((cp) => (
                  <li key={cp.address} className="flex items-center justify-between text-xs">
                    <a
                      href={explorerAddressUrl(chain.chainId, cp.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="mono text-foreground/80 hover:text-foreground"
                    >
                      {cp.label?.name ?? shortAddress(cp.address)}
                    </a>
                    <span className="text-muted-foreground">{cp.txCount} tx</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {chain.graph && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span>
                Graph · {chain.graph.maxDepth} hops · {chain.graph.walletsScanned} scanned ·{" "}
                {chain.graph.exposures.length} exposure
              </span>
              {chain.graph.exposures.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chain.graph.exposures.slice(0, 4).map((e) => (
                    <Badge
                      key={`${e.label.address}-${e.depth}-${e.via}`}
                      variant={e.label.category === "sanctioned" ? "severe" : "warning"}
                    >
                      {e.depth}h {e.label.name ?? e.label.category}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-semibold">{value}</div>
    </div>
  );
}
