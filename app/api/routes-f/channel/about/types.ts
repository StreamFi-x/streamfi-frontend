export interface ChannelAbout {
  creator_id: string;
  about_markdown: string;
  last_updated: string;
}

export interface GetAboutResponse {
  about_markdown: string;
  last_updated: string | null;
}

export interface PutAboutBody {
  creator_id: string;
  about_markdown: string;
}

export const MAX_ABOUT_BYTES = 50 * 1024;
