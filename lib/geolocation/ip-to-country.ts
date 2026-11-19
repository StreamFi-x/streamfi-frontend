/**
 * IP-to-Country Geolocation Service (#1383)
 *
 * Resolves viewer IP addresses to country codes for geographic analytics.
 * Uses a lightweight, privacy-preserving approach with optional caching.
 */

import { createHash } from "crypto";

// Simple in-memory cache for geolocation results
const geoCache = new Map<string, { country: string; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Supported geolocation providers
 */
type GeoProvider = "maxmind" | "ipapi" | "manual";

/**
 * Geolocation result
 */
export interface GeoResult {
  /** ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "DE") */
  country: string | null;
  /** Whether the result is from cache */
  cached: boolean;
  /** Provider that supplied the result */
  provider: GeoProvider;
}

/**
 * Resolve an IP address to a country code
 * 
 * Privacy considerations:
 * - Only stores the resolved country code, never the raw IP long-term
 * - Uses hashing for cache keys instead of raw IPs
 * - Results are cached with TTL to reduce external API calls
 * 
 * Accuracy limitations:
 * - VPNs, proxies, and corporate networks may misattribute location
 * - Mobile carrier NAT can show carrier's location instead of user's
 * - Results should be treated as approximate, not definitive
 */
export async function ipToCountry(ipAddress: string): Promise<GeoResult> {
  if (!ipAddress || ipAddress === "unknown") {
    return { country: null, cached: false, provider: "manual" };
  }

  // Validate IP format
  if (!isValidIpAddress(ipAddress)) {
    return { country: null, cached: false, provider: "manual" };
  }

  // Check cache first
  const cacheKey = hashIp(ipAddress);
  const cached = geoCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { country: cached.country, cached: true, provider: "manual" };
  }

  // Try to resolve from configured provider
  const provider = process.env.GEO_PROVIDER as GeoProvider || "manual";
  let country: string | null = null;

  try {
    switch (provider) {
      case "maxmind":
        country = await resolveFromMaxMind(ipAddress);
        break;
      case "ipapi":
        country = await resolveFromIpApi(ipAddress);
        break;
      case "manual":
      default:
        // Fallback: return null if no provider configured
        country = null;
    }
  } catch (error) {
    console.error("[ipToCountry] Geolocation failed:", error);
    country = null;
  }

  // Cache the result
  if (country) {
    geoCache.set(cacheKey, { country, timestamp: Date.now() });
  }

  return { country, cached: false, provider };
}

/**
 * Validate IP address format (IPv4 and IPv6)
 */
function isValidIpAddress(ip: string): boolean {
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return ip.split(".").every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  // IPv6 (simplified validation)
  if (/^[\da-fA-F:]+$/.test(ip) && ip.includes(":")) {
    return true;
  }
  
  return false;
}

/**
 * Hash IP address for cache key (privacy-preserving)
 */
function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").substring(0, 16);
}

/**
 * Resolve country using MaxMind GeoLite2 database
 * Requires MAXMIND_DB_PATH environment variable
 */
async function resolveFromMaxMind(ip: string): Promise<string | null> {
  const dbPath = process.env.MAXMIND_DB_PATH;
  if (!dbPath) {
    console.warn("[ipToCountry] MAXMIND_DB_PATH not configured");
    return null;
  }

  try {
    // Dynamic import to avoid requiring the database in all environments
    const Reader = require("@maxmind/geoip2-node").Reader;
    const reader = await Reader.open(dbPath);
    const response = reader.country(ip);
    return response.country?.isoCode || null;
  } catch (error) {
    console.error("[ipToCountry] MaxMind resolution failed:", error);
    return null;
  }
}

/**
 * Resolve country using ipapi.co API
 * Requires IPAPI_API_KEY environment variable (free tier available)
 */
async function resolveFromIpApi(ip: string): Promise<string | null> {
  const apiKey = process.env.IPAPI_API_KEY;
  const baseUrl = apiKey 
    ? `https://ipapi.co/${ip}/json/?key=${apiKey}`
    : `https://ipapi.co/${ip}/json/`;

  try {
    const response = await fetch(baseUrl, {
      headers: { "User-Agent": "StreamFi/1.0" },
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.country_code || null;
  } catch (error) {
    console.error("[ipToCountry] ipapi resolution failed:", error);
    return null;
  }
}

/**
 * Clean up expired cache entries
 * Call this periodically to prevent memory bloat
 */
export function cleanupGeoCache(): void {
  const now = Date.now();
  for (const [key, value] of geoCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL_MS) {
      geoCache.delete(key);
    }
  }
}

/**
 * Get cache statistics for monitoring
 */
export function getGeoCacheStats(): { size: number; entries: number } {
  return {
    size: geoCache.size,
    entries: geoCache.size,
  };
}