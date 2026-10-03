export interface RaidRecord {
  id: string;
  raider_id: string;
  raider_username: string;
  target_id: string;
  target_username: string;
  viewer_count: number;
  raided_at: string;
  is_acknowledged: boolean;
  status: "pending" | "completed" | "cancelled";
}

export interface UserChannelState {
  id: string;
  username: string;
  is_live: boolean;
  allow_incoming_raids: boolean; // Opt-out safeguard
  last_raid_at?: number; // Timestamp for 5-minute cooldown
}

export interface OutgoingRaidPrompt {
  raid_id: string;
  raider_username: string;
  target_username: string;
  target_channel_url: string;
  viewer_count: number;
  prompt_message: string;
  expires_at: string;
}
