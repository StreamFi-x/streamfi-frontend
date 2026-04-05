import * as StellarSdk from "@stellar/stellar-sdk";
import { getStellarNetwork, type StellarNetwork } from "@/lib/stellar/config";
import { getUsdcAsset, hasUsdcTrustline } from "@/lib/stellar/usdc";
import { buildPaymentTransaction } from "@/lib/stellar/transactions";

export type StreamAccessPaymentParams = {
  viewerPublicKey: string;
  streamerPublicKey: string;
  priceUsdc: string;
  streamId: string;
  network?: StellarNetwork;
};

export async function buildStreamAccessPayment(
  params: StreamAccessPaymentParams
): Promise<StellarSdk.Transaction> {
  const network = params.network ?? getStellarNetwork();

  const trustlineOk = await hasUsdcTrustline({
    publicKey: params.viewerPublicKey,
    network,
  });
  if (!trustlineOk) {
    throw new Error("USDC trustline required");
  }

  return buildPaymentTransaction({
    sourcePublicKey: params.viewerPublicKey,
    destinationPublicKey: params.streamerPublicKey,
    asset: getUsdcAsset(network),
    amount: params.priceUsdc,
    memoText: `streamfi-access:${params.streamId}`,
    network,
    timeoutSeconds: 30,
  });
}
