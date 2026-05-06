import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  Building2,
  Coins,
  Compass,
  Crosshair,
  Dice5,
  Droplets,
  EyeOff,
  Flame,
  Gavel,
  Layers,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  ShoppingBag,
  Skull,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CategoryKey =
  | "sanctioned"
  | "us_ofac_sanctions"
  | "us_enforcement"
  | "mixer"
  | "exploit"
  | "hacking"
  | "conti_hacking"
  | "conti_leaks_hacking"
  | "dharma_hacking"
  | "stolen_coins"
  | "exmo_stolen_coins"
  | "liquid_stolen_coins"
  | "ronin_stolen_coins"
  | "phishing"
  | "scam"
  | "gainbitcoin_scam"
  | "plus_token_scam"
  | "abuse_reported"
  | "illicit_reported"
  | "user_reported"
  | "autodetected_alert"
  | "banned_by_contract"
  | "pending_review"
  | "darknet_market"
  | "dark_service"
  | "nested_illicit"
  | "hydra_nested"
  | "suex_nested"
  | "ransom"
  | "extortion_ransom"
  | "master_extortion_ransom"
  | "robbinhood_extortion_ransom"
  | "terrorism"
  | "terrorism_financing"
  | "hamas_terrorism"
  | "russian_terrorism"
  | "child_exploitation"
  | "child_sexual_abuse_material"
  | "illegal_service"
  | "seized_assets"
  | "political_organization"
  | "gambling"
  | "exchange_licensed"
  | "exchange_unlicensed"
  | "exchange_fraudulent"
  | "cex"
  | "p2p_exchange"
  | "atm"
  | "payment"
  | "marketplace"
  | "miner"
  | "bridge"
  | "defi"
  | "dex"
  | "lending"
  | "liquidity_pools"
  | "wallet";

const RED   = { tone: "text-red-700",     ring: "border-red-200 bg-red-50" } as const;
const AMBER = { tone: "text-amber-700",   ring: "border-amber-200 bg-amber-50" } as const;
const SKY   = { tone: "text-sky-700",     ring: "border-sky-200 bg-sky-50" } as const;
const EMER  = { tone: "text-emerald-700", ring: "border-emerald-200 bg-emerald-50" } as const;
const ORG   = { tone: "text-orange-700",  ring: "border-orange-200 bg-orange-50" } as const;
const MUTED = { tone: "text-muted-foreground", ring: "border-border bg-muted" } as const;

const META: Record<CategoryKey, { icon: LucideIcon; tone: string; ring: string; label: string }> = {
  sanctioned:                  { icon: Gavel,          ...RED,   label: "Sanctioned" },
  us_ofac_sanctions:           { icon: Gavel,          ...RED,   label: "US OFAC Sanctions" },
  us_enforcement:              { icon: Gavel,          ...RED,   label: "US Enforcement" },
  mixer:                       { icon: Droplets,       ...ORG,   label: "Mixer" },
  exploit:                     { icon: Flame,          ...ORG,   label: "Exploit" },
  hacking:                     { icon: Flame,          ...RED,   label: "Hacking" },
  conti_hacking:               { icon: Flame,          ...RED,   label: "Conti Hacking" },
  conti_leaks_hacking:         { icon: Flame,          ...RED,   label: "Conti Leaks Hacking" },
  dharma_hacking:              { icon: Flame,          ...RED,   label: "Dharma Hacking" },
  stolen_coins:                { icon: ShieldOff,      ...RED,   label: "Stolen Coins" },
  exmo_stolen_coins:           { icon: ShieldOff,      ...RED,   label: "EXMO Stolen Coins" },
  liquid_stolen_coins:         { icon: ShieldOff,      ...RED,   label: "Liquid Stolen Coins" },
  ronin_stolen_coins:          { icon: ShieldOff,      ...RED,   label: "Ronin Stolen Coins" },
  phishing:                    { icon: Crosshair,      ...AMBER, label: "Phishing" },
  scam:                        { icon: AlertTriangle,  ...AMBER, label: "Scam" },
  gainbitcoin_scam:            { icon: AlertTriangle,  ...AMBER, label: "GainBitcoin Scam" },
  plus_token_scam:             { icon: AlertTriangle,  ...AMBER, label: "Plus Token Scam" },
  abuse_reported:              { icon: AlertTriangle,  ...AMBER, label: "Abuse Reported" },
  illicit_reported:            { icon: AlertTriangle,  ...AMBER, label: "Illicit Reported" },
  user_reported:               { icon: AlertTriangle,  ...AMBER, label: "User Reported" },
  autodetected_alert:          { icon: AlertTriangle,  ...AMBER, label: "Autodetected Alert" },
  banned_by_contract:          { icon: ShieldOff,      ...AMBER, label: "Banned By Contract" },
  pending_review:              { icon: AlertTriangle,  ...MUTED, label: "Pending Review" },
  darknet_market:              { icon: ShoppingBag,    ...RED,   label: "Darknet Market" },
  dark_service:                { icon: EyeOff,         ...RED,   label: "Dark Service" },
  nested_illicit:              { icon: EyeOff,         ...RED,   label: "Nested (Illicit)" },
  hydra_nested:                { icon: EyeOff,         ...RED,   label: "Hydra Nested (Illicit)" },
  suex_nested:                 { icon: EyeOff,         ...RED,   label: "SUEX Nested (Illicit)" },
  ransom:                      { icon: ShieldAlert,    ...RED,   label: "Ransomware" },
  extortion_ransom:            { icon: ShieldAlert,    ...RED,   label: "Extortion / Ransom" },
  master_extortion_ransom:     { icon: ShieldAlert,    ...RED,   label: "Master Extortion / Ransom" },
  robbinhood_extortion_ransom: { icon: ShieldAlert,    ...RED,   label: "Robbinhood Extortion / Ransom" },
  terrorism:                   { icon: Skull,          ...RED,   label: "Terrorism" },
  terrorism_financing:         { icon: Skull,          ...RED,   label: "Terrorism Financing" },
  hamas_terrorism:             { icon: Skull,          ...RED,   label: "Hamas Terrorism" },
  russian_terrorism:           { icon: Skull,          ...RED,   label: "Russian Terrorism" },
  child_exploitation:          { icon: Skull,          ...RED,   label: "Child Exploitation" },
  child_sexual_abuse_material: { icon: Skull,          ...RED,   label: "Child Sexual Abuse Material" },
  illegal_service:             { icon: ShieldOff,      ...RED,   label: "Illegal Service" },
  seized_assets:               { icon: Gavel,          ...AMBER, label: "Seized Assets" },
  political_organization:      { icon: ShieldCheck,    ...SKY,   label: "Political Organization" },
  gambling:                    { icon: Dice5,          ...AMBER, label: "Gambling" },
  exchange_licensed:           { icon: Building2,      ...EMER,  label: "Exchange (Licensed)" },
  exchange_unlicensed:         { icon: Building2,      ...AMBER, label: "Exchange (Unlicensed)" },
  exchange_fraudulent:         { icon: Building2,      ...RED,   label: "Exchange (Fraudulent)" },
  cex:                         { icon: Building2,      ...EMER,  label: "CEX" },
  p2p_exchange:                { icon: ArrowLeftRight, ...AMBER, label: "P2P Exchange" },
  atm:                         { icon: Banknote,       ...AMBER, label: "ATM" },
  payment:                     { icon: Banknote,       ...SKY,   label: "Payment" },
  marketplace:                 { icon: ShoppingBag,    ...SKY,   label: "Marketplace" },
  miner:                       { icon: Coins,          ...SKY,   label: "Miner" },
  bridge:                      { icon: ArrowLeftRight, ...SKY,   label: "Bridge" },
  defi:                        { icon: Layers,         ...SKY,   label: "DeFi" },
  dex:                         { icon: ArrowLeftRight, ...SKY,   label: "DEX" },
  lending:                     { icon: Layers,         ...SKY,   label: "Lending" },
  liquidity_pools:             { icon: Droplets,       ...SKY,   label: "Liquidity Pool" },
  wallet:                      { icon: Wallet,         ...MUTED, label: "Wallet" },
};

const FALLBACK = META.wallet;

export function categoryMeta(key: string) {
  return META[key as CategoryKey] ?? FALLBACK;
}

export function CategoryIcon({
  category,
  size = "md",
  className,
}: {
  category: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const meta = categoryMeta(category);
  const Icon = meta.icon;
  const dim =
    size === "sm" ? "h-7 w-7" : size === "lg" ? "h-12 w-12" : "h-9 w-9";
  const inner = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border",
        meta.ring,
        meta.tone,
        dim,
        className,
      )}
      aria-label={meta.label}
      title={meta.label}
    >
      <Icon className={inner} />
    </span>
  );
}

export function categoryLabel(key: string) {
  return categoryMeta(key).label;
}

export { Compass };
