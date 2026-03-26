import * as StellarSdk from "@stellar/stellar-sdk";
import { getHorizonUrl, getNetworkPassphrase, type StellarNetwork } from "./config";

export type UsdcAssetConfig = {
  code: "USDC";
  issuer: string;
};

const MAINNET_USDC_ISSUER_FALLBACK =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

export function getUsdcAssetConfig(network: StellarNetwork): UsdcAssetConfig {
  const envIssuer =
    network === "mainnet"
      ? process.env.NEXT_PUBLIC_STELLAR_USDC_ISSUER_MAINNET
      : process.env.NEXT_PUBLIC_STELLAR_USDC_ISSUER_TESTNET;

  if (envIssuer && /^G[A-Z0-9]{55}$/.test(envIssuer)) {
    return { code: "USDC", issuer: envIssuer };
  }

  if (network === "mainnet") {
    return { code: "USDC", issuer: MAINNET_USDC_ISSUER_FALLBACK };
  }

  throw new Error(
    "Missing NEXT_PUBLIC_STELLAR_USDC_ISSUER_TESTNET (must be a Stellar G-address)"
  );
}

export function getUsdcAsset(network: StellarNetwork): StellarSdk.Asset {
  const { code, issuer } = getUsdcAssetConfig(network);
  return new StellarSdk.Asset(code, issuer);
}

export async function hasUsdcTrustline(params: {
  publicKey: string;
  network: StellarNetwork;
}): Promise<boolean> {
  const server = new StellarSdk.Horizon.Server(getHorizonUrl(params.network));
  const account = await server.loadAccount(params.publicKey);
  const { issuer } = getUsdcAssetConfig(params.network);
  return account.balances.some(b => {
    if (b.asset_type !== "credit_alphanum4") {
      return false;
    }
    return (b as any).asset_code === "USDC" && (b as any).asset_issuer === issuer;
  });
}

export async function getUsdcBalance(params: {
  publicKey: string;
  network: StellarNetwork;
}): Promise<string> {
  const server = new StellarSdk.Horizon.Server(getHorizonUrl(params.network));
  const account = await server.loadAccount(params.publicKey);
  const { issuer } = getUsdcAssetConfig(params.network);
  const bal = account.balances.find(b => {
    if (b.asset_type !== "credit_alphanum4") {
      return false;
    }
    return (b as any).asset_code === "USDC" && (b as any).asset_issuer === issuer;
  });
  return bal ? String((bal as any).balance ?? "0") : "0";
}

export async function buildUsdcTrustlineTransaction(params: {
  publicKey: string;
  network: StellarNetwork;
}): Promise<StellarSdk.Transaction> {
  const server = new StellarSdk.Horizon.Server(getHorizonUrl(params.network));
  const account = await server.loadAccount(params.publicKey);

  const networkPassphrase = getNetworkPassphrase(params.network);
  const usdc = getUsdcAsset(params.network);

  return new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: usdc,
      })
    )
    .addMemo(StellarSdk.Memo.text("StreamFi USDC"))
    .setTimeout(30)
    .build();
}

