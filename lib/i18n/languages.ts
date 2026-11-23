export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguageCode(value: string): value is LanguageCode {
  return SUPPORTED_LANGUAGES.some(language => language.code === value);
}

export function getLanguageName(code: string): string {
  return (
    SUPPORTED_LANGUAGES.find(language => language.code === code)?.name ?? code
  );
}
