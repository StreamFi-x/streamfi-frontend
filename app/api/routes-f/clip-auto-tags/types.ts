export interface ClipAutoTagsRequest {
  title: string;
  description?: string;
}

export interface ClipAutoTagsResponse {
  tags: string[];
}
