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
    return network === "testnet"
        ? Networks.TESTNET
        : Networks.PUBLIC;
}
