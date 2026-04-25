import type { LabelEntry } from "../types";

/**
 * Seeded snapshot of OFAC-SDN EVM addresses (Tornado Cash mixers,
 * Lazarus / DPRK-linked wallets). Source: US Treasury OFAC SDN list.
 * Published publicly; included here as verifiable public data points,
 * not as a legal conclusion. Replace/extend via ingestion pipeline.
 */
export const OFAC_VERSION = "2024-05-snapshot";
export const OFAC_UPDATED_AT_MS = Date.parse("2024-05-01T00:00:00Z");

export const OFAC_SDN: LabelEntry[] = [
  {
    address: "0x8589427373d6d84e98730d7795d8f6f8731fda16",
    category: "sanctioned",
    name: "Tornado Cash: Router",
    source: "OFAC SDN",
    sourceUrl: "https://home.treasury.gov/policy-issues/financial-sanctions/recent-actions/20220808",
  },
  {
    address: "0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc",
    category: "sanctioned",
    name: "Tornado Cash: 0.1 ETH",
    source: "OFAC SDN",
  },
  {
    address: "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936",
    category: "sanctioned",
    name: "Tornado Cash: 1 ETH",
    source: "OFAC SDN",
  },
  {
    address: "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf",
    category: "sanctioned",
    name: "Tornado Cash: 10 ETH",
    source: "OFAC SDN",
  },
  {
    address: "0xa160cdab225685da1d56aa342ad8841c3b53f291",
    category: "sanctioned",
    name: "Tornado Cash: 100 ETH",
    source: "OFAC SDN",
  },
  {
    address: "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
    category: "sanctioned",
    name: "Tornado Cash: Proxy",
    source: "OFAC SDN",
  },
  {
    address: "0xdd4c48c0b24039969fc16d1cdf626eab821d3384",
    category: "sanctioned",
    name: "Tornado Cash: 0.1 WBTC",
    source: "OFAC SDN",
  },
  {
    address: "0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144",
    category: "sanctioned",
    name: "Tornado Cash: 1 WBTC",
    source: "OFAC SDN",
  },
  {
    address: "0xf67721a2d8f736e75a49fdd7fad2e31d8676542a",
    category: "sanctioned",
    name: "Tornado Cash: 100 DAI",
    source: "OFAC SDN",
  },
  {
    address: "0x23773e65ed146a459791799d01336db287f25334",
    category: "sanctioned",
    name: "Tornado Cash: 100K DAI",
    source: "OFAC SDN",
  },
  {
    address: "0x722122df12d4e14e13ac3b6895a86e84145b6967",
    category: "sanctioned",
    name: "Tornado Cash: Router (legacy)",
    source: "OFAC SDN",
  },
  {
    address: "0x098b716b8aaf21512996dc57eb0615e2383e2f96",
    category: "sanctioned",
    name: "Ronin Bridge exploit (Lazarus-linked)",
    source: "OFAC SDN",
  },
];
