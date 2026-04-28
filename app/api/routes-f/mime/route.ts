import { NextRequest, NextResponse } from "next/server";
import {
  lookupByExtension,
  lookupByMime,
  suggestForUnknownExtension,
  suggestForUnknownMime,
} from "./_lib/lookup";

export async function GET(req: NextRequest) {
  const extension = req.nextUrl.searchParams.get("extension");
  const mime = req.nextUrl.searchParams.get("mime");

  if (!extension && !mime) {
    return NextResponse.json(
      { error: "Provide either ?extension=... or ?mime=..." },
      { status: 400 }
    );
  }

  if (extension) {
    const found = lookupByExtension(extension);
    if (!found) {
      return NextResponse.json(
        {
          error: `Unknown extension: ${extension}`,
          suggestions: suggestForUnknownExtension(extension),
        },
        { status: 404 }
      );
    }

    return NextResponse.json(found);
  }

  const found = lookupByMime(mime ?? "");
  if (!found) {
    return NextResponse.json(
      { error: `Unknown mime: ${mime}`, suggestions: suggestForUnknownMime(mime ?? "") },
      { status: 404 }
    );
  }

  return NextResponse.json(found);
}
