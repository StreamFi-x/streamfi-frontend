export type OfflineScreenType = "image" | "clip" | "vod" | "none";

export interface OfflineScreen {
  type: OfflineScreenType;
  source_url?: string;
  vod_id?: string;
}

export interface SetOfflineScreenRequest {
  creator_id: string;
  type: OfflineScreenType;
  source_url?: string;
  vod_id?: string;
}
