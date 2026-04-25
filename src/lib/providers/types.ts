import type { ChainId } from "../chains";
import type { ChainFacts } from "../types";

export interface RiskDataProvider {
  /** Fetch normalized facts for a single chain. Must not throw; return { available:false } on error. */
  fetchChainFacts(address: string, chainId: ChainId): Promise<ChainFacts>;
  /** Stable identifier, used in methodology-version hash. */
  id: string;
  version: string;
}
