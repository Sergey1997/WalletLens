import type { LabelEntry } from "../types";

export const BRIDGES_VERSION = "2024-05-snapshot";
export const BRIDGES_UPDATED_AT_MS = Date.parse("2024-05-01T00:00:00Z");

export const BRIDGES: LabelEntry[] = [
  { address: "0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5", category: "bridge", name: "Across: Hub Pool", source: "community" },
  { address: "0x8731d54e9d02c286767d56ac03e8037c07e01e98", category: "bridge", name: "Stargate Router", source: "community" },
  { address: "0x2796317b0ff8538f253012862c06787adfb8ceb6", category: "bridge", name: "Synapse Bridge", source: "community" },
  { address: "0x1a0ad011913a150f69f6a19df447a0cfd9551054", category: "bridge", name: "Optimism: Gateway", source: "community" },
  { address: "0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a", category: "bridge", name: "Arbitrum: Bridge", source: "community" },
];
