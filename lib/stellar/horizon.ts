import { StrKey } from "@stellar/stellar-sdk";
import { logger } from "@/lib/tracing/logger";
import { callHorizon } from "./horizon-client";
import { toStroops, fromStroops } from "./tip-reconciliation";

export interface FetchPaymentsParams {
  publicKey: string;
  limit?: number;
  cursor?: string;
  /**
   * "desc" (default) starts from the newest payment. "asc" starts from the
   * oldest, or after `cursor`, so a walk can resume where it stopped.
   */
  order?: "asc" | "desc";
  /**
   * Filter payments by asset type: "all" (default, XLM + USDC), "native" (XLM only), or "usdc" (USDC only).
   */
  assetType?: "all" | "native" | "usdc";
}

export interface TipRecord {
  id: string;
  sender: string;
  amount: string;
  asset: string;
  assetIssuer?: string;
  txHash: string;
  timestamp: string;
  ledger: number;
}

export interface FetchPaymentsResult {
  tips: TipRecord[];
  nextCursor: string | undefined;
}

export interface AssetTipStats {
  totalAmount: string;
  count: number;
}

export interface AccountTipStatsResult {
  totalTipsReceived: string; // Backwards compatible XLM total formatted in stroops/decimals
  totalXlmReceived: string;
  totalUsdcReceived: string;
  totalTipsCount: number;
  lastTipAt: string | null;
  breakdownByAsset: Record<string, AssetTipStats>;
}

/**
 * Validates a Stellar public key format (G... 56 chars).
 */
export function isValidStellarPublicKey(key: string): boolean {
  if (!key || typeof key !== "string" || key.length !== 56) return false;
  try {
    return StrKey.isValidEd25519PublicKey(key);
  } catch {
    return false;
  }
}

/**
 * Fetches incoming payments (tips) for a Stellar account with multi-asset and pagination support.
 */
export async function fetchPaymentsReceived(
  params: FetchPaymentsParams
): Promise<FetchPaymentsResult> {
  const { publicKey, limit = 200, cursor, order = "desc", assetType = "all" } = params;

  if (!publicKey || !isValidStellarPublicKey(publicKey)) {
    throw new Error(`Invalid Stellar public key: ${publicKey}`);
  }

  const startTime = Date.now();

  try {
    logger.info("Fetching payments from Stellar", {
      operation: "fetchPaymentsReceived",
      publicKey: publicKey.substring(0, 8),
      limit: Math.min(limit, 200),
      assetType,
    });

    const payments = await callHorizon(server => {
      const builder = server
        .payments()
        .forAccount(publicKey)
        .limit(Math.min(limit, 200))
        .order(order);
      return (cursor ? builder.cursor(cursor) : builder).call();
    });

    // Filter incoming payments with XLM or USDC
    const tips: TipRecord[] = payments.records
      .filter((payment: any) => {
        const isIncoming =
          (payment.type === "payment" ||
            payment.type === "path_payment_strict_receive") &&
          payment.to === publicKey;

        if (!isIncoming) return false;

        const isNative = payment.asset_type === "native";
        const isUsdc =
          (payment.asset_code === "USDC" || payment.asset_type?.includes("credit")) &&
          payment.asset_code === "USDC";

        if (assetType === "native") return isNative;
        if (assetType === "usdc") return isUsdc;
        return isNative || isUsdc;
      })
      .map((payment: any) => {
        const isNative = payment.asset_type === "native";
        const asset = isNative ? "XLM" : payment.asset_code || "UNKNOWN";

        return {
          id: payment.id,
          sender: payment.from,
          amount: payment.amount,
          asset,
          assetIssuer: payment.asset_issuer || undefined,
          txHash: payment.transaction_hash,
          timestamp: payment.created_at,
          ledger: payment.ledger,
        };
      });

    const lastRecord = payments.records[payments.records.length - 1];
    const nextCursor =
      payments.records.length > 0 && lastRecord?.paging_token !== cursor
        ? lastRecord?.paging_token
        : undefined;

    const durationMs = Date.now() - startTime;
    logger.info("Payments fetched from Stellar", {
      operation: "fetchPaymentsReceived",
      count: tips.length,
      durationMs,
    });

    return {
      tips,
      nextCursor,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Failed to fetch payments from Stellar", {
      operation: "fetchPaymentsReceived",
      durationMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Fetches comprehensive multi-asset tip statistics for a Stellar account.
 * Aggregates both native XLM (using stroops precision) and USDC tips received.
 */
export async function getAccountTipStats(
  publicKey: string
): Promise<AccountTipStatsResult> {
  if (!publicKey || !isValidStellarPublicKey(publicKey)) {
    throw new Error(`Invalid Stellar public key: ${publicKey}`);
  }

  const startTime = Date.now();

  try {
    logger.info("Fetching account tip stats from Stellar", {
      operation: "getAccountTipStats",
      publicKey: publicKey.substring(0, 8),
    });

    const payments = await callHorizon(server =>
      server.payments().forAccount(publicKey).order("desc").limit(200).call()
    );

    let totalTipsStroops = BigInt(0);
    let totalUsdc = 0;
    let totalTipsCount = 0;
    let lastTipAt: Date | null = null;
    const breakdown: Record<string, { amount: number; count: number; stroops?: bigint }> = {
      XLM: { amount: 0, count: 0, stroops: BigInt(0) },
      USDC: { amount: 0, count: 0 },
    };

    // Filter incoming payments of type 'payment' or 'path_payment_strict_receive'
    const tipRecords = payments.records.filter((record: any) => {
      const isIncoming =
        (record.type === "payment" ||
          record.type === "path_payment_strict_receive") &&
        record.to === publicKey;
      if (!isIncoming) return false;

      const isNative = record.asset_type === "native";
      const isUsdc = record.asset_code === "USDC";
      return isNative || isUsdc;
    });

    tipRecords.forEach((record: any) => {
      const isNative = record.asset_type === "native";
      const assetCode = isNative ? "XLM" : record.asset_code || "OTHER";
      const numAmount = parseFloat(record.amount || "0") || 0;

      if (isNative) {
        try {
          const stroops = toStroops(record.amount);
          totalTipsStroops += stroops;
          breakdown.XLM.stroops = (breakdown.XLM.stroops ?? BigInt(0)) + stroops;
        } catch {
          const fallbackStroops = BigInt(Math.round(numAmount * 10_000_000));
          totalTipsStroops += fallbackStroops;
          breakdown.XLM.stroops = (breakdown.XLM.stroops ?? BigInt(0)) + fallbackStroops;
        }
        breakdown.XLM.amount += numAmount;
        breakdown.XLM.count += 1;
      } else if (assetCode === "USDC") {
        totalUsdc += numAmount;
        breakdown.USDC.amount += numAmount;
        breakdown.USDC.count += 1;
      }

      totalTipsCount += 1;

      const createdAt = new Date(record.created_at);
      if (!lastTipAt || createdAt > lastTipAt) {
        lastTipAt = createdAt;
      }
    });

    const durationMs = Date.now() - startTime;
    logger.info("Account tip stats fetched from Stellar", {
      operation: "getAccountTipStats",
      totalTipsCount,
      totalTipsStroops: totalTipsStroops.toString(),
      totalUsdc: totalUsdc.toFixed(2),
      durationMs,
    });

    const xlmFormatted = fromStroops(totalTipsStroops);
    const breakdownByAsset: Record<string, AssetTipStats> = {
      XLM: {
        totalAmount: xlmFormatted,
        count: breakdown.XLM.count,
      },
      USDC: {
        totalAmount: totalUsdc.toFixed(2),
        count: breakdown.USDC.count,
      },
    };

    return {
      totalTipsReceived: xlmFormatted,
      totalXlmReceived: xlmFormatted,
      totalUsdcReceived: totalUsdc.toFixed(2),
      totalTipsCount,
      lastTipAt: lastTipAt ? (lastTipAt as Date).toISOString() : null,
      breakdownByAsset,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Failed to fetch Stellar account stats", {
      operation: "getAccountTipStats",
      durationMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function isHorizonNotFound(err: unknown): boolean {
  const e = err as { response?: { status?: number }; name?: string } | null;
  return e?.response?.status === 404 || e?.name === "NotFoundError";
}

/**
 * Balances of an account, or null when the account does not exist on the
 * network (never funded or merged). Any other Horizon failure throws, so a
 * timeout is never mistaken for "no account".
 */
export async function getAccountBalances(
  publicKey: string
): Promise<Array<{ assetType: string; balance: string }> | null> {
  try {
    const account = await callHorizon(server =>
      server.accounts().accountId(publicKey).call()
    );
    return account.balances.map(b => ({
      assetType: b.asset_type,
      balance: b.balance,
    }));
  } catch (err) {
    if (isHorizonNotFound(err)) {
      return null;
    }
    throw err;
  }
}
