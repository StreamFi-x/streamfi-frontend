import StellarSdk from "@stellar/stellar-sdk";
import { getHorizonUrl, type StellarNetwork } from "./config";

export interface FetchPaymentsParams {
  publicKey: string;
  limit?: number;
  cursor?: string;
  network: StellarNetwork;
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

export async function fetchPaymentsReceived(
  params: FetchPaymentsParams
): Promise<{ tips: TipRecord[]; nextCursor: string | null }> {
  const { publicKey, limit = 20, cursor = "now", network } = params;

  if (!publicKey || !publicKey.trim()) {
    return { tips: [], nextCursor: null };
  }

  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(200, Math.floor(limit)))
    : 20;

  try {
    const server = new Server(getHorizonUrl(network));
    const response = await server
      .payments()
      .forAccount(publicKey)
      .cursor(cursor)
      .limit(safeLimit)
      .order("desc")
      .call();

    const records = ((response as { records?: HorizonPaymentRecord[] }).records ??
      []) as HorizonPaymentRecord[];

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
      amount: record.amount ?? "0",
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
const { Server } = StellarSdk;
