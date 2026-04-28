import { NextRequest, NextResponse } from "next/server";

// ── IPv4 helpers ──────────────────────────────────────────────────────────────

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function intToIpv4(n: number): string {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ].join(".");
}

function isValidIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

function calcIpv4(ip: string, prefix: number) {
  const ipInt = ipv4ToInt(ip);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const network = (ipInt & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const netmask = intToIpv4(mask);

  let firstHost: string;
  let lastHost: string;
  let hostCount: number;

  if (prefix === 32) {
    firstHost = intToIpv4(network);
    lastHost = intToIpv4(network);
    hostCount = 1;
  } else if (prefix === 31) {
    // Point-to-point (RFC 3021): both addresses usable
    firstHost = intToIpv4(network);
    lastHost = intToIpv4(broadcast);
    hostCount = 2;
  } else {
    firstHost = intToIpv4(network + 1);
    lastHost = intToIpv4(broadcast - 1);
    hostCount = Math.pow(2, 32 - prefix) - 2;
  }

  return {
    network: intToIpv4(network),
    broadcast: intToIpv4(broadcast),
    first_host: firstHost,
    last_host: lastHost,
    host_count: hostCount,
    netmask,
    prefix_length: prefix,
    version: 4 as const,
  };
}

// ── IPv6 helpers (128-bit via two 64-bit halves as numbers) ───────────────────
// We represent a 128-bit address as [hi, lo] where each is a 32-bit unsigned int
// (4 x 32-bit words: [w0, w1, w2, w3], w0 = most significant)

type U128 = [number, number, number, number]; // four 32-bit words, big-endian

function isValidIpv6(ip: string): boolean {
  if (ip.includes(":::")) return false;
  const doubleColons = (ip.match(/::/g) || []).length;
  if (doubleColons > 1) return false;
  const expanded = expandIpv6(ip);
  if (!expanded) return false;
  const groups = expanded.split(":");
  return groups.length === 8 && groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g));
}

function expandIpv6(ip: string): string | null {
  if (ip.includes("::")) {
    const [left, right] = ip.split("::");
    const leftParts = left ? left.split(":") : [];
    const rightParts = right ? right.split(":") : [];
    const missing = 8 - leftParts.length - rightParts.length;
    if (missing < 0) return null;
    return [...leftParts, ...Array(missing).fill("0"), ...rightParts].join(":");
  }
  return ip;
}

function ipv6ToU128(ip: string): U128 {
  const expanded = expandIpv6(ip)!;
  const groups = expanded.split(":").map((g) => parseInt(g || "0", 16));
  return [
    ((groups[0] << 16) | groups[1]) >>> 0,
    ((groups[2] << 16) | groups[3]) >>> 0,
    ((groups[4] << 16) | groups[5]) >>> 0,
    ((groups[6] << 16) | groups[7]) >>> 0,
  ];
}

function u128ToIpv6(w: U128): string {
  const groups: string[] = [];
  for (let i = 0; i < 4; i++) {
    groups.push(((w[i] >>> 16) & 0xffff).toString(16));
    groups.push((w[i] & 0xffff).toString(16));
  }
  // Compress longest run of "0" groups
  let best = { start: -1, len: 0 };
  let cur = { start: -1, len: 0 };
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === "0") {
      if (cur.start === -1) cur = { start: i, len: 1 };
      else cur.len++;
      if (cur.len > best.len) best = { ...cur };
    } else {
      cur = { start: -1, len: 0 };
    }
  }
  if (best.len > 1) {
    const left = groups.slice(0, best.start).join(":");
    const right = groups.slice(best.start + best.len).join(":");
    const result = `${left}::${right}`;
    return result.replace(/^:([^:])/, "::$1").replace(/([^:]):$/, "$1::");
  }
  return groups.join(":");
}

// Build a 128-bit mask from prefix length
function prefixToMask(prefix: number): U128 {
  const mask: U128 = [0, 0, 0, 0];
  let remaining = prefix;
  for (let i = 0; i < 4; i++) {
    if (remaining >= 32) {
      mask[i] = 0xffffffff >>> 0;
      remaining -= 32;
    } else if (remaining > 0) {
      mask[i] = (~0 << (32 - remaining)) >>> 0;
      remaining = 0;
    } else {
      mask[i] = 0;
    }
  }
  return mask;
}

function andU128(a: U128, b: U128): U128 {
  return [a[0] & b[0], a[1] & b[1], a[2] & b[2], a[3] & b[3]].map((v) => v >>> 0) as U128;
}

function orU128(a: U128, b: U128): U128 {
  return [a[0] | b[0], a[1] | b[1], a[2] | b[2], a[3] | b[3]].map((v) => v >>> 0) as U128;
}

function notU128(a: U128): U128 {
  return [~a[0], ~a[1], ~a[2], ~a[3]].map((v) => v >>> 0) as U128;
}

function addOneU128(a: U128): U128 {
  const result: U128 = [...a] as U128;
  for (let i = 3; i >= 0; i--) {
    result[i] = (result[i] + 1) >>> 0;
    if (result[i] !== 0) break;
  }
  return result;
}

function subOneU128(a: U128): U128 {
  const result: U128 = [...a] as U128;
  for (let i = 3; i >= 0; i--) {
    if (result[i] > 0) {
      result[i] = (result[i] - 1) >>> 0;
      break;
    }
    result[i] = 0xffffffff >>> 0;
  }
  return result;
}

// Count of addresses = 2^hostBits; return as string if > MAX_SAFE_INTEGER
function hostCount(prefix: number): number | string {
  const hostBits = 128 - prefix;
  if (prefix === 128) return 1;
  if (hostBits >= 53) {
    // Too large for safe integer — compute as string via repeated doubling
    // 2^hostBits - 2
    let val = "2";
    for (let i = 1; i < hostBits; i++) {
      // multiply by 2
      let carry = 0;
      const digits = val.split("").reverse().map(Number);
      const result: number[] = [];
      for (const d of digits) {
        const prod = d * 2 + carry;
        result.push(prod % 10);
        carry = Math.floor(prod / 10);
      }
      if (carry) result.push(carry);
      val = result.reverse().join("");
    }
    // subtract 2
    const digits = val.split("").map(Number);
    let borrow = 2;
    for (let i = digits.length - 1; i >= 0 && borrow > 0; i--) {
      const diff = digits[i] - borrow;
      if (diff < 0) {
        digits[i] = diff + 10;
        borrow = 1;
      } else {
        digits[i] = diff;
        borrow = 0;
      }
    }
    return digits.join("").replace(/^0+/, "") || "0";
  }
  return Math.pow(2, hostBits) - 2;
}

function calcIpv6(ip: string, prefix: number) {
  const addr = ipv6ToU128(ip);
  const mask = prefixToMask(prefix);
  const network = andU128(addr, mask);
  const broadcast = orU128(network, notU128(mask));
  const netmask = `/${prefix}`;

  let firstHost: string;
  let lastHost: string;
  let hCount: number | string;

  if (prefix === 128) {
    firstHost = u128ToIpv6(network);
    lastHost = u128ToIpv6(network);
    hCount = 1;
  } else {
    firstHost = u128ToIpv6(addOneU128(network));
    lastHost = u128ToIpv6(subOneU128(broadcast));
    hCount = hostCount(prefix);
  }

  return {
    network: u128ToIpv6(network),
    broadcast: u128ToIpv6(broadcast),
    first_host: firstHost,
    last_host: lastHost,
    host_count: hCount,
    netmask,
    prefix_length: prefix,
    version: 6 as const,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { cidr } = body;

  if (typeof cidr !== "string" || !cidr.trim()) {
    return NextResponse.json({ error: "cidr must be a non-empty string." }, { status: 400 });
  }

  const slashIdx = cidr.lastIndexOf("/");
  if (slashIdx === -1) {
    return NextResponse.json({ error: `Invalid CIDR notation: "${cidr}"` }, { status: 400 });
  }

  const ip = cidr.slice(0, slashIdx);
  const prefixStr = cidr.slice(slashIdx + 1);

  if (!/^\d+$/.test(prefixStr)) {
    return NextResponse.json({ error: `Invalid prefix length: "${prefixStr}"` }, { status: 400 });
  }

  const prefix = parseInt(prefixStr, 10);

  if (ip.includes(":")) {
    // IPv6
    if (!isValidIpv6(ip)) {
      return NextResponse.json({ error: `Invalid IPv6 address: "${ip}"` }, { status: 400 });
    }
    if (prefix < 0 || prefix > 128) {
      return NextResponse.json(
        { error: "IPv6 prefix length must be between 0 and 128." },
        { status: 400 }
      );
    }
    return NextResponse.json(calcIpv6(ip, prefix));
  } else {
    // IPv4
    if (!isValidIpv4(ip)) {
      return NextResponse.json({ error: `Invalid IPv4 address: "${ip}"` }, { status: 400 });
    }
    if (prefix < 0 || prefix > 32) {
      return NextResponse.json(
        { error: "IPv4 prefix length must be between 0 and 32." },
        { status: 400 }
      );
    }
    return NextResponse.json(calcIpv4(ip, prefix));
  }
}
