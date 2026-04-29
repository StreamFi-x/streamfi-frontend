import { NextRequest, NextResponse } from "next/server";

type MacFormat = "colon" | "dash" | "dot" | "none";

const OUI_LOOKUP: Record<string, string> = {
  "00000C": "Cisco Systems",
  "00005E": "IANA",
  "0000A2": "Bay Networks",
  "0001C0": "CompuLab",
  "0002B3": "Intel",
  "000347": "Intel",
  "000393": "Apple",
  "00044B": "NVIDIA",
  "000569": "VMware",
  "0007E9": "Intel",
  "000A27": "Apple",
  "000C29": "VMware",
  "000D3A": "Microsoft",
  "000E7F": "Hewlett Packard",
  "001122": "Cimsys",
  "001320": "Intel",
  "001451": "Apple",
  "00155D": "Microsoft",
  "00163E": "Xensource",
  "0016CB": "Apple",
  "0017F2": "Apple",
  "0019E3": "Apple",
  "001A11": "Google",
  "001B63": "Apple",
  "001C42": "Parallels",
  "001D25": "Samsung Electronics",
  "001E52": "Apple",
  "001F5B": "Apple",
  "0021E9": "Apple",
  "00224D": "Mitac International",
  "0023AE": "Dell",
  "0024E8": "Dell",
  "002500": "Apple",
  "002590": "Super Micro Computer",
  "0026BB": "Apple",
  "002713": "Cisco Systems",
  "00270E": "Intel",
  "002A10": "Cisco Systems",
  "005056": "VMware",
  "0050F2": "Microsoft",
  "0060DD": "Myricom",
  "00805F": "Hewlett Packard",
  "0080C8": "D-Link",
  "00A0C9": "Intel",
  "00B0D0": "Dell",
  "00C04F": "Dell",
  "00D0B7": "Intel",
  "00E04C": "Realtek Semiconductor",
  "00F81C": "Apple",
  "04D3B0": "Apple",
  "080020": "Oracle",
  "0C5415": "Intel",
  "1002B5": "Intel",
  "18AF61": "Apple",
  "1C1B0D": "Giga-byte Technology",
  "28CFDA": "Apple",
  "3C5A37": "Samsung Electronics",
  "44D884": "Apple",
  "5C514F": "Intel",
  "60F81D": "Apple",
  "6C4008": "Apple",
  "7C0507": "Apple",
  "8C8590": "Apple",
  A4C361: "Apple",
  B827EB: "Raspberry Pi Foundation",
  BC305B: "Dell",
  D850E6: "ASUSTek Computer",
  F0D5BF: "Intel",
};

function parseMac(mac: unknown): string | null {
  if (typeof mac !== "string") {
    return null;
  }

  const trimmed = mac.trim();
  const compact = trimmed.replace(/[:-]/g, "").replace(/\./g, "");

  const valid =
    /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(trimmed) ||
    /^([0-9a-fA-F]{2}-){5}[0-9a-fA-F]{2}$/.test(trimmed) ||
    /^[0-9a-fA-F]{4}(\.[0-9a-fA-F]{4}){2}$/.test(trimmed) ||
    /^[0-9a-fA-F]{12}$/.test(trimmed);

  if (!valid || compact.length !== 12) {
    return null;
  }

  return compact.toUpperCase();
}

function formatMac(compact: string, format: MacFormat) {
  const pairs = compact.match(/.{2}/g) ?? [];

  if (format === "dash") {
    return pairs.join("-");
  }
  if (format === "dot") {
    return compact.match(/.{4}/g)?.join(".") ?? compact;
  }
  if (format === "none") {
    return compact;
  }
  return pairs.join(":");
}

export async function POST(req: NextRequest) {
  let body: { mac?: unknown; format?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const format = (body.format ?? "colon") as MacFormat;
  if (!["colon", "dash", "dot", "none"].includes(format)) {
    return NextResponse.json(
      { error: "format must be colon, dash, dot, or none" },
      { status: 400 }
    );
  }

  const compact = parseMac(body.mac);
  if (!compact) {
    return NextResponse.json(
      { error: "Malformed MAC address" },
      { status: 400 }
    );
  }

  const firstOctet = Number.parseInt(compact.slice(0, 2), 16);
  const isMulticast = (firstOctet & 1) === 1;
  const isLocallyAdministered = (firstOctet & 2) === 2;
  const oui = OUI_LOOKUP[compact.slice(0, 6)];

  return NextResponse.json({
    valid: true,
    normalized: formatMac(compact, format),
    is_unicast: !isMulticast,
    is_multicast: isMulticast,
    is_locally_administered: isLocallyAdministered,
    ...(oui ? { oui } : {}),
  });
}
