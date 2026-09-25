export interface ChannelEntry {
  username: string;
  is_live: boolean;
  updated_at: string;
}

export interface VodEntry {
  id: string;
  username: string;
  published_at: string;
}

/** How far back a VOD can be published and still be included. */
export const RECENT_VOD_WINDOW_DAYS = 30;
