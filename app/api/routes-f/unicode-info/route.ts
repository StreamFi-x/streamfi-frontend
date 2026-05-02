import { NextRequest, NextResponse } from "next/server";
import { UNICODE_DATA } from "./_lib/unicode-data";

function parseCodePoint(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const notation = trimmed.toUpperCase();
  if (notation.startsWith("U+")) {
    const hex = notation.slice(2);
    if (!/^[0-9A-F]{1,6}$/.test(hex)) return null;
    return parseInt(hex, 16);
  }
  if (/^0X[0-9A-F]+$/i.test(trimmed)) {
    return parseInt(trimmed, 16);
  }
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  return null;
}

function toUtf8Bytes(char: string): number[] {
  return Array.from(new TextEncoder().encode(char));
}

function toUtf16Units(char: string): number[] {
  const units: number[] = [];
  for (let i = 0; i < char.length; i++) {
    units.push(char.charCodeAt(i));
  }
  return units;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const charParam = searchParams.get("char");
  const codepointParam = searchParams.get("codepoint");

  let codePoint: number | null = null;
  let char = "";

  if (charParam && charParam.length > 0) {
    char = Array.from(charParam)[0];
    codePoint = char.codePointAt(0) ?? null;
  } else if (codepointParam) {
    codePoint = parseCodePoint(codepointParam);
    if (codePoint !== null) {
      char = String.fromCodePoint(codePoint);
    }
  }

  if (
    codePoint === null ||
    !Number.isInteger(codePoint) ||
    codePoint < 0 ||
    codePoint > 0x10ffff
  ) {
    return NextResponse.json(
      { error: "Provide ?char=… or ?codepoint=U+XXXX / decimal value" },
      { status: 400 },
    );
  }

  const row = UNICODE_DATA.get(codePoint);
  const hex = codePoint.toString(16).toUpperCase().padStart(4, "0");
  return NextResponse.json({
    char,
    codepoint: `U+${hex}`,
    name: row?.name ?? `U+${hex}`,
    category: row?.category ?? "Unknown",
    block: row?.block ?? "Unknown",
    script: row?.script ?? "Unknown",
    utf8_bytes: toUtf8Bytes(char),
    utf16_units: toUtf16Units(char),
    html_entity: `&#x${hex};`,
  });
}
