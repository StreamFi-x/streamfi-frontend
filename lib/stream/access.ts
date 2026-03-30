import { Horizon } from "@stellar/stellar-sdk";
import type { TokenGateConfig } from "@/types/stream-access";

const Server = Horizon.Server;

function getServer(): InstanceType<typeof Server> {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  const url =
    network === "mainnet"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";
  return new Server(url);
}

function isNativeAsset(code: string): boolean {
  const c = code.toUpperCase();
  return c === "XLM" || c === "NATIVE";
}

function getIssuer(config: TokenGateConfig): string | undefined {
  return config.issuer ?? config.asset_issuer;
}

export function isValidAssetCode(code: string): boolean {
  return /^[A-Z0-9]{1,12}$/i.test(code);
}

export function isValidStellarIssuer(issuer: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(issuer);
}

export async function verifyAssetExists(
  assetCode: string,
  issuer: string
): Promise<boolean> {
  if (!isValidAssetCode(assetCode) || !isValidStellarIssuer(issuer)) {
    return false;
  }

  const server = getServer();

  try {
    const response = await server
      .assets()
      .forCode(assetCode)
      .forIssuer(issuer)
      .limit(1)
      .call();

    return Array.isArray(response.records) && response.records.length > 0;
  } catch {
    return false;
  }
}

/**
 * Server-side token balance check for token-gated streams.
 */
export async function checkTokenGatedAccess(
  config: TokenGateConfig,
  viewerWallet: string | null
): Promise<
  | { allowed: true; reason?: string }
  | {
      allowed: false;
      reason: "no_wallet" | "token_gated";
      asset_code: string;
      min_balance: string;
    }
> {
  const asset_code = config.asset_code;
  const min_balance = config.min_balance;

  if (!viewerWallet) {
    return {
      allowed: false,
      reason: "no_wallet",
      asset_code,
      min_balance,
    };
  }

  const server = getServer();
  let account: Awaited<ReturnType<typeof server.loadAccount>>;
  try {
    account = await server.loadAccount(viewerWallet);
  } catch {
    return {
      allowed: false,
      reason: "token_gated",
      asset_code,
      min_balance,
    };
  }

  const min = parseFloat(min_balance);
  if (!Number.isFinite(min) || min < 0) {
    console.warn("[checkTokenGatedAccess] invalid min_balance — denying");
    return {
      allowed: false,
      reason: "token_gated",
      asset_code,
      min_balance,
    };
  }

  let balance = 0;
  const lines = account.balances as Array<{
    asset_type: string;
    balance: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;

  if (isNativeAsset(asset_code)) {
    const native = lines.find(b => b.asset_type === "native");
    balance = parseFloat(native?.balance ?? "0");
  } else {
    const match = lines.find(
      b =>
        b.asset_type !== "native" &&
        b.asset_type !== "liquidity_pool_shares" &&
        b.asset_code === asset_code &&
        (!getIssuer(config) || b.asset_issuer === getIssuer(config))
    );
    balance = parseFloat(match?.balance ?? "0");
  }

  if (balance >= min) {
    return { allowed: true, reason: "public" };
  }

  return {
    allowed: false,
    reason: "token_gated",
    asset_code,
    min_balance,
  };
}
