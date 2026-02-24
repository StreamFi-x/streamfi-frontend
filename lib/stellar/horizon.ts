import { Horizon } from "@stellar/stellar-sdk";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getStellarNetwork, getHorizonUrl } from "./config";

export interface FetchPaymentsParams {
  publicKey: string;
  limit?: number;
  cursor?: string;
  network?: "testnet" | "mainnet";
}

export async function fetchPaymentsReceived(params: FetchPaymentsParams) {
  const network = params.network || getStellarNetwork();
  const server = new Horizon.Server(getHorizonUrl(network));

  const paymentsCall = server
    .payments()
    .forAccount(params.publicKey)
    .limit(params.limit || 20)
    .order("desc");

  // Only set cursor if provided; omitting it fetches from the beginning
  if (params.cursor) {
    paymentsCall.cursor(params.cursor);
  }

  const payments = await paymentsCall.call();

  const tips = payments.records
    .filter((payment: any) => {
      return (
        payment.type === "payment" &&
        payment.to === params.publicKey &&
        (payment.asset_type === "native" || payment.asset_type === "credit_alphanum4" || payment.asset_type === "credit_alphanum12")
      );
    })
    .map((payment: any) => ({
      id: payment.id,
      sender: payment.from,
      amount: payment.amount,
      asset: payment.asset_type === "native" ? "XLM" : `${payment.asset_code}:${payment.asset_issuer}`,
      txHash: payment.transaction_hash,
      timestamp: payment.created_at,
      ledger: payment.ledger,
    }));

  // Only set nextCursor if records are available
  const nextCursor = payments.records.length > 0
    ? payments.records[payments.records.length - 1]?.paging_token
    : undefined;

  return {
    tips,
    nextCursor,
  };
}

/**
 * Fetches the total payment statistics for a Stellar account.
 * This looks for incoming payments (native XLM) and sums them up.
 */
export async function getAccountTipStats(publicKey: string) {
  try {
    const network = getStellarNetwork();
    const server = new Horizon.Server(getHorizonUrl(network));

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
        (record.type === "payment" || record.type === "path_payment_strict_receive") &&
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
