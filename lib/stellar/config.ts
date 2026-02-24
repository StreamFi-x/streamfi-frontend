/**
 * Get the configured Stellar network (testnet or mainnet)
 * @returns The network type from environment or defaults to "testnet"
 */
export function getStellarNetwork(): "testnet" | "mainnet" {
  const network = (process.env.NEXT_PUBLIC_STELLAR_NETWORK as "testnet" | "mainnet" | undefined) || "testnet";
  return network;
}
