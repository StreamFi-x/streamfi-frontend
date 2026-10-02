export type LedgerEntryType = "earn" | "redemption";

export interface LedgerEntry {
  entry_id: string;
  viewer_id: string;
  creator_id: string;
  type: LedgerEntryType;
  amount: number;
  reason: string;
  balance_after: number;
  created_at: string;
}

export interface ChannelPointsHistoryResponse {
  viewer_id: string;
  creator_id: string;
  ledger: LedgerEntry[];
}
