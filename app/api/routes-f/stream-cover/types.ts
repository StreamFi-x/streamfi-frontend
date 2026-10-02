export interface CoverImageRecord {
  stream_id: string;
  cover_url: string;
  updated_at: string;
}

export interface PostCoverBody {
  stream_id: string;
  cover_url: string;
}

export interface PostCoverResponse {
  updated_at: string;
}

export interface GetCoverResponse {
  stream_id: string;
  cover_url: string;
  updated_at: string;
}
