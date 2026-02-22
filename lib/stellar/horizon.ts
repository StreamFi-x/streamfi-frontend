import { Server } from "@stellar/stellar-sdk";

export interface FetchPaymentsParams {
  publicKey: string;
  limit?: number;
  cursor?: string;
  network?: "testnet" | "mainnet";
}

export async function fetchPaymentsReceived(params: FetchPaymentsParams) {
  const network = params.network || (process.env.NEXT_PUBLIC_STELLAR_NETWORK as any) || "testnet";

  const server =
    network === "testnet"
      ? new Server("https://horizon-testnet.stellar.org")
      : new Server("https://horizon.stellar.org");

  const payments = await server
    .payments()
    .forAccount(params.publicKey)
    .limit(params.limit || 20)
    .cursor(params.cursor || "now")
    .order("desc")
    .call();

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

  return {
    tips,
    nextCursor: payments.records[payments.records.length - 1]?.paging_token,
  };
}
