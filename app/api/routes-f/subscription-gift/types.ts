export interface TierPrice {
  tier_id: string;
  name: string;
  price_usdc: number;
}

export interface GiftIntentBody {
  tierId: string;
  recipientUserId: string;
  gifterWallet: string;
}

export interface GiftIntentResponse {
  transaction_xdr: string;
  network_passphrase: string;
  contract_id: string;
  function_name: string;
  tier_id: string;
  recipient_user_id: string;
  gifted_by: string;
  source_account: string;
  fee_stroops: string;
}
