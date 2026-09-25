export interface PurchaseIntentBody {
  tierId: string;
  subscriberWallet: string;
}

export interface TierPrice {
  tier_id: string;
  name: string;
  price_usdc: number;
}

export interface PurchaseIntentResponse {
  transaction_xdr: string;
  network_passphrase: string;
  contract_id: string;
  function_name: string;
  tier_id: string;
  source_account: string;
  fee_stroops: string;
}
