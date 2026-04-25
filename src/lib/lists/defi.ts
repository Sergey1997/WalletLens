import type { LabelEntry } from "../types";

export const DEFI_VERSION = "2024-05-snapshot";
export const DEFI_UPDATED_AT_MS = Date.parse("2024-05-01T00:00:00Z");

/**
 * Known DeFi protocol routers / contracts. Interaction with these is
 * a neutral-to-positive signal (audited, attributed).
 */
export const DEFI_KNOWN: LabelEntry[] = [
  { address: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d", category: "dex", name: "Uniswap V2 Router", source: "community" },
  { address: "0xe592427a0aece92de3edee1f18e0157c05861564", category: "dex", name: "Uniswap V3 Router", source: "community" },
  { address: "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", category: "dex", name: "Uniswap Universal Router", source: "community" },
  { address: "0x1111111254eeb25477b68fb85ed929f73a960582", category: "dex", name: "1inch V5 Router", source: "community" },
  { address: "0xdef1c0ded9bec7f1a1670819833240f027b25eff", category: "dex", name: "0x: ExchangeProxy", source: "community" },
  { address: "0xe66b31678d6c16e9ebf358268a790b763c133750", category: "dex", name: "CoW Protocol: Settlement", source: "community" },
  { address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9", category: "lending", name: "Aave V2: LendingPool", source: "community" },
  { address: "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2", category: "lending", name: "Aave V3: Pool", source: "community" },
  { address: "0xc36442b4a4522e871399cd717abdd847ab11fe88", category: "defi", name: "Uniswap V3: NonfungiblePositionManager", source: "community" },
];
