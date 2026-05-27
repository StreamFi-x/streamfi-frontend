import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  uuid: z.string()
});

interface UuidValidationResult {
  valid: boolean;
  version?: number;
  variant?: string;
  normalized?: string;
}

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Nil UUID (all zeros)
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

function validateUuid(uuid: string): UuidValidationResult {
  // Normalize the UUID (lowercase, add hyphens if missing)
  let normalized = uuid.toLowerCase().replace(/[^0-9a-f]/g, "");
  
  // Add hyphens if they're missing
  if (normalized.length === 32) {
    normalized = `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20, 32)}`;
  } else {
    normalized = uuid.toLowerCase();
  }
  
  // Check if it matches UUID format
  if (!UUID_REGEX.test(normalized)) {
    return { valid: false };
  }
  
  // Handle nil UUID
  if (normalized === NIL_UUID) {
    return {
      valid: true,
      version: 0,
      variant: "nil",
      normalized
    };
  }
  
  // Extract version from the 13th character (first character of the third group)
  const versionChar = normalized[14]; // 0-indexed, so 14th character
  const version = parseInt(versionChar, 16);
  
  // Extract variant from the 17th character (first character of the fourth group)
  const variantChar = normalized[19]; // 0-indexed, so 19th character
  const variantBits = parseInt(variantChar, 16);
  
  let variant: string;
  if ((variantBits & 0x8) === 0) {
    variant = "ncs"; // Network Computing System (reserved)
  } else if ((variantBits & 0xC) === 0x8) {
    variant = "rfc4122"; // RFC 4122 standard
  } else if ((variantBits & 0xE) === 0xC) {
    variant = "microsoft"; // Microsoft reserved
  } else {
    variant = "future"; // Reserved for future use
  }
  
  // Validate version numbers (1, 3, 4, 5, 7 are commonly supported)
  const supportedVersions = [1, 3, 4, 5, 7];
  if (!supportedVersions.includes(version)) {
    return {
      valid: false,
      version,
      variant,
      normalized
    };
  }
  
  return {
    valid: true,
    version,
    variant,
    normalized
  };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  
  const validation = bodySchema.safeParse(body);
  
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: validation.error.flatten() },
      { status: 400 }
    );
  }
  
  const { uuid } = validation.data;
  
  const result = validateUuid(uuid);
  
  if (!result.valid) {
    return NextResponse.json(
      { error: "Invalid UUID format or unsupported version", ...result },
      { status: 400 }
    );
  }
  
  return NextResponse.json(result);
}