export type Rating = "family" | "teen" | "mature";

export interface ContentRatingRecord {
  creator_id: string;
  rating: Rating;
}

export interface ViewerConfirmation {
  viewer_id: string;
  creator_id: string;
  confirmed_at: string;
}
