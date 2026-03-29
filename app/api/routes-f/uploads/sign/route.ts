/**
 * POST /api/routes-f/uploads/sign — generate a pre-signed PUT URL for direct uploads
 *
 * Supported types: avatar | banner | thumbnail
 *
 * Security:
 *   - Session cookie required (privy or wallet)
 *   - Rate limited: 5 requests/min per IP (general) + 10 uploads/user/hour (user-level)
 *   - content_type validated against an explicit allowlist server-side
 *   - Storage path namespaced by user ID: {type}s/{userId}/{uuid}.{ext}
 *   - Pre-signed URL expires in 5 minutes (300 s)
 *
 * Size limits are enforced at the R2 bucket policy level; the max sizes below
 * are documented for client guidance only — PUT presigned URLs cannot embed a
 * Content-Length-Range condition (that requires presigned POST).
 *
 * Env vars required:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, CDN_BASE_URL
 */

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifySession } from "@/lib/auth/verify-session";

// 5 requests per minute per IP
const isIpRateLimited = createRateLimiter(60_000, 5);
// 10 uploads per hour per user
const isUserRateLimited = createRateLimiter(3_600_000, 10);

// ── Constants ──────────────────────────────────────────────────────────────────

const UPLOAD_TTL_SECONDS = 300; // 5 minutes

type UploadType = "avatar" | "banner" | "thumbnail";
type AllowedContentType = "image/jpeg" | "image/png" | "image/webp";

const ALLOWED_CONTENT_TYPES: AllowedContentType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const CONTENT_TYPE_TO_EXT: Record<AllowedContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Documented limits — enforced at the bucket level, not in this route.
export const MAX_SIZE_BYTES: Record<UploadType, number> = {
  avatar: 5 * 1024 * 1024,
  banner: 10 * 1024 * 1024,
  thumbnail: 10 * 1024 * 1024,
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface SignRequest {
  type: UploadType;
  filename: string;
  content_type: AllowedContentType;
}

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  cdnBaseUrl: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const cdnBaseUrl = process.env.CDN_BASE_URL;

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucketName ||
    !cdnBaseUrl
  ) {
    throw new Error("R2 storage is not configured");
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, cdnBaseUrl };
}

export function createS3Client(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

// ── POST /api/routes-f/uploads/sign ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. IP-level rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isIpRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 2. Session auth
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  // 3. User-level rate limit: 10 uploads per hour
  if (await isUserRateLimited(session.userId)) {
    return NextResponse.json(
      { error: "Upload limit reached. You may upload 10 files per hour." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  // 4. Parse and validate body
  let body: SignRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, filename, content_type } = body;

  if (!["avatar", "banner", "thumbnail"].includes(type)) {
    return NextResponse.json(
      { error: "type must be one of: avatar, banner, thumbnail" },
      { status: 400 }
    );
  }

  if (typeof filename !== "string" || !filename.trim()) {
    return NextResponse.json(
      { error: "filename must be a non-empty string" },
      { status: 400 }
    );
  }

  if (!ALLOWED_CONTENT_TYPES.includes(content_type)) {
    return NextResponse.json(
      {
        error: `content_type must be one of: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // 5. Resolve R2 config
  let r2Config: R2Config;
  try {
    r2Config = getR2Config();
  } catch (err) {
    console.error("[uploads/sign] R2 config error:", err);
    return NextResponse.json(
      { error: "Storage is not configured" },
      { status: 500 }
    );
  }

  // 6. Generate pre-signed URL
  const uuid = crypto.randomUUID();
  const ext = CONTENT_TYPE_TO_EXT[content_type];
  // Path namespaced by userId — prevents overwriting other users' files.
  const objectKey = `${type}s/${session.userId}/${uuid}.${ext}`;

  try {
    const client = createS3Client(r2Config);
    const command = new PutObjectCommand({
      Bucket: r2Config.bucketName,
      Key: objectKey,
      ContentType: content_type,
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: UPLOAD_TTL_SECONDS,
    });

    const publicUrl = `${r2Config.cdnBaseUrl}/${objectKey}`;

    return NextResponse.json({
      upload_url: uploadUrl,
      public_url: publicUrl,
      expires_in: UPLOAD_TTL_SECONDS,
    });
  } catch (err) {
    console.error("[uploads/sign] Failed to generate pre-signed URL:", err);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
