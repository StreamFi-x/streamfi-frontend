import { Networks } from "@stellar/stellar-sdk";

export type StellarNetwork = "testnet" | "mainnet";

export function getStellarNetwork(): StellarNetwork {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  if (network !== "testnet" && network !== "mainnet") {
    console.warn(`Invalid STELLAR_NETWORK: ${network}. Defaulting to testnet.`);
    return "testnet";
  }
  return network;
}

export function getHorizonUrl(network: StellarNetwork): string {
  return network === "testnet"
    ? "https://horizon-testnet.stellar.org"
    : "https://horizon.stellar.org";
}

export function getNetworkPassphrase(network: StellarNetwork): string {
  return network === "testnet" ? Networks.TESTNET : Networks.PUBLIC;
}

/**
 * Get the link to the Stellar Explorer for a transaction or account
 * @param type - Explorer type ('tx' or 'account')
 * @param value - Transaction hash or Public Key
 */
export function getStellarExplorerUrl(
  type: "tx" | "account",
  value: string
): string {
  const network = getStellarNetwork();
  const baseUrl =
    network === "testnet"
      ? "https://stellar.expert/explorer/testnet"
      : "https://stellar.expert/explorer/public";

  return `${baseUrl}/${type}/${value}`;
}
