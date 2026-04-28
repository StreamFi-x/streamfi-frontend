import type { NextRequest } from "next/server";
import { isIP } from "net";
import { MOCK_LOCATIONS, stableHash } from "./_lib/data";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseIPv4(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    throw new Error("Invalid IPv4 address");
  }
  return parts.reduce((acc, part) => {
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error("Invalid IPv4 address");
    }
    return (acc << 8) + value;
  }, 0);
}

function isPrivateIPv4(ip: string): boolean {
  const value = parseIPv4(ip);
  return (
    (value >>> 24) === 0x0a ||
    (value >>> 20) === 0xac1 ||
    (value >>> 16) === 0xc0a8
  );
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd");
}

function makeLocation(ip: string) {
  const hash = stableHash(ip);
  const pick = MOCK_LOCATIONS[hash % MOCK_LOCATIONS.length];
  const offset = (hash >>> 8) / 0xffffffff;
  const lat = Number((pick.lat + (offset * 2 - 1) * 1.2).toFixed(6));
  const lng = Number((pick.lng + (offset * 2 - 1) * 1.2).toFixed(6));
  const isp = `${pick.isp} ${hash % 100}`;

  return {
    country: pick.country,
    country_code: pick.country_code,
    region: pick.region,
    city: pick.city,
    timezone: pick.timezone,
    isp,
    lat,
    lng,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ip = url.searchParams.get("ip")?.trim();

  if (!ip) {
    return jsonResponse({ error: "'ip' query parameter is required" }, 400);
  }

  const version = isIP(ip);
  if (version !== 4 && version !== 6) {
    return jsonResponse({ error: "Invalid IP address" }, 400);
  }

  const is_private = version === 4 ? isPrivateIPv4(ip) : isPrivateIPv6(ip);
  const location = makeLocation(ip);

  return jsonResponse({ ip, is_private, ...location });
}
