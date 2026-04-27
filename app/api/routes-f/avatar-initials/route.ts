import { NextRequest, NextResponse } from "next/server";
import { buildAvatar, clampSize } from "./_lib/avatar";

// GET /api/routes-f/avatar-initials?name=John%20Doe&size=128
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const name = searchParams.get("name") ?? "";

  if (!name.trim()) {
    return NextResponse.json({ error: "'name' query param is required" }, { status: 400 });
  }

  const size = clampSize(searchParams.get("size"));
  const svg = buildAvatar({ name, size });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
