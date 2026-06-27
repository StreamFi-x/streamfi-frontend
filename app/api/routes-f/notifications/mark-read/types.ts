export type NotificationType =
  | "tip_received"
  | "new_subscriber"
  | "stream_live"
  | "clip_featured"
  | "payment_confirmed"
  | "system";

export interface Notification {
  id: string;
  viewer_id: string;
  type: NotificationType;
  body: string;
  link: string;
  read: boolean;
  created_at: string;
}

export interface MarkReadRequest {
  viewer_id: string;
  ids?: string[];
  all?: boolean;
}

export interface MarkReadResponse {
  updated_count: number;
}
