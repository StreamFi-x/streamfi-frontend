import * as StellarSdk from "@stellar/stellar-sdk";
import {
  getHorizonUrl,
  getNetworkPassphrase,
  type StellarNetwork,
} from "./config";

export async function buildPaymentTransaction(params: {
  sourcePublicKey: string;
  destinationPublicKey: string;
  asset: StellarSdk.Asset;
  amount: string;
  memoText?: string;
  network: StellarNetwork;
  timeoutSeconds?: number;
}): Promise<StellarSdk.Transaction> {
  const server = new StellarSdk.Horizon.Server(getHorizonUrl(params.network));
  const sourceAccount = await server.loadAccount(params.sourcePublicKey);
  const networkPassphrase = getNetworkPassphrase(params.network);

  const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  }).addOperation(
    StellarSdk.Operation.payment({
      destination: params.destinationPublicKey,
      asset: params.asset,
      amount: params.amount,
    })
  );

  if (params.memoText) {
    builder.addMemo(StellarSdk.Memo.text(params.memoText));
  }

  return builder.setTimeout(params.timeoutSeconds ?? 30).build();
}
