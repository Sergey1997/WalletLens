"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isEvmAddress } from "@/lib/address";
import { EVM_CURRENCY_TO_CHAIN } from "@/lib/admin/import";

const CATEGORY_GROUPS: { label: string; ids: string[] }[] = [
  {
    label: "Sanctions / Enforcement",
    ids: ["sanctioned", "us_ofac_sanctions", "us_enforcement", "seized_assets"],
  },
  {
    label: "Terrorism",
    ids: ["terrorism", "hamas_terrorism", "russian_terrorism", "terrorism_financing"],
  },
  {
    label: "Child exploitation",
    ids: ["child_exploitation", "child_sexual_abuse_material"],
  },
  {
    label: "Extortion / Ransom",
    ids: ["extortion_ransom", "master_extortion_ransom", "robbinhood_extortion_ransom", "ransom"],
  },
  {
    label: "Hacking",
    ids: ["hacking", "conti_hacking", "conti_leaks_hacking", "dharma_hacking", "exploit"],
  },
  {
    label: "Stolen coins",
    ids: ["stolen_coins", "exmo_stolen_coins", "liquid_stolen_coins", "ronin_stolen_coins"],
  },
  {
    label: "Darknet / Nested illicit",
    ids: ["darknet_market", "dark_service", "nested_illicit", "hydra_nested", "suex_nested", "illegal_service"],
  },
  {
    label: "Mixers / Privacy",
    ids: ["mixer"],
  },
  {
    label: "Scams",
    ids: [
      "scam",
      "phishing",
      "gainbitcoin_scam",
      "plus_token_scam",
      "exchange_fraudulent",
      "abuse_reported",
      "illicit_reported",
      "user_reported",
      "autodetected_alert",
      "banned_by_contract",
      "pending_review",
    ],
  },
  {
    label: "Exchanges",
    ids: ["cex", "exchange_licensed", "exchange_unlicensed", "p2p_exchange", "atm"],
  },
  {
    label: "Infrastructure",
    ids: ["payment", "marketplace", "miner", "bridge", "defi", "dex", "lending", "liquidity_pools"],
  },
  {
    label: "Other",
    ids: ["gambling", "political_organization", "wallet"],
  },
];

const CURRENCIES = [
  ...Object.keys(EVM_CURRENCY_TO_CHAIN),
  "BTC",
  "BCH",
  "LTC",
  "TRX",
  "XRP",
  "XLM",
  "SOL",
  "ADA",
  "DOGE",
  "XDC",
  "ATOM",
];

interface AddressDraft {
  currency: string;
  address: string;
  confidence: number;
  source_id?: string;
  evidence_url?: string;
  owner?: string;
  mentions?: number;
  description?: string;
}

const EMPTY_ROW = (): AddressDraft => ({ currency: "ETH", address: "", confidence: 70 });

export function AdminEntityCreate() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("scam");
  const [riskLevel, setRiskLevel] = useState(60);
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [addresses, setAddresses] = useState<AddressDraft[]>([EMPTY_ROW()]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateAddress = (idx: number, patch: Partial<AddressDraft>) => {
    setAddresses((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const addRow = () => setAddresses((prev) => [...prev, EMPTY_ROW()]);
  const removeRow = (idx: number) => setAddresses((prev) => prev.filter((_, i) => i !== idx));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const cleaned = addresses.filter((a) => a.address.trim() !== "");
    const invalidEvm = cleaned.find(
      (a) => EVM_CURRENCY_TO_CHAIN[a.currency] !== undefined && !isEvmAddress(a.address.trim()),
    );
    if (invalidEvm) {
      setError(`Invalid ${invalidEvm.currency} address: ${invalidEvm.address}`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category_id: category,
          risk_level: riskLevel,
          status: "active",
          description: description.trim() || undefined,
          website: website.trim() || undefined,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          addresses: cleaned.map((a) => ({
            currency: a.currency,
            chain_id: EVM_CURRENCY_TO_CHAIN[a.currency],
            address: a.address.trim(),
            confidence: a.confidence,
            source_id: a.source_id?.trim() || undefined,
            evidence_url: a.evidence_url?.trim() || undefined,
            owner: a.owner?.trim() || undefined,
            mentions: a.mentions,
            description: a.description?.trim() || undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setFeedback(`Created entity (${json.addresses ?? 0} addresses linked).`);
      setName("");
      setDescription("");
      setWebsite("");
      setTags("");
      setAddresses([EMPTY_ROW()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add suspicious entity</CardTitle>
        <p className="text-sm text-muted-foreground">
          Creates a new row in <span className="mono">risk_entities</span> and attaches addresses across any
          supported network. Use the Crystal-style tags to mark tactics (e.g. <span className="mono">conti_hacking</span>),
          and put a known operator in <span className="mono">owner</span> when one exists.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tornado Cash" required />
            </Field>
            <Field label="Tag (category)" required>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORY_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.ids.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Risk level (0-100)">
              <Input
                type="number"
                min={0}
                max={100}
                value={riskLevel}
                onChange={(e) => setRiskLevel(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              />
            </Field>
            <Field label="Tags (comma separated)">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="dprk, bridge" />
            </Field>
            <Field label="Website" className="sm:col-span-2">
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Public attribution, links to research, MITRE-style notes..."
              />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Addresses</h3>
              <Badge variant="outline" className="text-[10px]">
                {addresses.filter((a) => a.address).length} total
              </Badge>
            </div>
            <div className="space-y-2">
              {addresses.map((a, idx) => (
                <div
                  key={idx}
                  className="space-y-2 rounded-xl border border-border bg-muted/40 p-3"
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[110px_minmax(0,1fr)_90px_auto]">
                    <select
                      value={a.currency}
                      onChange={(e) => updateAddress(idx, { currency: e.target.value })}
                      className="flex h-10 rounded-md border border-border bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={a.address}
                      onChange={(e) => updateAddress(idx, { address: e.target.value })}
                      placeholder={EVM_CURRENCY_TO_CHAIN[a.currency] !== undefined ? "0x…" : "address (case sensitive)"}
                      className="mono h-10 text-xs"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={a.confidence}
                      onChange={(e) =>
                        updateAddress(idx, {
                          confidence: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                        })
                      }
                      className="h-10 text-xs"
                      title="Confidence (0-100)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(idx)}
                      disabled={addresses.length === 1}
                      aria-label="Remove address"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px]">
                    <Input
                      value={a.owner ?? ""}
                      onChange={(e) => updateAddress(idx, { owner: e.target.value })}
                      placeholder="Owner / attribution (e.g. Cropty)"
                      className="h-9 text-xs"
                    />
                    <Input
                      value={a.evidence_url ?? ""}
                      onChange={(e) => updateAddress(idx, { evidence_url: e.target.value })}
                      placeholder="Evidence URL"
                      className="h-9 text-xs"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={a.mentions ?? 0}
                      onChange={(e) =>
                        updateAddress(idx, { mentions: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="h-9 text-xs"
                      title="Mentions"
                    />
                  </div>
                  <Input
                    value={a.description ?? ""}
                    onChange={(e) => updateAddress(idx, { description: e.target.value })}
                    placeholder="Per-row description (e.g. Victim report #17379)"
                    className="h-9 text-xs"
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-3.5 w-3.5" /> Add address row
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}
          {feedback && (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              {feedback}
              <Link
                href="/directory"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                Open in Directory <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create entity
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`space-y-1 ${className ?? ""}`}>
      <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-red-700">*</span>}
      </span>
      {children}
    </label>
  );
}
