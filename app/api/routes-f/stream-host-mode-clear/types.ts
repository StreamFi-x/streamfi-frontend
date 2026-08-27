export interface HostModeState {
  channel_id: string;
  hosted_channel_id: string | null;
  started_at: string | null;
}

export interface StreamHostModeClearResponse {
  channel_id: string;
  hosted_channel_id: null;
  cleared_channel_id: string;
}
