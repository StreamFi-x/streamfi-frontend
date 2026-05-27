import { type NextRequest, NextResponse } from "next/server";
import { SIGNATURES } from "./signatures";

type MimeBody = {
  hex?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: MimeBody;

  try {
    body = (await req.json()) as MimeBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const { hex } = body;

  if (typeof hex !== "string" || hex.length === 0) {
    return badRequest("hex must be a non-empty hex string.");
  }

  const cleanHex = hex.replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]*$/.test(cleanHex) || cleanHex.length % 2 !== 0) {
    return badRequest("hex must contain an even number of valid hex characters.");
  }

  const bytes: number[] = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes.push(parseInt(cleanHex.substring(i, i + 2), 16));
  }

  for (const sig of SIGNATURES) {
    if (bytes.length >= sig.bytes.length) {
      let match = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (bytes[i] !== sig.bytes[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        return NextResponse.json({
          mime: sig.mime,
          extension: sig.extension,
          matched: sig.bytes.map((b) => b.toString(16).padStart(2, "0")).join(""),
        });
      }
    }
  }

  return NextResponse.json({ mime: null, extension: null, matched: null });
}
