import type { LabelEntry } from "../types";

export const MIXERS_VERSION = "2024-05-snapshot";
export const MIXERS_UPDATED_AT_MS = Date.parse("2024-05-01T00:00:00Z");

/**
 * Known mixing / privacy-pool contracts (not necessarily illegal to use,
 * but treated as an elevated-risk counterparty signal.
 */
export const MIXERS: LabelEntry[] = [
  {
    address: "0x722122df12d4e14e13ac3b6895a86e84145b6967",
    category: "mixer",
    name: "Tornado Cash (Ethereum)",
    source: "community",
  },
  {
    address: "0xfba3912ca04dd458c843e2ee08967fc04f3579c2",
    category: "mixer",
    name: "Railgun Proxy (Ethereum)",
    source: "community",
  },
  {
    address: "0x3a23f943181408eac424116af7b7790c94cb97a5",
    category: "mixer",
    name: "Railgun (Ethereum)",
    source: "community",
  },
];
