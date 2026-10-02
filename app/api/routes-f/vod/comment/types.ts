export interface VodRecord {
  vod_id: string;
  creator_id: string;
  title: string;
  duration_seconds: number;
  created_at: number; // epoch ms
}

export interface TimestampComment {
  comment_id: string;
  vod_id: string;
  user_id: string;
  text: string;
  time_seconds: number;
  created_at: string; // ISO timestamp
}

export interface PostCommentBody {
  vod_id: string;
  time_seconds: number;
  user_id: string;
  text: string;
}

export interface PostCommentResponse {
  comment_id: string;
  created_at: string;
}

export interface GetCommentsResponse {
  comments: TimestampComment[];
  total: number;
}
