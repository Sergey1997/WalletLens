"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CHAINS } from "@/lib/chains";
import type { RiskScoreProfile } from "@/app/api/profiles/route";

interface UserSettings {
  active_profile_id: string | null;
  notify_email: boolean;
  notify_grade_change: boolean;
  default_chains: number[];
  ui_density: "comfortable" | "compact";
}

const DEFAULTS: UserSettings = {
  active_profile_id: null,
  notify_email: true,
  notify_grade_change: true,
  default_chains: [1, 8453],
  ui_density: "comfortable",
};

export function SettingsView({ email }: { email: string }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);
  const [profiles, setProfiles] = useState<RiskScoreProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch("/api/user/settings", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/profiles", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (a.settings) setSettings({ ...DEFAULTS, ...a.settings });
      if (Array.isArray(b.profiles)) setProfiles(b.profiles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const toggleChain = (id: number) => {
    setSettings((s) => {
      const has = s.default_chains.includes(id);
      return {
        ...s,
        default_chains: has
          ? s.default_chains.filter((c) => c !== id)
          : [...s.default_chains, id].sort((a, b) => a - b),
      };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personal preferences for <span className="text-foreground/90">{email}</span>. Shared system data
          (suspicious entities, sources) lives in Admin and is not affected by your profile.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Active risk score profile</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Determines how the engine weighs different signals when scoring wallets you check or rescan.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> loading…
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No profiles available.</p>
          ) : (
            <div className="space-y-2">
              {profiles.map((p) => {
                const active = settings.active_profile_id === p.id || (settings.active_profile_id === null && p.is_default);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, active_profile_id: p.id }))}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "border-primary/60 bg-primary/10"
                        : "border-border/60 bg-muted/20 hover:border-primary/40"
                    }`}
                  >
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        v{p.version} · {Object.keys(p.config?.categories ?? {}).length} categories
                      </div>
                    </div>
                    {active && <Badge variant="info">active</Badge>}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Default chains</p>
            <div className="flex flex-wrap gap-2">
              {CHAINS.map((c) => {
                const on = settings.default_chains.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleChain(c.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      on
                        ? "border-primary/60 bg-primary/15 text-foreground"
                        : "border-border/60 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle
              label="Email notifications"
              description="Send digest emails for grade changes on watchlisted wallets."
              checked={settings.notify_email}
              onChange={(v) => setSettings((s) => ({ ...s, notify_email: v }))}
            />
            <Toggle
              label="Notify on grade change"
              description="Trigger immediately when grade switches between low/medium/high."
              checked={settings.notify_grade_change}
              onChange={(v) => setSettings((s) => ({ ...s, notify_grade_change: v }))}
            />
          </div>

          <div>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">UI density</p>
            <div className="flex gap-2">
              {(["comfortable", "compact"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, ui_density: d }))}
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    settings.ui_density === d
                      ? "border-primary/60 bg-primary/15"
                      : "border-border/60 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        {savedAt && (
          <span className="text-xs text-muted-foreground">
            saved {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
        <Button onClick={() => void save()} disabled={saving || loading}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span
          className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
            checked ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform ${
              checked ? "left-4" : "left-0.5"
            }`}
          />
        </span>
      </div>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}
