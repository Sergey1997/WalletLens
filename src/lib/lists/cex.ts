import type { LabelEntry } from "../types";

export const CEX_VERSION = "2024-05-snapshot";
export const CEX_UPDATED_AT_MS = Date.parse("2024-05-01T00:00:00Z");

/**
 * Major CEX hot / deposit addresses (public attribution, Etherscan tags).
 * Presence in counterparties is a POSITIVE public-attribution signal.
 */
export const CEX_ADDRESSES: LabelEntry[] = [
  { address: "0x28c6c06298d514db089934071355e5743bf21d60", category: "cex", name: "Binance 14", source: "etherscan-public" },
  { address: "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be", category: "cex", name: "Binance", source: "etherscan-public" },
  { address: "0xdfd5293d8e347dfe59e90efd55b2956a1343963d", category: "cex", name: "Binance 16", source: "etherscan-public" },
  { address: "0x21a31ee1afc51d94c2efccaa2092ad1028285549", category: "cex", name: "Binance 15", source: "etherscan-public" },
  { address: "0x56eddb7aa87536c09ccc2793473599fd21a8b17f", category: "cex", name: "Binance 17", source: "etherscan-public" },
  { address: "0x71660c4005ba85c37ccec55d0c4493e66fe775d3", category: "cex", name: "Coinbase 1", source: "etherscan-public" },
  { address: "0xa090e606e30bd747d4e6245a1517ebe430f0057e", category: "cex", name: "Coinbase 4", source: "etherscan-public" },
  { address: "0x503828976d22510aad0201ac7ec88293211d23da", category: "cex", name: "Coinbase 2", source: "etherscan-public" },
  { address: "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740", category: "cex", name: "Coinbase 3", source: "etherscan-public" },
  { address: "0xe853c56864a2ebe4576a807d26fdc4a0ada51919", category: "cex", name: "Kraken 4", source: "etherscan-public" },
  { address: "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0", category: "cex", name: "Kraken 5", source: "etherscan-public" },
  { address: "0x5041ed759dd4afc3a72b8192c143f72f4724081a", category: "cex", name: "OKX", source: "etherscan-public" },
  { address: "0xf89d7b9c864f589bbf53a82105107622b35eaa40", category: "cex", name: "Bybit Hot", source: "etherscan-public" },
  { address: "0xa7efae728d2936e78bda97dc267687568dd593f3", category: "cex", name: "OKX 2", source: "etherscan-public" },
  { address: "0xcffad3200574698b78f32232aa9d63eabd290703", category: "cex", name: "Crypto.com", source: "etherscan-public" },
];
