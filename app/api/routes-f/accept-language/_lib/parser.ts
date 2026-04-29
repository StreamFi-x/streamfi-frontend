export type ParsedLanguage = {
  locale: string;
  q: number;
};

const LOCALE_RE = /^(?:\*|[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*)$/;

function normalizeLocale(locale: string): string {
  return locale
    .split("-")
    .map((part, index) =>
      index === 0 ? part.toLowerCase() : part.toUpperCase(),
    )
    .join("-");
}

function parseQ(value: string): number | null {
  if (!/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value)) return null;
  const q = Number(value);
  return Number.isFinite(q) && q >= 0 && q <= 1 ? q : null;
}

export function parseAcceptLanguage(header: string): ParsedLanguage[] {
  return header
    .split(",")
    .map((part, index) => {
      const [rawLocale, ...params] = part.trim().split(";").map((p) => p.trim());
      if (!rawLocale || !LOCALE_RE.test(rawLocale)) return null;

      let q = 1;
      for (const param of params) {
        const [key, value] = param.split("=").map((p) => p.trim());
        if (key.toLowerCase() !== "q") continue;
        const parsedQ = parseQ(value);
        if (parsedQ === null) return null;
        q = parsedQ;
      }

      return { locale: normalizeLocale(rawLocale), q, index };
    })
    .filter(
      (entry): entry is ParsedLanguage & { index: number } => entry !== null,
    )
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map(({ locale, q }) => ({ locale, q }));
}

export function bestMatch(
  parsed: ParsedLanguage[],
  supported: string[],
): string | null {
  const normalizedSupported = supported
    .filter((locale) => typeof locale === "string" && LOCALE_RE.test(locale))
    .map((locale) => ({
      original: locale,
      normalized: normalizeLocale(locale),
      language: normalizeLocale(locale).split("-")[0],
    }));

  for (const requested of parsed) {
    if (requested.q <= 0) continue;
    const exact = normalizedSupported.find(
      (locale) => locale.normalized === requested.locale,
    );
    if (exact) return exact.original;

    const requestedLanguage = requested.locale.split("-")[0];
    const prefix = normalizedSupported.find(
      (locale) => locale.language === requestedLanguage,
    );
    if (prefix) return prefix.original;
  }

  return null;
}
