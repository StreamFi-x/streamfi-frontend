export interface DvrBookmark {
  bookmark_id: string;
  viewer_id: string;
  stream_id: string;
  time_seconds: number;
  label: string | null;
  created_at: string;
}

export interface PostBookmarkBody {
  viewer_id: string;
  stream_id: string;
  time_seconds: number;
  label?: string;
}

export interface PostBookmarkResponse {
  bookmark_id: string;
}

export interface GetBookmarksResponse {
  bookmarks: DvrBookmark[];
}

export interface DeleteBookmarkBody {
  viewer_id: string;
  bookmark_id: string;
}
