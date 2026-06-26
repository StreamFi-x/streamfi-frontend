import type { SocialLink } from "./types";

const socialLinksByCreator = new Map<string, SocialLink[]>();

export function getSocialLinks(creatorId: string): SocialLink[] {
  return [...(socialLinksByCreator.get(creatorId) ?? [])];
}

export function setSocialLinks(
  creatorId: string,
  links: SocialLink[]
): SocialLink[] {
  const copy = links.map(l => ({ platform: l.platform, url: l.url }));
  socialLinksByCreator.set(creatorId, copy);
  return copy;
}

export function clearAllSocialLinks(): void {
  socialLinksByCreator.clear();
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
