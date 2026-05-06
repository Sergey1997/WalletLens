"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Bookmark,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WatchlistEntry } from "@/app/api/watchlist/route";
import type { AddressReport } from "@/lib/types";
import { isEvmAddress } from "@/lib/address";
import { shortAddress } from "@/lib/utils";

interface WatchlistResponse {
  items: WatchlistEntry[];
  source: "db" | "memory";
}

function gradeBadge(grade?: string) {
  switch (grade) {
    case "high":
      return <Badge variant="severe">high</Badge>;
    case "medium":
      return <Badge variant="warning">medium</Badge>;
    case "low":
      return <Badge variant="success">low</Badge>;
    case "none":
      return <Badge variant="success">clean</Badge>;
    default:
      return <Badge variant="outline">unscanned</Badge>;
  }
}

export function WatchlistView() {
  const [items, setItems] = useState<WatchlistEntry[]>([]);
  const [source, setSource] = useState<"db" | "memory" | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as WatchlistResponse;
      setItems(json.items ?? []);
      setSource(json.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isEvmAddress(address.trim())) {
        setError("Not a valid EVM address");
        return;
      }
      setError(null);
      const body = JSON.stringify({ address: address.trim(), label: label.trim() || undefined });
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setAddress("");
      setLabel("");
      void refresh();
    },
    [address, label, refresh],
  );

  const remove = useCallback(
    async (id: string, addr: string) => {
      setBusyId(id);
      try {
        await fetch("/api/watchlist", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, address: addr }),
        });
        void refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const rescan = useCallback(
    async (id: string, addr: string) => {
      setBusyId(id);
      try {
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: addr, force: true }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { report: AddressReport };
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  last_score: json.report.walletScore,
                  last_grade: json.report.alertGrade,
                  last_checked_at: new Date(json.report.createdAtMs).toISOString(),
                }
              : it,
          ),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error");
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Watchlist <span className="text-muted-foreground">({items.length})</span>
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Pin wallets you want to keep an eye on. Rescan re-runs a fresh report and updates the score
          here. Persistent storage uses Supabase when configured, otherwise an in-memory list for the
          current process.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add wallet</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x… EVM address"
              spellCheck={false}
              className="mono h-11 sm:flex-1"
            />
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional)"
              className="h-11 sm:w-56"
            />
            <Button type="submit" size="lg" className="h-11 sm:w-auto">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          {source && (
            <p className="mt-2 text-xs text-muted-foreground">
              storage: <span className="text-foreground/80">{source}</span>
              {source === "memory" && " · configure Supabase to persist watchlist between restarts."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Tracked wallets</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCcw className="h-3.5 w-3.5" />
            Reload
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {loading && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> loading…
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Bookmark className="h-7 w-7 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">
                Empty. Add a wallet above or open any report and use “Add to watchlist”.
              </p>
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Address</th>
                    <th className="px-3 py-2 text-left font-medium">Label</th>
                    <th className="px-3 py-2 text-right font-medium">Score</th>
                    <th className="px-3 py-2 text-left font-medium">Grade</th>
                    <th className="px-3 py-2 text-left font-medium">Last check</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="table-row">
                      <td className="px-3 py-2">
                        <Link
                          href={`/?address=${item.address}`}
                          className="mono text-xs hover:underline"
                          title={item.address}
                        >
                          {shortAddress(item.address, 8, 6)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-sm">{item.label ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {item.last_score ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2">{gradeBadge(item.last_grade)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {item.last_checked_at
                          ? new Date(item.last_checked_at).toLocaleString()
                          : "never"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === item.id}
                            onClick={() => void rescan(item.id, item.address)}
                          >
                            {busyId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCcw className="h-3.5 w-3.5" />
                            )}
                            Rescan
                          </Button>
                          <Link
                            href={`/?address=${item.address}`}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === item.id}
                            onClick={() => void remove(item.id, item.address)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
