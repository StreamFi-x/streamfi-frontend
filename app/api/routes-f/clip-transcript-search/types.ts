export interface ClipTranscript {
  clip_id: string;
  creator_id: string;
  // Full transcript text of the clip.
  text: string;
  // Seconds into the clip where the transcript starts.
  ts: number;
}

export interface ClipSearchResult {
  clip: string;
  snippet: string;
  ts: number;
}

export interface ClipTranscriptSearchResponse {
  results: ClipSearchResult[];
}
