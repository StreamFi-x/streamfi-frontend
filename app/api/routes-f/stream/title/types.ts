export interface StreamTitleRequestBody {
  stream_id: string;
  title: string;
}

export interface StreamTitleResponse {
  updated_at: string;
  title: string;
}

export interface StreamTitleHistoryResponse {
  history: Array<{
    title: string;
    updated_at: string;
  }>;
}
