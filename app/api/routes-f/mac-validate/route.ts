import { NextRequest, NextResponse } from "next/server";
import { OUI_MAP } from "./oui-data";

type Format = "colon" | "dash" | "dot" | "none";

const PATTERNS: { re: RegExp; normalize: (m: string) => string }[] = [
  // 00:11:22:33:44:55
  { re: /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, normalize: (m) => m.replace(/:/g, "") },
  // 00-11-22-33-44-55
  { re: /^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/, normalize: (m) => m.replace(/-/g, "") },
  // 0011.2233.4455
  { re: /^[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}$/, normalize: (m) => m.replace(/\./g, "") },
  // 001122334455
  { re: /^[0-9A-Fa-f]{12}$/, normalize: (m) => m },
];

function parseRaw(mac: string): string | null {
  const trimmed = mac.trim();
  for (const { re, normalize } of PATTERNS) {
    if (re.test(trimmed)) return normalize(trimmed).toUpperCase();
  }
  return null;
}

function applyFormat(raw: string, format: Format): string {
  switch (format) {
    case "colon":
      return raw.match(/.{2}/g)!.join(":");
    case "dash":
      return raw.match(/.{2}/g)!.join("-");
    case "dot":
      return raw.match(/.{4}/g)!.join(".");
    case "none":
      return raw;
  }
}

export async function POST(req: NextRequest) {
  let body: { mac?: unknown; format?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { mac, format = "colon" } = body ?? {};

  if (typeof mac !== "string" || mac.trim() === "") {
    return NextResponse.json(
      { error: "'mac' is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  const VALID_FORMATS: Format[] = ["colon", "dash", "dot", "none"];
  if (!VALID_FORMATS.includes(format as Format)) {
    return NextResponse.json(
      { error: "'format' must be one of: colon, dash, dot, none" },
      { status: 400 },
    );
  }

  const raw = parseRaw(mac);
  if (!raw) {
    return NextResponse.json(
      { error: `'${mac}' is not a valid MAC address` },
      { status: 400 },
    );
  }

  const firstByte = parseInt(raw.slice(0, 2), 16);
  const is_multicast = (firstByte & 0x01) === 1;
  const is_unicast = !is_multicast;
  const is_locally_administered = (firstByte & 0x02) === 2;

  const oui = raw.slice(0, 6);
  const vendor = OUI_MAP[oui];

  return NextResponse.json({
    valid: true,
    normalized: applyFormat(raw, format as Format),
    is_unicast,
    is_multicast,
    is_locally_administered,
    ...(vendor ? { oui: vendor } : {}),
  });
}
