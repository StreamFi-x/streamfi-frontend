import { StrKey } from "@stellar/stellar-sdk";

export function isValidStellarAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address);
}
