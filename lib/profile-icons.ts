export const PROFILE_ICONS = [
  "/Images/profile-icon/icon1.png",
  "/Images/profile-icon/icon2.png",
  "/Images/profile-icon/icon3.png",
  "/Images/profile-icon/icon4.png",
  "/Images/profile-icon/icon5.png",
  "/Images/profile-icon/icon6.png",
  "/Images/profile-icon/icon7.png",
  "/Images/profile-icon/icon8.png",
  "/Images/profile-icon/icon9.png",
] as const;

/** Assigns a random icon — used at registration so every new user gets a unique default. */
export function getRandomProfileIcon(): string {
  return PROFILE_ICONS[Math.floor(Math.random() * PROFILE_ICONS.length)];
}

/**
 * Returns a deterministic icon for a given seed (username/id).
 * Same seed always maps to the same icon, giving variety without DB state.
 * Falls back to icon1 when no seed is provided.
 */
export function getDefaultAvatar(seed?: string | null): string {
  if (!seed) {
    return PROFILE_ICONS[0];
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash + seed.charCodeAt(i)) & 0xffff;
  }
  return PROFILE_ICONS[hash % PROFILE_ICONS.length];
}

/** True if the URL is one of the built-in preset icons (not a Cloudinary upload). */
export function isPresetIcon(url: string): boolean {
  return url.startsWith("/Images/profile-icon/");
}
