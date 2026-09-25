export interface TierPrice {
  tier_id: string;
  name: string;
  price_usdc: number;
}

export interface CommunityGiftingBody {
  tierId: string;
  count: number;
  creatorId: string;
  gifterWallet: string;
}

export interface CommunityGiftingResponse {
  transaction_xdr: string;
  network_passphrase: string;
  contract_id: string;
  function_name: string;
  tier_id: string;
  creator_id: string;
  gifted_by: string;
  source_account: string;
  fee_stroops: string;
  // How many gift subs were requested vs. actually assigned recipients.
  requested_count: number;
  recipient_count: number;
  // The next N eligible active chatters, in the order they were chosen.
  recipients: string[];
}
