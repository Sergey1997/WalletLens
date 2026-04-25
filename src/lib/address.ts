import { getAddress, isAddress } from "viem";

export function isEvmAddress(value: string): boolean {
  try {
    return isAddress(value, { strict: false });
  } catch {
    return false;
  }
}

export function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function toChecksumAddress(value: string): string {
  return getAddress(value);
}
