import { NextResponse } from "next/server";
import { withRoutesFLogging } from "@/lib/routes-f/logging";

const ALLOWED_FILE_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "image/jpeg",
  "image/png",
]);
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 900;

interface UploadSignBody {
  fileName?: unknown;
  fileType?: unknown;
  fileSize?: unknown;
}

function validateUploadBody(body: UploadSignBody): string | null {
  if (typeof body.fileName !== "string" || body.fileName.trim().length === 0) {
    return "fileName is required";
  }

  if (typeof body.fileType !== "string" || !ALLOWED_FILE_TYPES.has(body.fileType)) {
    return "Unsupported fileType";
  }

  if (!Number.isFinite(body.fileSize) || (body.fileSize as number) <= 0) {
    return "fileSize must be a positive number";
  }

  if ((body.fileSize as number) > MAX_FILE_SIZE_BYTES) {
    return `fileSize exceeds max allowed size of ${MAX_FILE_SIZE_BYTES} bytes`;
  }

  return null;
}

export async function POST(req: Request) {
  return withRoutesFLogging(req, async request => {
    let body: UploadSignBody;

    try {
      body = (await request.json()) as UploadSignBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const validationError = validateUploadBody(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const now = Date.now();
    const expiresAt = new Date(now + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    const encodedName = encodeURIComponent(String(body.fileName));

    return NextResponse.json(
      {
        url: `https://uploads.streamfi.local/mock/${encodedName}?token=stub-signature`,
        method: "PUT",
        expiresAt,
      },
      { status: 200 }
    );
  });
}
