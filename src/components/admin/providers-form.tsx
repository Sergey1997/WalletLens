"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Provider {
  id: string;
  display_name: string;
  trust_level: number;
  url?: string;
  notes?: string;
  updated_at?: string;
}

interface Draft {
  id: string;
  display_name: string;
  trust_level: number;
  url: string;
  notes: string;
}

const EMPTY_DRAFT: Draft = { id: "", display_name: "", trust_level: 60, url: "", notes: "" };

export function AdminProviders() {
  const [list, setList] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/providers", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { providers: Provider[] };
      setList(json.providers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    setError(null);
    if (!draft.id.trim() || !draft.display_name.trim()) {
      setError("ID and display name are required");
      return;
    }
    const res = await fetch("/api/admin/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: draft.id.trim(),
        display_name: draft.display_name.trim(),
        trust_level: Math.max(0, Math.min(100, draft.trust_level)),
        url: draft.url.trim() || undefined,
        notes: draft.notes.trim() || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? `HTTP ${res.status}`);
      return;
    }
    setDraft(EMPTY_DRAFT);
    void refresh();
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await fetch("/api/admin/providers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      void refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Add or update provider</CardTitle>
          <p className="text-sm text-muted-foreground">
            Providers are the data sources we attribute risk evidence to (OFAC SDN, internal research, ...).
            Each address in the directory points back to one of these via <span className="mono">source_id</span>.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_120px]">
            <Field label="ID">
              <Input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} placeholder="ofac-sdn" />
            </Field>
            <Field label="Display name">
              <Input
                value={draft.display_name}
                onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
                placeholder="OFAC SDN"
              />
            </Field>
            <Field label="Trust level">
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.trust_level}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    trust_level: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  })
                }
              />
            </Field>
            <Field label="URL" className="sm:col-span-2">
              <Input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
            </Field>
            <Field label="Notes" className="sm:col-span-1">
              <Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
          </div>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          <div className="mt-3 flex justify-end">
            <Button onClick={() => void save()}>
              <Save className="h-4 w-4" />
              Save provider
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configured providers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> loading…
            </div>
          ) : list.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No providers yet. Add one above or run the seed migration.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">ID</th>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-right font-medium">Trust</th>
                    <th className="px-3 py-2 text-left font-medium">URL</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} className="table-row">
                      <td className="px-3 py-2 mono text-xs">{p.id}</td>
                      <td className="px-3 py-2">{p.display_name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.trust_level}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {p.url ? (
                          <a className="hover:text-foreground" href={p.url} target="_blank" rel="noreferrer">
                            {p.url.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === p.id}
                          onClick={() => void remove(p.id)}
                        >
                          {busyId === p.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <Plus className="h-3.5 w-3.5" /> Reload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`space-y-1 ${className ?? ""}`}>
      <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
