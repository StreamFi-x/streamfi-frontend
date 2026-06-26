export interface PlaylistItem {
  vod_id: string;
  added_at: string;
}

export interface ViewerPlaylist {
  viewer_id: string;
  items: PlaylistItem[];
}

export interface PostPlaylistBody {
  viewer_id: string;
  vod_id: string;
}

export interface DeletePlaylistBody {
  viewer_id: string;
  vod_id: string;
}

export interface ReorderBody {
  viewer_id: string;
  order: string[];
}
