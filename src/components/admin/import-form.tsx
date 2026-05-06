"use client";

import { useState } from "react";
import Link from "next/link";
import { FileUp, Loader2, Upload, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EVM_CURRENCY_TO_CHAIN } from "@/lib/admin/import";

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

interface ImportSummary {
  rows: number;
  entities_created: number;
  entities_reused: number;
  addresses_inserted: number;
}

interface ImportResponse {
  ok: true;
  summary: ImportSummary;
  parse_errors: { line: number; message: string }[];
  backend_errors: string[];
}

const CSV_TEMPLATE = `address,currency,tag,owner,description,mentions,evidence_url,source_id,confidence
TDVBcva13XgmQ6zFMC2qdsi8H8pkc42ad8,TRX,darknet_market,,,,,community,80
12hzmPLKQC1SCRC5j6Sts77P2aPs7ZDj4Q,BTC,darknet_market,Cropty,,,,community,80
bc1qfn5f4tvt83y03hl20cswrwqfjkxmwxq59jqpkj,BTC,scam,,Victim report #17379,1,,community,70
0x3b5401ccfafa1deee6bb4855539270c5b9fe6972,ETH,autodetected_alert,,,,,internal-research,55
0x8589427373d6d84e98730d7795d8f6f8731fda16,ETH,us_ofac_sanctions,Tornado Cash,,,https://home.treasury.gov/...,ofac-sdn,95
`;

const JSON_TEMPLATE = `[
  {
    "address": "0x8589427373d6d84e98730d7795d8f6f8731fda16",
    "currency": "ETH",
    "tag": "us_ofac_sanctions",
    "owner": "Tornado Cash",
    "source_id": "ofac-sdn",
    "evidence_url": "https://home.treasury.gov/...",
    "confidence": 95
  },
  {
    "address": "12hzmPLKQC1SCRC5j6Sts77P2aPs7ZDj4Q",
    "currency": "BTC",
    "tag": "darknet_market",
    "owner": "Cropty",
    "confidence": 80
  }
]`;

export function AdminImport() {
  const [text, setText] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [defaultEntity, setDefaultEntity] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("ETH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("File too large (>4 MB). Split it before importing.");
      return;
    }
    const txt = await file.text();
    setText(txt);
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          defaults: {
            entity_name: defaultEntity || undefined,
            category_id: defaultCategory || undefined,
            currency: defaultCurrency || undefined,
            chain_id: EVM_CURRENCY_TO_CHAIN[defaultCurrency],
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult(json as ImportResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Bulk import addresses</CardTitle>
        <p className="text-sm text-muted-foreground">
          Paste CSV/JSON or upload a file. Headers we understand:{" "}
          <span className="mono">address, currency, tag, owner, description, mentions, evidence_url, source_id, confidence</span>.
          Rows with no <span className="mono">owner</span> get bucketed under{" "}
          <span className="mono">Unattributed · &lt;tag&gt;</span>. Non-EVM currencies (BTC, TRX, BCH, …)
          are stored as-is and do not influence EVM scoring.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Default entity name (optional)">
            <Input value={defaultEntity} onChange={(e) => setDefaultEntity(e.target.value)} placeholder="—" />
          </Field>
          <Field label="Default category (optional)">
            <Input
              value={defaultCategory}
              onChange={(e) => setDefaultCategory(e.target.value)}
              placeholder="scam"
            />
          </Field>
          <Field label="Default currency">
            <select
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-primary/60">
            <FileUp className="h-3.5 w-3.5" />
            Upload file
            <input
              type="file"
              accept=".csv,.json,.txt"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => {
              setText(CSV_TEMPLATE);
            }}
          >
            CSV template
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => {
              setText(JSON_TEMPLATE);
            }}
          >
            JSON template
          </Button>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {text.split(/\r?\n/).filter(Boolean).length.toLocaleString()} non-empty lines
          </span>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          spellCheck={false}
          className="code-block mono w-full rounded-lg p-3 text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Paste CSV header + rows or JSON array..."
        />

        {error && <p className="text-sm text-red-700">{error}</p>}

        {result && (
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Rows parsed" value={result.summary.rows} />
              <Stat label="New entities" value={result.summary.entities_created} tone="text-emerald-700" />
              <Stat label="Reused entities" value={result.summary.entities_reused} tone="text-sky-700" />
              <Stat label="Addresses linked" value={result.summary.addresses_inserted} tone="text-primary" />
            </div>
            {result.summary.addresses_inserted > 0 && (
              <Link
                href="/directory"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open in Risk Directory <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            {(result.parse_errors.length > 0 || result.backend_errors.length > 0) && (
              <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <div className="font-semibold uppercase tracking-widest">Issues</div>
                <ul className="space-y-0.5">
                  {result.parse_errors.map((e, i) => (
                    <li key={`p-${i}`}>line {e.line}: {e.message}</li>
                  ))}
                  {result.backend_errors.map((e, i) => (
                    <li key={`b-${i}`}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={submit} disabled={busy || text.trim() === ""}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
