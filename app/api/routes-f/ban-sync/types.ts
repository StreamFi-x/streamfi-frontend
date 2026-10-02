export interface BanSyncSubscription {
  source_creator_id: string;
  target_creator_id: string;
  created_at: string;
}

export interface SubscribeInput {
  source_creator_id: string;
  target_creator_id: string;
  copy_existing?: boolean;
}

export interface UnsubscribeInput {
  source_creator_id: string;
  target_creator_id: string;
}

export interface BanSyncStatus {
  subscribed_to: string[];
  subscribed_by: string[];
}

export interface ChannelBan {
  creator_id: string;
  viewer_id: string;
  banned_at: string;
}
