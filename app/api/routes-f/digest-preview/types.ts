export type DigestCategory =
  | "followed_live"
  | "new_streams"
  | "tips_recap"
  | "recommended";

export interface DigestOptIns {
  viewer_id: string;
  followed_live: boolean;
  new_streams: boolean;
  tips_recap: boolean;
  recommended: boolean;
}

export interface DigestItem {
  id: string;
  title: string;
  subtitle: string;
}

export interface DigestSection {
  title: string;
  items: DigestItem[];
}

export interface DigestPreviewResponse {
  sections: DigestSection[];
  scheduled_send: string;
}
