import * as StellarSdk from "@stellar/stellar-sdk";
import { getHorizonUrl, getStellarNetwork, type StellarNetwork } from "./config";

export interface FetchPaymentsParams {
  publicKey: string;
  limit?: number;
  cursor?: string;
  network?: StellarNetwork;
}

export interface TipRecord {
  id: string;
  sender: string;
  amount: string;
  asset: string;
  txHash: string;
  timestamp: string;
  ledger: number;
}

interface HorizonPaymentRecord {
  id?: string;
  paging_token?: string;
  type?: string;
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  transaction_hash?: string;
  created_at?: string;
  ledger_attr?: number;
  ledger?: number;
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
}

export async function getAccountTipStats(publicKey: string) {
  try {
    const { tips } = await fetchPaymentsReceived({
      publicKey,
      limit: 200,
      network: getStellarNetwork(),
      cursor: "now",
    });

    let totalTipsReceived = 0;
    let totalTipsCount = 0;
    let lastTipAt: string | null = null;

    tips.forEach(tip => {
      totalTipsReceived += parseFloat(tip.amount);
      totalTipsCount += 1;
      if (!lastTipAt || tip.timestamp > lastTipAt) {
        lastTipAt = tip.timestamp;
      }
    });

    return {
      totalTipsReceived: totalTipsReceived.toFixed(7),
      totalTipsCount,
      lastTipAt,
    };
  } catch (error) {
    console.error("Error fetching Stellar account stats:", error);
    throw error;
  }
}
