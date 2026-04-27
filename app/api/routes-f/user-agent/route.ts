import { NextRequest, NextResponse } from "next/server";

const MAX_UA_BYTES = 4 * 1024;

interface BrowserInfo { name: string; version: string }
interface OsInfo { name: string; version: string }
interface DeviceInfo { type: "desktop" | "mobile" | "tablet" | "bot" | "unknown"; vendor?: string; model?: string }

function parseBrowser(ua: string): BrowserInfo {
  // Order matters — check specific browsers before generic ones
  const rules: [RegExp, string][] = [
    [/Edg(?:e|A|iOS)?\/(\S+)/, "Edge"],
    [/OPR\/(\S+)/, "Opera"],
    [/Opera\/(\S+)/, "Opera"],
    [/Brave\/(\S+)/, "Brave"],
    [/SamsungBrowser\/(\S+)/, "Samsung Browser"],
    [/Firefox\/(\S+)/, "Firefox"],
    [/FxiOS\/(\S+)/, "Firefox"],
    [/CriOS\/(\S+)/, "Chrome"],
    [/Chrome\/(\S+)/, "Chrome"],
    [/Version\/(\S+).*Safari/, "Safari"],
    [/Safari\/(\S+)/, "Safari"],
    [/MSIE (\S+)/, "IE"],
    [/Trident\/.*rv:(\S+)/, "IE"],
  ];

  for (const [re, name] of rules) {
    const m = ua.match(re);
    if (m) return { name, version: m[1].replace(/[;)]+$/, "") };
  }
  return { name: "unknown", version: "" };
}

function parseOs(ua: string): OsInfo {
  const rules: [RegExp, string][] = [
    [/Windows NT ([\d.]+)/, "Windows"],
    [/Android ([\d.]+)/, "Android"],
    [/iPhone OS ([\d_]+)/, "iOS"],
    [/iPad.*OS ([\d_]+)/, "iOS"],
    [/Mac OS X ([\d_.]+)/, "macOS"],
    [/Linux/, "Linux"],
    [/CrOS \S+ ([\d.]+)/, "ChromeOS"],
  ];

  for (const [re, name] of rules) {
    const m = ua.match(re);
    if (m) {
      const version = m[1] ? m[1].replace(/_/g, ".") : "";
      return { name, version };
    }
  }
  return { name: "unknown", version: "" };
}

function parseDevice(ua: string, isBot: boolean): DeviceInfo {
  if (isBot) return { type: "bot" };

  if (/iPad/.test(ua)) return { type: "tablet", vendor: "Apple", model: "iPad" };
  if (/Tablet|PlayBook/.test(ua)) return { type: "tablet" };

  if (/Mobile|Android.*Mobile|iPhone|iPod|Windows Phone/.test(ua)) {
    const vendor = /iPhone|iPad|iPod/.test(ua) ? "Apple" : undefined;
    const model = /iPhone/.test(ua) ? "iPhone" : /iPod/.test(ua) ? "iPod" : undefined;
    return { type: "mobile", ...(vendor && { vendor }), ...(model && { model }) };
  }

  if (/Android/.test(ua) && !/Mobile/.test(ua)) return { type: "tablet" };

  return { type: "desktop" };
}

function isBot(ua: string): boolean {
  return /Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot|facebot|ia_archiver|bot|crawl|spider/i.test(ua);
}

export async function POST(req: NextRequest) {
  let body: { ua?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ua = body?.ua;
  if (typeof ua !== "string" || !ua.trim()) {
    return NextResponse.json({ error: "ua is required" }, { status: 400 });
  }

  if (Buffer.byteLength(ua, "utf8") > MAX_UA_BYTES) {
    return NextResponse.json({ error: "ua exceeds 4KB limit" }, { status: 413 });
  }

  const bot = isBot(ua);

  return NextResponse.json({
    browser: parseBrowser(ua),
    os: parseOs(ua),
    device: parseDevice(ua, bot),
    is_bot: bot,
  });
}
