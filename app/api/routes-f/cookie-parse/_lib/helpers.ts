import type { CookieBuildResponse, CookieParseResponse, ParsedCookie, SameSite } from "./types";

const VALID_SAME_SITE: SameSite[] = ["Strict", "Lax", "None"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSingleCookie(cookieStr: string): [string, ParsedCookie] | null {
  const parts = cookieStr.split(";").map((p) => p.trim());
  if (!parts[0]) {return null;}

  const eqIdx = parts[0].indexOf("=");
  if (eqIdx === -1) {return null;}

  const name = decodeURIComponent(parts[0].slice(0, eqIdx).trim());
  const value = decodeURIComponent(parts[0].slice(eqIdx + 1).trim());

  const cookie: ParsedCookie = { value, secure: false, http_only: false };

  for (const attr of parts.slice(1)) {
    const lower = attr.toLowerCase();
    if (lower === "secure") {
      cookie.secure = true;
    } else if (lower === "httponly") {
      cookie.http_only = true;
    } else if (lower.startsWith("expires=")) {
      cookie.expires = attr.slice("expires=".length).trim();
    } else if (lower.startsWith("max-age=")) {
      const age = parseInt(attr.slice("max-age=".length).trim(), 10);
      if (!isNaN(age)) {cookie.max_age = age;}
    } else if (lower.startsWith("domain=")) {
      cookie.domain = attr.slice("domain=".length).trim();
    } else if (lower.startsWith("path=")) {
      cookie.path = attr.slice("path=".length).trim();
    } else if (lower.startsWith("samesite=")) {
      const raw = attr.slice("samesite=".length).trim();
      const normalized = (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()) as SameSite;
      if (VALID_SAME_SITE.includes(normalized)) {
        cookie.same_site = normalized;
      } else {
        throw new Error(`Invalid SameSite value: ${raw}. Must be Strict, Lax, or None.`);
      }
    }
  }

  return [name, cookie];
}

export function parseCookies(input: unknown): CookieParseResponse {
  if (typeof input !== "string") {
    throw new Error("input must be a string for parse mode.");
  }

  const result: CookieParseResponse = {};

  // Each entry is a full Set-Cookie string; multiple entries split by newline
  const entries = input.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const cookies = entries.length > 1 ? entries : [input.trim()];

  for (const cookieStr of cookies) {
    const parsed = parseSingleCookie(cookieStr);
    if (parsed) {
      const [name, cookie] = parsed;
      result[name] = cookie;
    }
  }

  return result;
}

export function buildCookie(input: unknown): CookieBuildResponse {
  if (!isRecord(input)) {
    throw new Error("input must be an object for build mode.");
  }

  const { name, value, expires, max_age, domain, path, secure, http_only, same_site } =
    input as Record<string, unknown>;

  if (typeof name !== "string" || !name) {
    throw new Error("name must be a non-empty string.");
  }
  if (typeof value !== "string") {
    throw new Error("value must be a string.");
  }

  if (same_site !== undefined) {
    if (!VALID_SAME_SITE.includes(same_site as SameSite)) {
      throw new Error(`same_site must be Strict, Lax, or None.`);
    }
  }

  const parts: string[] = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value as string)}`,
  ];

  if (expires) {parts.push(`Expires=${expires}`);}
  if (max_age !== undefined) {parts.push(`Max-Age=${max_age}`);}
  if (domain) {parts.push(`Domain=${domain}`);}
  if (path) {parts.push(`Path=${path}`);}
  if (secure) {parts.push("Secure");}
  if (http_only) {parts.push("HttpOnly");}
  if (same_site) {parts.push(`SameSite=${same_site}`);}

  return { header: parts.join("; ") };
}
