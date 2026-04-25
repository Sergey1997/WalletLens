export type ChainId = 1 | 8453;

export interface ChainConfig {
  id: ChainId;
  key: "ethereum" | "base";
  name: string;
  shortName: string;
  explorerUrl: string;
  explorerName: string;
  nativeSymbol: string;
  publicRpc: string;
  accentHsl: string;
}

export const CHAINS: ChainConfig[] = [
  {
    id: 1,
    key: "ethereum",
    name: "Ethereum",
    shortName: "ETH",
    explorerUrl: "https://etherscan.io",
    explorerName: "Etherscan",
    nativeSymbol: "ETH",
    publicRpc: "https://rpc.ankr.com/eth",
    accentHsl: "220 90% 66%",
  },
  {
    id: 8453,
    key: "base",
    name: "Base",
    shortName: "BASE",
    explorerUrl: "https://basescan.org",
    explorerName: "BaseScan",
    nativeSymbol: "ETH",
    publicRpc: "https://mainnet.base.org",
    accentHsl: "220 95% 60%",
  },
];

export const CHAIN_BY_ID: Record<ChainId, ChainConfig> = Object.fromEntries(
  CHAINS.map((c) => [c.id, c])
) as Record<ChainId, ChainConfig>;

export function explorerAddressUrl(chainId: ChainId, address: string): string {
  return `${CHAIN_BY_ID[chainId].explorerUrl}/address/${address}`;
}

export function explorerTxUrl(chainId: ChainId, hash: string): string {
  return `${CHAIN_BY_ID[chainId].explorerUrl}/tx/${hash}`;
}

export function rpcUrl(chain: ChainConfig): string {
  const envKey = `RPC_URL_${chain.key.toUpperCase()}`;
  if (chain.key === "base") {
    return process.env.RPC_URL_BASE || process.env.NEXT_PUBLIC_BASE_RPC_URL || chain.publicRpc;
  }
  return process.env[envKey] || chain.publicRpc;
}
