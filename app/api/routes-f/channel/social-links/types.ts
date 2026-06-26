export type SocialPlatform =
  | "twitter"
  | "instagram"
  | "discord"
  | "youtube"
  | "twitch"
  | "tiktok"
  | "website"
  | "other";

export interface SocialLink {
  platform: string;
  url: string;
}

export interface GetSocialLinksResponse {
  links: SocialLink[];
}

export interface PutSocialLinksBody {
  creator_id: string;
  links: SocialLink[];
}

export const MAX_SOCIAL_LINKS = 8;
