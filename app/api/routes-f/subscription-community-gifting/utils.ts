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
import type { CommunityGiftingResponse } from "./types";

const FUNCTION_NAME = "community_gift_subscriptions";

// A never-yet-fetched account sequence number; the wallet replaces this with the
// real value (from Horizon/RPC) before signing, same as any unsigned
// transaction preview handed to a client.
const PLACEHOLDER_SEQUENCE = "0";

export function isValidWallet(value: unknown): value is string {
  return typeof value === "string" && StrKey.isValidEd25519PublicKey(value);
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// Builds an unsigned Soroban contract-invocation transaction that calls
// community_gift_subscriptions(tier_id, recipients, gifter) on the subscription
// contract — one invocation that fans a tier out to every selected chatter. The
// gifter wallet is the transaction source and pays for all of the subs.
export function buildCommunityGiftTx(
  tierId: string,
  creatorId: string,
  recipients: string[],
  requestedCount: number,
  gifterWallet: string
): CommunityGiftingResponse {
  const account = new Account(gifterWallet, PLACEHOLDER_SEQUENCE);
  const contract = new Contract(SUBSCRIPTION_CONTRACT_ID);

  const operation = contract.call(
    FUNCTION_NAME,
    nativeToScVal(tierId, { type: "string" }),
    nativeToScVal(recipients, { type: "string" }),
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
    creator_id: creatorId,
    gifted_by: gifterWallet,
    source_account: gifterWallet,
    fee_stroops: BASE_FEE,
    requested_count: requestedCount,
    recipient_count: recipients.length,
    recipients,
  };
}
