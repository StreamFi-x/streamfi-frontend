export type RaidStatus = "pending" | "redirected" | "cancelled";

export interface Raid {
  raid_id: string;
  from_channel_id: string;
  to_channel_id: string;
  status: RaidStatus;
  initiated_at: string;
  redirect_at: string;
  cancelled_at: string | null;
}

export interface RaidCancelBody {
  raid_id: string;
  channel_id: string;
}

export interface RaidCancelResponse {
  raid: Raid;
}
