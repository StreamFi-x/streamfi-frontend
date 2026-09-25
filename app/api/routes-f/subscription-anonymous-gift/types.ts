export interface TierPrice {
  tier_id: string;
  name: string;
  price_usdc: number;
}

export interface AnonymousGiftIntentBody {
  tierId: string;
  recipientUserId: string;
  gifterWallet: string;
}

export interface AnonymousGiftIntentResponse {
  transaction_xdr: string;
  network_passphrase: string;
  contract_id: string;
  function_name: string;
  tier_id: string;
  recipient_user_id: string;
  // Public-facing attribution: an anonymous gift always shows as "Anonymous".
  gifted_by: "Anonymous";
  // The real gifter wallet — needed to sign the transaction, not shown publicly.
  gifter_wallet: string;
  source_account: string;
  fee_stroops: string;
  // How this gift should render anywhere it is shown to other viewers.
  public_view: { gifted_by: "Anonymous" };
}
