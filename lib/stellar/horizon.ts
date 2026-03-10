import * as StellarSdk from "@stellar/stellar-sdk";
import { getStellarNetwork, getHorizonUrl } from "./config";

interface FetchPaymentsParams {
  publicKey: string;
  limit?: number;
  cursor?: string;
}

interface TipRecord {
  id: string;
  sender: string;
  amount: string;
  asset: string;
  txHash: string;
  timestamp: string;
  ledger: number;
}

interface FetchPaymentsResult {
  tips: TipRecord[];
  nextCursor: string | undefined;
}

/**
 * Fetches incoming payments (tips) for a Stellar account with pagination support.
 */
export async function fetchPaymentsReceived(
  params: FetchPaymentsParams
): Promise<FetchPaymentsResult> {
  try {
    const network = getStellarNetwork();
    const server = new StellarSdk.Horizon.Server(getHorizonUrl(network));

    const payments = await server
      .payments()
      .forAccount(params.publicKey)
      .limit(params.limit || 200)
      .cursor(params.cursor || "now")
      .order("desc")
      .call();

    // Filter only incoming payments with XLM
    const tips: TipRecord[] = payments.records
      .filter((payment: any) => {
        return (
          (payment.type === "payment" ||
            payment.type === "path_payment_strict_receive") &&
          payment.to === params.publicKey &&
          payment.asset_type === "native"
        );
      })
      .map((payment: any) => ({
        id: payment.id,
        sender: payment.from,
        amount: payment.amount,
        asset: "XLM",
        txHash: payment.transaction_hash,
        timestamp: payment.created_at,
        ledger: payment.ledger,
      }));

    return {
      tips,
      nextCursor:
        payments.records.length > 0
          ? payments.records[payments.records.length - 1]?.paging_token
          : undefined,
    };
  } catch (error) {
    console.error("Error fetching payments received:", error);
    throw error;
  }
}

/**
 * Fetches the total payment statistics for a Stellar account.
 * This looks for incoming payments (native XLM) and sums them up.
 */
export async function getAccountTipStats(publicKey: string) {
  try {
    const network = getStellarNetwork();
    const server = new StellarSdk.Horizon.Server(getHorizonUrl(network));

    // We fetch the most recent 200 payments to calculate the total tips.
    // In a production app, you'd use paging tokens to traverse the entire history
    // or a dedicated indexing service like StellarExpert or your own event listener.
    const payments = await server
      .payments()
      .forAccount(publicKey)
      .order("desc")
      .limit(200)
      .call();

    let totalTipsReceived = 0;
    let totalTipsCount = 0;
    let lastTipAt: Date | null = null;

    // Filter for incoming payments of type 'payment' or 'path_payment_strict_receive'
    // that are in native XLM.
    const tipRecords = payments.records.filter((record: any) => {
      return (
        (record.type === "payment" ||
          record.type === "path_payment_strict_receive") &&
        record.to === publicKey &&
        record.asset_type === "native"
      );
    });

    tipRecords.forEach((record: any) => {
      totalTipsReceived += parseFloat(record.amount);
      totalTipsCount += 1;

      const createdAt = new Date(record.created_at);
      if (!lastTipAt || createdAt > lastTipAt) {
        lastTipAt = createdAt;
      }
    });

    return {
      totalTipsReceived: totalTipsReceived.toFixed(7),
      totalTipsCount,
      lastTipAt: lastTipAt ? (lastTipAt as Date).toISOString() : null,
    };
  } catch (error) {
    console.error("Error fetching Stellar account stats:", error);
    throw error;
  }
}
