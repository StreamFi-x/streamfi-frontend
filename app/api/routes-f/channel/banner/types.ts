export interface FocalPoint {
  x: number;
  y: number;
}

export interface ChannelBanner {
  creator_id: string;
  banner_url: string;
  focal_point: FocalPoint;
  last_updated: string;
}

export interface GetBannerResponse {
  banner_url: string;
  focal_point: FocalPoint;
}

export interface PutBannerBody {
  creator_id: string;
  banner_url: string;
  focal_point?: FocalPoint;
}

export const DEFAULT_FOCAL_POINT: FocalPoint = { x: 0.5, y: 0.5 };
