import { Horizon } from "@stellar/stellar-sdk";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getStellarNetwork, getHorizonUrl } from "./config";
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
  network?: StellarNetwork;
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

interface HorizonResponse {
  records: HorizonPaymentRecord[];
}

export async function fetchPaymentsReceived(
  params: FetchPaymentsParams
): Promise<{ tips: TipRecord[]; nextCursor: string | null }> {
  const {
    publicKey,
    limit = 20,
    cursor = "now",
    network = getStellarNetwork(),
  } = params;

  if (!publicKey || !publicKey.trim()) {
    return { tips: [], nextCursor: null };
  }

  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(200, Math.floor(limit)))
    : 20;

  try {
    const server = new StellarSdk.Horizon.Server(getHorizonUrl(network));
    const response = (await server
      .payments()
      .forAccount(publicKey)
      .cursor(cursor)
      .limit(safeLimit)
      .order("desc")
      .call()) as HorizonResponse;

    const records = response.records ?? [];
    const incomingNativePayments = records.filter(record => {
      return (
        record.type === "payment" &&
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
    const tips: TipRecord[] = incomingNativePayments.map(record => ({
      id: record.id ?? record.paging_token ?? "",
      sender: record.from ?? "",
      amount: record.amount ?? "0.0000000",
      asset: "XLM",
      txHash: record.transaction_hash ?? "",
      timestamp: record.created_at ?? "",
      ledger: Number(record.ledger_attr ?? record.ledger ?? 0),
    }));

    const lastRecord = records[records.length - 1];
    const nextCursor = lastRecord?.paging_token ?? null;

    return { tips, nextCursor };
  } catch (error) {
    console.error("[horizon] Failed to fetch received payments", {
      publicKey,
      network,
      error,
    });
    return { tips: [], nextCursor: null };
  }
/**
 * Fetches incoming payments (tips) for a Stellar account with pagination support.
 */
export async function fetchPaymentsReceived(params: FetchPaymentsParams): Promise<FetchPaymentsResult> {
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
                    (payment.type === "payment" || payment.type === "path_payment_strict_receive") &&
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
            nextCursor: payments.records.length > 0 
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

    return {
      totalTipsReceived: totalTipsReceived.toFixed(7),
      totalTipsCount,
      lastTipAt: lastTipAt ? (lastTipAt as Date).toISOString() : null,
      lastTipAt,
    };
  } catch (error) {
    console.error("Error fetching Stellar account stats:", error);
    throw error;
  }
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
            lastTipAt: lastTipAt ? (lastTipAt as Date).toISOString() : null
        };
    } catch (error) {
        console.error("Error fetching Stellar account stats:", error);
        throw error;
    }
}
