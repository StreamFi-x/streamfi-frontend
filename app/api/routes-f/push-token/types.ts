export type PushPlatform = "ios" | "android" | "web";

export const PUSH_PLATFORMS: PushPlatform[] = ["ios", "android", "web"];

export interface PushToken {
  token_id: string;
  viewer_id: string;
  platform: PushPlatform;
  token: string;
  registered_at: string;
}

export interface RegisterTokenBody {
  viewer_id: string;
  platform: PushPlatform;
  token: string;
}

export interface DeleteTokenBody {
  token_id?: string;
  viewer_id?: string;
  platform?: PushPlatform;
}

export interface RegisterTokenResponse {
  token_id: string;
}
