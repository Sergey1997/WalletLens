import type { ChainId } from "../chains";
import type { ChainFacts } from "../types";
import { EtherscanV2Provider } from "./etherscan-v2";
import type { RiskDataProvider } from "./types";

/**
 * Composes available public data sources for a chain.
 * Today: Etherscan V2 only. Tomorrow: fall back to RPC + aggregator.
 */
export class PublicCompositeProvider implements RiskDataProvider {
  id = "public-composite";
  version = "1.0.0";
  private inner = new EtherscanV2Provider();

  async fetchChainFacts(address: string, chainId: ChainId): Promise<ChainFacts> {
    return this.inner.fetchChainFacts(address, chainId);
  }
}

export const defaultProvider = new PublicCompositeProvider();
