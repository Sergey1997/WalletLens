import { isEvmAddress, normalizeAddress } from "../address";

/**
 * Mapping from a `currency` token (as it appears in Crystal-style imports)
 * to the EVM `chain_id` we know about. Anything not listed here is treated
 * as a non-EVM entry — we keep `chain_id = null` and store the address
 * verbatim, since BTC, TRX, etc. have their own address formats and case
 * sensitivity rules.
 */
export const EVM_CURRENCY_TO_CHAIN: Record<string, number> = {
  ETH: 1,
  ETHEREUM: 1,
  BASE: 8453,
  MATIC: 137,
  POLYGON: 137,
  BSC: 56,
  BNB: 56,
  ARB: 42161,
  ARBITRUM: 42161,
  OP: 10,
  OPTIMISM: 10,
  ETC: 61,
};

export interface ImportRow {
  entity_name: string;
  category_id: string;
  address: string;
  /** Free-form currency code, e.g. ETH / BTC / TRX. Always uppercased. */
  currency: string;
  /** Numeric chain id when `currency` resolves to a known EVM network. */
  chain_id?: number;
  confidence?: number;
  source_id?: string;
  evidence_url?: string;
  description?: string;
  website?: string;
  tags?: string[];
  owner?: string;
  mentions?: number;
}

export interface ImportError {
  line: number;
  message: string;
}

export interface ImportResult {
  rows: ImportRow[];
  errors: ImportError[];
}

type RawField =
  | "entity_name"
  | "category_id"
  | "address"
  | "currency"
  | "chain_id"
  | "confidence"
  | "source_id"
  | "evidence_url"
  | "description"
  | "website"
  | "tags"
  | "owner"
  | "mentions";

const HEADER_ALIASES: Record<string, RawField> = {
  entity: "entity_name",
  entity_name: "entity_name",
  name: "entity_name",
  category: "category_id",
  category_id: "category_id",
  type: "category_id",
  tag: "category_id",
  address: "address",
  wallet: "address",
  currency: "currency",
  asset: "currency",
  symbol: "currency",
  chain: "chain_id",
  chain_id: "chain_id",
  confidence: "confidence",
  source: "source_id",
  source_id: "source_id",
  evidence: "evidence_url",
  evidence_url: "evidence_url",
  description: "description",
  notes: "description",
  website: "website",
  url: "website",
  tags: "tags",
  owner: "owner",
  attribution: "owner",
  mentions: "mentions",
};

const UNATTRIBUTED_VALUES = new Set(["", "-", "—", "–", "n/a", "na", "none", "null", "not defined"]);

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((s) => s.trim());
}

function asInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function asOptionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : undefined;
}

function asTags(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/[|;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isUnattributed(name: string): boolean {
  return UNATTRIBUTED_VALUES.has(name.trim().toLowerCase());
}

function canonicaliseCurrency(raw: unknown, chainId?: number): string {
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
    return String(raw).trim().toUpperCase();
  }
  if (chainId !== undefined) {
    const inverse = Object.entries(EVM_CURRENCY_TO_CHAIN).find(([, id]) => id === chainId);
    if (inverse) return inverse[0];
  }
  return "ETH";
}

function buildRow(
  raw: Record<string, unknown>,
  defaults: { entity_name?: string; category_id?: string; chain_id?: number; currency?: string },
): { row?: ImportRow; error?: string } {
  const category_id = String(raw.category_id ?? defaults.category_id ?? "").trim();
  const address = String(raw.address ?? "").trim();
  if (!category_id) return { error: "missing category" };
  if (!address) return { error: "missing address" };

  let entity_name = String(raw.entity_name ?? defaults.entity_name ?? "").trim();
  const owner = raw.owner !== undefined ? String(raw.owner).trim() : "";
  if (!entity_name && owner && !isUnattributed(owner)) entity_name = owner;
  if (!entity_name || isUnattributed(entity_name)) {
    entity_name = `Unattributed · ${category_id}`;
  }

  const explicitChainId = asOptionalInt(raw.chain_id);
  const currency = canonicaliseCurrency(raw.currency ?? defaults.currency, explicitChainId);
  const evmChainId = explicitChainId ?? EVM_CURRENCY_TO_CHAIN[currency];
  const isEvm = evmChainId !== undefined;

  let storedAddress = address;
  if (isEvm) {
    if (!isEvmAddress(address)) {
      return { error: `not a valid EVM address for ${currency}: ${address}` };
    }
    storedAddress = normalizeAddress(address);
  }

  const row: ImportRow = {
    entity_name,
    category_id,
    address: storedAddress,
    currency,
    chain_id: isEvm ? evmChainId : undefined,
    confidence: raw.confidence !== undefined ? asInt(raw.confidence, 70) : undefined,
    source_id: raw.source_id ? String(raw.source_id).trim() : undefined,
    evidence_url: raw.evidence_url ? String(raw.evidence_url).trim() : undefined,
    description: raw.description ? String(raw.description).trim() : undefined,
    website: raw.website ? String(raw.website).trim() : undefined,
    tags: asTags(raw.tags),
    owner: owner && !isUnattributed(owner) ? owner : undefined,
    mentions: raw.mentions !== undefined ? asOptionalInt(raw.mentions) : undefined,
  };
  return { row };
}

export function parseImport(
  text: string,
  defaults: { entity_name?: string; category_id?: string; chain_id?: number; currency?: string } = {},
): ImportResult {
  const trimmed = text.trim();
  if (!trimmed) return { rows: [], errors: [{ line: 0, message: "empty input" }] };
  const isJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];

  if (isJson) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const list = Array.isArray(parsed) ? parsed : [parsed];
      list.forEach((item, idx) => {
        if (!item || typeof item !== "object") {
          errors.push({ line: idx + 1, message: "not an object" });
          return;
        }
        const result = buildRow(item as Record<string, unknown>, defaults);
        if (result.row) rows.push(result.row);
        else errors.push({ line: idx + 1, message: result.error ?? "invalid row" });
      });
    } catch (e) {
      errors.push({ line: 0, message: e instanceof Error ? e.message : "invalid JSON" });
    }
    return { rows, errors };
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines.length === 0) return { rows, errors };
  const header = splitCsvLine(lines[0]).map((c) => c.toLowerCase());
  const fields = header.map((h) => HEADER_ALIASES[h] ?? null);
  if (!fields.includes("address")) {
    errors.push({ line: 1, message: "header must include `address`" });
    return { rows, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    const obj: Record<string, unknown> = {};
    fields.forEach((f, idx) => {
      if (!f) return;
      obj[f] = cells[idx];
    });
    const result = buildRow(obj, defaults);
    if (result.row) rows.push(result.row);
    else errors.push({ line: i + 1, message: result.error ?? "invalid row" });
  }
  return { rows, errors };
}
