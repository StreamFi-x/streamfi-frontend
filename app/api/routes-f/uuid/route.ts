import { NextRequest, NextResponse } from "next/server";
import { uuidV4, uuidV7 } from "./_lib/generators";

const MAX_COUNT = 100;
const VALID_VERSIONS = ["v4", "v7"] as const;
type UuidVersion = (typeof VALID_VERSIONS)[number];

// GET /api/routes-f/uuid?version=v4&count=1
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const version = (searchParams.get("version") ?? "v4") as UuidVersion;
  if (!VALID_VERSIONS.includes(version)) {
    return NextResponse.json(
      { error: `Invalid version '${version}'. Must be one of: ${VALID_VERSIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const rawCount = searchParams.get("count") ?? "1";
  const count = parseInt(rawCount, 10);
  if (isNaN(count) || count < 1) {
    return NextResponse.json({ error: "'count' must be a positive integer" }, { status: 400 });
  }
  if (count > MAX_COUNT) {
    return NextResponse.json(
      { error: `'count' exceeds maximum of ${MAX_COUNT}` },
      { status: 400 },
    );
  }

  const generate = version === "v7" ? uuidV7 : uuidV4;
  const uuids = Array.from({ length: count }, generate);

  return NextResponse.json({ version, count, uuids });
}
