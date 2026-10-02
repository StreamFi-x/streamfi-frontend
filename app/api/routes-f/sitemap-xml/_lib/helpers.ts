import type { ChangeFreq, UrlEntry } from "./types";

const MAX_URLS = 50_000;

const VALID_CHANGEFREQS: ChangeFreq[] = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseUrlEntry(value: unknown, index: number): UrlEntry {
  if (!isRecord(value)) {
    throw new Error(`urls[${index}] must be an object.`);
  }

  if (typeof value.loc !== "string" || !value.loc.trim()) {
    throw new Error(`urls[${index}].loc must be a non-empty string.`);
  }

  const loc = value.loc.trim();
  if (!isValidUrl(loc)) {
    throw new Error(`urls[${index}].loc must be a valid http/https URL.`);
  }

  const entry: UrlEntry = { loc };

  if (value.lastmod !== undefined) {
    if (typeof value.lastmod !== "string") {
      throw new Error(`urls[${index}].lastmod must be a string.`);
    }
    entry.lastmod = value.lastmod.trim();
  }

  if (value.changefreq !== undefined) {
    if (
      typeof value.changefreq !== "string" ||
      !VALID_CHANGEFREQS.includes(value.changefreq as ChangeFreq)
    ) {
      throw new Error(
        `urls[${index}].changefreq must be one of: ${VALID_CHANGEFREQS.join(", ")}.`
      );
    }
    entry.changefreq = value.changefreq as ChangeFreq;
  }

  if (value.priority !== undefined) {
    const p = Number(value.priority);
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      throw new Error(`urls[${index}].priority must be a number in [0, 1].`);
    }
    entry.priority = p;
  }

  return entry;
}

function buildUrlElement(entry: UrlEntry): string {
  const lines: string[] = [`  <url>`, `    <loc>${escapeXml(entry.loc)}</loc>`];

  if (entry.lastmod !== undefined) {
    lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
  }
  if (entry.changefreq !== undefined) {
    lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  }
  if (entry.priority !== undefined) {
    lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
  }

  lines.push(`  </url>`);
  return lines.join("\n");
}

export function buildSitemap(input: unknown): string {
  if (!isRecord(input)) {
    throw new Error("Request body must be an object.");
  }

  if (!Array.isArray(input.urls) || input.urls.length === 0) {
    throw new Error("urls must be a non-empty array.");
  }

  if (input.urls.length > MAX_URLS) {
    throw new Error(`urls must contain at most ${MAX_URLS} entries.`);
  }

  const entries = input.urls.map(parseUrlEntry);
  const urlElements = entries.map(buildUrlElement).join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urlElements}\n` +
    `</urlset>`
  );
}
