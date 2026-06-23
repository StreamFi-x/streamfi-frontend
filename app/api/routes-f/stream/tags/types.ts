export interface StreamTagsRequestBody {
  stream_id: string;
  add?: string[];
  remove?: string[];
}

export interface StreamTagsResponse {
  tags: string[];
}

export interface TitleChangeEntry {
  title: string;
  updated_at: string;
}
