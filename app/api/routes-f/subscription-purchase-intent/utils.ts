import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, SUBSCRIPTION_CONTRACT_ID } from "./seedData";
import type { PurchaseIntentResponse } from "./types";

const FUNCTION_NAME = "purchase_subscription";

// A never-yet-fetched account sequence number; the wallet replaces this with
// the real value (from Horizon/RPC) before signing, same as any unsigned
// transaction preview handed to a client.
const PLACEHOLDER_SEQUENCE = "0";

export function isValidWallet(value: unknown): value is string {
  return typeof value === "string" && StrKey.isValidEd25519PublicKey(value);
}

// Builds an unsigned Soroban contract-invocation transaction that calls
// purchase_subscription(tier_id, subscriber) on the subscription contract.
export function buildPurchaseIntentTx(
  tierId: string,
  subscriberWallet: string
): PurchaseIntentResponse {
  const account = new Account(subscriberWallet, PLACEHOLDER_SEQUENCE);
  const contract = new Contract(SUBSCRIPTION_CONTRACT_ID);

  const operation = contract.call(
    FUNCTION_NAME,
    nativeToScVal(tierId, { type: "string" }),
    new Address(subscriberWallet).toScVal()
  );

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  return {
    transaction_xdr: transaction.toXDR(),
    network_passphrase: NETWORK_PASSPHRASE,
    contract_id: SUBSCRIPTION_CONTRACT_ID,
    function_name: FUNCTION_NAME,
    tier_id: tierId,
    source_account: subscriberWallet,
    fee_stroops: BASE_FEE,
  };
}
