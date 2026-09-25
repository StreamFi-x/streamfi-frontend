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
import type { GiftIntentResponse } from "./types";

const FUNCTION_NAME = "gift_subscription";

// A never-yet-fetched account sequence number; the wallet replaces this with the
// real value (from Horizon/RPC) before signing, same as any unsigned
// transaction preview handed to a client.
const PLACEHOLDER_SEQUENCE = "0";

export function isValidWallet(value: unknown): value is string {
  return typeof value === "string" && StrKey.isValidEd25519PublicKey(value);
}

// Builds an unsigned Soroban contract-invocation transaction that calls
// gift_subscription(tier_id, recipient_user_id, gifter) on the subscription
// contract. The gifter wallet is the transaction source and pays for the
// recipient's subscription.
export function buildGiftIntentTx(
  tierId: string,
  recipientUserId: string,
  gifterWallet: string
): GiftIntentResponse {
  const account = new Account(gifterWallet, PLACEHOLDER_SEQUENCE);
  const contract = new Contract(SUBSCRIPTION_CONTRACT_ID);

  const operation = contract.call(
    FUNCTION_NAME,
    nativeToScVal(tierId, { type: "string" }),
    nativeToScVal(recipientUserId, { type: "string" }),
    new Address(gifterWallet).toScVal()
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
    recipient_user_id: recipientUserId,
    gifted_by: gifterWallet,
    source_account: gifterWallet,
    fee_stroops: BASE_FEE,
  };
}
