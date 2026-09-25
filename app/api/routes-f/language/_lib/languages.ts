export const SUPPORTED_LANGUAGES: string[] = [
  "en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh",
  "ar", "hi", "bn", "pa", "ta", "te", "mr", "gu", "kn", "ml",
  "th", "vi", "tr", "nl", "pl", "sv", "da", "fi", "nb", "cs",
  "hu", "ro", "uk", "el", "he", "id", "ms", "tl", "sw", "hr",
];

export type CreatorLanguage = {
  creator_id: string;
  primary: string;
  secondary: string[];
};

const store = new Map<string, CreatorLanguage>();

export function getStore(): Map<string, CreatorLanguage> {
  return store;
}

export function resetStore(): void {
  store.clear();
}

export function isValidCode(code: string): boolean {
  return SUPPORTED_LANGUAGES.includes(code);
}
