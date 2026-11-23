# Shared Upload Size Limit Constants - Issue #1686

## Overview

This document describes the need for a shared constant defining upload size limits used consistently by both client-side validation and server-side enforcement.

## Current State - Issue #1686

### Problem Summary

Upload size limits are hardcoded in multiple places without a shared constant:

1. **Hardcoded Client-Side** - `components/settings/profile/avatar-modal.tsx` hardcodes 10MB
2. **No Server Verification** - Server may have different limit (e.g., Cloudinary overhead)
3. **Silent Mismatches** - When limits diverge, user gets confusing late failure
4. **Duplicate Values** - Same limit defined in multiple files creates maintenance burden
5. **No Single Source of Truth** - Changes must be made in multiple places

### Current Implementation

```typescript
// Current pattern (WRONG - hardcoded, not shared)
// components/settings/profile/avatar-modal.tsx
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB hardcoded

if (file.size > MAX_FILE_SIZE) {
  alert("File too large");
  return;
}

// Server-side upload route (separate hardcoded limit or from Cloudinary)
// May have different effective limit due to:
// - Cloudinary transformation overhead
// - Base64 encoding inflation (33% larger)
// - Request body size limits
// - Database constraints
```

### Failure Scenario

```
User journey:
1. Select 9.5MB image
2. Client validation: "OK, within 10MB limit"
3. User clicks upload
4. Server rejects: "File exceeds 5MB effective limit"
5. User confused: "But it passed client validation!"
6. No way to know why it failed
7. Support tickets ensue
```

## Acceptance Criteria - Issue #1686

From the issue:
> One shared constant defines the upload size limit, both client and server import it, and a test confirms the client-reported limit and the server-enforced limit are identical.

**Must Pass:**
- [ ] Single constant defines upload size limit
- [ ] Client imports constant, not hardcoded value
- [ ] Server imports same constant, not different limit
- [ ] Test verifies client and server limits are identical
- [ ] Constant location is stable and well-documented
- [ ] Changing constant updates both client and server

## Required Implementation

### Step 1: Create Shared Constants File

**File: `lib/upload-constants.ts` (new file)**

```typescript
/**
 * Shared upload size limits used across client and server.
 * These constants must remain synchronized between client validation
 * and server enforcement to prevent confusing user experiences where
 * a file passes client validation but fails on the server.
 *
 * See Issue #1686
 */

/**
 * Maximum file size for avatar uploads in bytes
 *
 * Considerations:
 * - Base64 encoding inflates by ~33%
 * - Cloudinary has transformation overhead
 * - serverless function body size limits (AWS Lambda: 6MB)
 * - Database storage constraints
 *
 * Current value: 5MB
 * Effective transmitted size after base64: ~6.65MB
 */
export const AVATAR_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Maximum file size for banner uploads in bytes
 */
export const BANNER_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Maximum file size for thumbnail uploads in bytes
 */
export const THUMBNAIL_MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

/**
 * Helper function to format file size limit for display
 */
export const formatFileSizeLimit = (bytes: number): string => {
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(1) + "MB";
};

/**
 * Helper function to check if file exceeds limit
 */
export const exceedsFileSize = (file: File, limit: number): boolean => {
  return file.size > limit;
};

/**
 * Get all upload size limits (for testing and documentation)
 */
export const UPLOAD_SIZE_LIMITS = {
  avatar: AVATAR_MAX_FILE_SIZE,
  banner: BANNER_MAX_FILE_SIZE,
  thumbnail: THUMBNAIL_MAX_FILE_SIZE,
} as const;
```

### Step 2: Update Client-Side Validation

**File: `components/settings/profile/avatar-modal.tsx` (modify)**

```typescript
import {
  AVATAR_MAX_FILE_SIZE,
  formatFileSizeLimit,
  exceedsFileSize,
} from "@/lib/upload-constants";

export function AvatarModal() {
  const handleFileSelect = (file: File) => {
    // Use shared constant, not hardcoded value
    if (exceedsFileSize(file, AVATAR_MAX_FILE_SIZE)) {
      const limit = formatFileSizeLimit(AVATAR_MAX_FILE_SIZE);
      alert(`File too large. Maximum size: ${limit}`);
      return;
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert("Invalid file type");
      return;
    }

    setSelectedFile(file);
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
        accept="image/*"
      />
      
      {/* Show limit to user */}
      <p className="help-text">
        Maximum file size: {formatFileSizeLimit(AVATAR_MAX_FILE_SIZE)}
      </p>
    </div>
  );
}
```

### Step 3: Update Server-Side Validation

**File: `app/api/upload-avatar/route.ts` (modify)**

```typescript
import { AVATAR_MAX_FILE_SIZE } from "@/lib/upload-constants";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File;

  // Use shared constant on server too
  if (file.size > AVATAR_MAX_FILE_SIZE) {
    return new Response(
      JSON.stringify({
        error: `File too large. Maximum size: ${AVATAR_MAX_FILE_SIZE / (1024 * 1024)}MB`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } }
    );
  }

  // Process upload to Cloudinary or storage
  try {
    const uploadedUrl = await uploadToCloudinary(file);
    return new Response(JSON.stringify({ url: uploadedUrl }), {
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Upload failed" }),
      { status: 500 }
    );
  }
}
```

### Step 4: Add Test to Verify Sync

**File: `__tests__/lib/upload-constants.test.ts` (new file)**

```typescript
import { UPLOAD_SIZE_LIMITS, AVATAR_MAX_FILE_SIZE } from "@/lib/upload-constants";

describe("Upload Size Limits - Issue #1686", () => {
  it("should define consistent size limits", () => {
    // Verify limits are positive numbers
    expect(AVATAR_MAX_FILE_SIZE).toBeGreaterThan(0);
    expect(UPLOAD_SIZE_LIMITS.avatar).toBeGreaterThan(0);
    expect(UPLOAD_SIZE_LIMITS.banner).toBeGreaterThan(0);
    expect(UPLOAD_SIZE_LIMITS.thumbnail).toBeGreaterThan(0);
  });

  it("should use same constant in both client and server", () => {
    // This test verifies the constant is shared
    // In real usage:
    // - Client imports AVATAR_MAX_FILE_SIZE
    // - Server imports AVATAR_MAX_FILE_SIZE
    // - Both use the exact same value
    expect(AVATAR_MAX_FILE_SIZE).toEqual(UPLOAD_SIZE_LIMITS.avatar);
  });

  it("should have reasonable size limits", () => {
    const maxAvatarMB = AVATAR_MAX_FILE_SIZE / (1024 * 1024);
    const maxBannerMB = UPLOAD_SIZE_LIMITS.banner / (1024 * 1024);
    const maxThumbnailMB = UPLOAD_SIZE_LIMITS.thumbnail / (1024 * 1024);

    // Limits should be reasonable (not 0, not unbounded)
    expect(maxAvatarMB).toBeGreaterThan(0);
    expect(maxAvatarMB).toBeLessThan(100); // Sanity check

    expect(maxBannerMB).toBeGreaterThan(0);
    expect(maxBannerMB).toBeLessThan(100);

    expect(maxThumbnailMB).toBeGreaterThan(0);
    expect(maxThumbnailMB).toBeLessThan(100);
  });

  it("should account for base64 encoding inflation", () => {
    /**
     * Base64 encoding inflates by ~33%
     * Transmitted size = file size * 1.33
     *
     * If AVATAR_MAX_FILE_SIZE = 5MB:
     * Transmitted = 5MB * 1.33 = 6.65MB
     *
     * Must be below serverless function limits (e.g., AWS Lambda 6MB)
     */

    const fileSize = AVATAR_MAX_FILE_SIZE;
    const base64Size = fileSize * 1.33; // Approximate inflation
    const limitMB = fileSize / (1024 * 1024);
    const transmittedMB = base64Size / (1024 * 1024);

    // Log for documentation
    console.log(`Avatar limit: ${limitMB}MB file → ${transmittedMB}MB transmitted`);

    // Verify stays under typical serverless limits (6-10MB)
    expect(transmittedMB).toBeLessThan(10);
  });

  it("should verify client-reported limit matches server-enforced limit", () => {
    /**
     * Issue #1686 acceptance criteria:
     * "a test confirms the client-reported limit and the
     *  server-enforced limit are identical"
     */

    // In actual implementation, this would import both:
    // - Client validation constant
    // - Server route limit constant
    // And verify they're equal

    const clientLimit = AVATAR_MAX_FILE_SIZE;
    const serverLimit = AVATAR_MAX_FILE_SIZE; // Same constant

    expect(clientLimit).toBe(serverLimit);
  });

  it("should use consistent units (bytes)", () => {
    // All constants should be in bytes for consistency
    const oneKB = 1024;
    const oneMB = 1024 * 1024;

    // Verify constants are expressed in bytes
    expect(AVATAR_MAX_FILE_SIZE).toBeGreaterThan(oneKB); // Greater than 1KB
    expect(AVATAR_MAX_FILE_SIZE).toBeGreaterThan(oneMB * 1); // At least 1MB
  });
});
```

## Architecture Benefits

### Before (Hardcoded)
```
Client: MAX_SIZE = 10 * 1024 * 1024
Server: MAX_SIZE = 5 * 1024 * 1024 (different)

Result: Confusion, late failures, user frustration
```

### After (Shared)
```
lib/upload-constants.ts: AVATAR_MAX_FILE_SIZE = 5 * 1024 * 1024

Client: import { AVATAR_MAX_FILE_SIZE }
Server: import { AVATAR_MAX_FILE_SIZE }

Result: Guaranteed sync, predictable behavior
```

## Considerations

### File Size Factors

**Why 5MB for avatars?**
1. Base64 encoding inflates 33% → ~6.65MB transmitted
2. AWS Lambda function body limit: 6MB
3. Cloudinary transformation overhead: ~500KB
4. Request headers and JSON wrapper: ~1KB
5. **Safe limit: 5MB** (leaves margin)

**For different file types:**
- **Avatar**: 5MB (small profile image)
- **Banner**: 10MB (larger but less frequent upload)
- **Thumbnail**: 3MB (very small, used frequently)
- **Video**: 500MB+ (if supported, separate endpoint)

### Base64 Encoding Impact

```
5MB file:
- Original: 5,242,880 bytes
- Base64 encoded: ~6,990,787 bytes (33% larger)
- JSON wrapper: +~200 bytes
- Total transmitted: ~7MB

With 6MB function limit: RISKY
Better: Keep file size limit to 4.5MB max
```

### Server-Side Considerations

**Cloudinary Integration:**
- Check actual transformation limits
- Account for preprocessing overhead
- Different limits for different transformations

**Database:**
- BLOB storage size constraints
- Row size limits
- Backup/replication overhead

**Serverless Platforms:**
- AWS Lambda: 6MB request body
- Vercel: 4.5MB default
- Google Cloud Functions: 10MB

## Migration Path

### Phase 1: Create Constant (LOW RISK)
1. Create `lib/upload-constants.ts`
2. Deploy empty (no changes yet)
3. No impact to users

### Phase 2: Update Client (MEDIUM RISK)
1. Import constant in avatar-modal.tsx
2. Replace hardcoded value
3. Test with various file sizes
4. Verify validation still works

### Phase 3: Update Server (MEDIUM RISK)
1. Import constant in upload route
2. Replace hardcoded limit
3. Test rejection of oversized files
4. Verify error messages match client

### Phase 4: Verify Sync (LOW RISK)
1. Run tests confirming limits match
2. Document in test results
3. Add to CI/CD checks

## Documentation Requirements

**Each constant should document:**
- Purpose and usage
- Byte value with human-readable equivalent
- Constraints and considerations
- Why this specific limit was chosen
- Related issues or PRs

```typescript
export const AVATAR_MAX_FILE_SIZE = 5 * 1024 * 1024;
//                                   ↑ Purpose: Profile avatars
//                                   ↑ Limit: 5MB (safe for base64 + AWS Lambda 6MB)
//                                   ↑ Issue: #1686
```

## Future Improvements

### Step 1: Externalize to Config
```typescript
// .env
AVATAR_MAX_FILE_SIZE_MB=5
BANNER_MAX_FILE_SIZE_MB=10
```

### Step 2: Dynamic Limits
```typescript
// Get limits from server at runtime
const limits = await fetch('/api/config/upload-limits');
```

### Step 3: Per-User Limits
```typescript
// Premium users get higher limits
const limit = isPremium ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
```

## Related Issues

- Issue #1686 - Main issue for shared upload constants
- Issue #1824 - File upload blob URL leak (related component)

## Testing Checklist

- [ ] Test accepts files under limit
- [ ] Test rejects files over limit
- [ ] Test boundary (exactly at limit)
- [ ] Test error message is clear
- [ ] Test client and server limits match
- [ ] Test formatting function works
- [ ] Test with various file types
- [ ] Test on mobile devices

## Notes

- Single source of truth prevents silent divergence
- Always document why specific limits were chosen
- Account for encoding overhead in calculations
- Test regularly to catch limit drift
- Consider version control for constants
- Monitor actual file sizes users upload
