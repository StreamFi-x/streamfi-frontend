import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import {
  uploadImageFromBuffer,
  deleteImage,
  extractPublicIdFromUrl,
} from "@/utils/upload/cloudinary";
import { JsonbContractError } from "@/lib/db/jsonb-contracts";
import { parseProfileJsonbFields } from "@/lib/users/profile-form";
import { validateUserUpdate } from "../../../../../../utils/userValidators";
import { UserUpdateInput } from "../../../../../../types/user";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import { verifySession } from "@/lib/auth/verify-session";
import { shouldBypassAuth } from "@/lib/dev-mode";

function stripControlCharacters(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "");
}

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return url.startsWith("/") && !url.startsWith("//");
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ privyId: string }> }
) {
  try {
    const { privyId } = await params;

    // Strict authentication and ownership authorization guard (#1857):
    // Never allow an unauthenticated caller or a different user to mutate
    // another user's profile by guessing or supplying their privy_id.
    if (!shouldBypassAuth()) {
      const session = await verifySession(req);
      if (!session.ok) {
        return session.response;
      }

      // Allow if caller is the resource owner matching privyId
      const isOwner = session.privyId === privyId;
      if (!isOwner) {
        // Allow if caller has admin or moderator privileges
        const roleResult = await sql`
          SELECT role FROM users WHERE id = ${session.userId} AND deleted_at IS NULL LIMIT 1
        `;
        const role = roleResult.rows[0]?.role;
        if (role !== "super_admin" && role !== "moderator") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    // Fetch current user record by privy_id
    const existingResult = await sql`
      SELECT id, username, email, bio, streamkey, avatar, banner, sociallinks,
             emailverified, emailnotifications, creator, enable_recording,
             privy_id
      FROM users WHERE privy_id = ${privyId} AND deleted_at IS NULL
    `;
    const user = existingResult.rows[0];
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let username: string = user.username;
    let bio: string = user.bio;
    let streamkey: string = user.streamkey;
    let emailVerified = user.emailverified;
    let emailNotifications = user.emailnotifications;
    let avatarUrlField: string | undefined;
    let avatarFile: Blob | null = null;
    let bannerFile: Blob | null = null;
    let jsonbFields: ReturnType<typeof parseProfileJsonbFields> = {
      socialLinks: null,
      creator: null,
    };

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.username !== undefined) username = String(body.username);
      if (body.bio !== undefined) bio = String(body.bio);
      if (body.streamkey !== undefined) streamkey = String(body.streamkey);
      if (body.emailVerified !== undefined) emailVerified = body.emailVerified;
      if (body.emailNotifications !== undefined)
        emailNotifications = body.emailNotifications;
      if (typeof body.avatarUrl === "string") avatarUrlField = body.avatarUrl;
      else if (typeof body.avatar === "string") avatarUrlField = body.avatar;

      if (body.socialLinks || body.sociallinks) {
        jsonbFields = {
          socialLinks: body.socialLinks || body.sociallinks,
          creator: body.creator ?? null,
        };
      }
    } else {
      const formData = await req.formData();

      if (formData.has("username"))
        username = (formData.get("username") as string) ?? user.username;
      if (formData.has("bio"))
        bio = (formData.get("bio") as string) ?? user.bio;
      if (formData.has("streamkey"))
        streamkey = (formData.get("streamkey") as string) ?? user.streamkey;
      if (formData.has("emailVerified"))
        emailVerified = formData.get("emailVerified") ?? user.emailverified;
      if (formData.has("emailNotifications"))
        emailNotifications =
          formData.get("emailNotifications") ?? user.emailnotifications;
      if (formData.has("avatarUrl"))
        avatarUrlField = formData.get("avatarUrl") as string;

      const rawAvatar = formData.get("avatar");
      if (rawAvatar instanceof Blob) {
        avatarFile = rawAvatar;
      } else if (typeof rawAvatar === "string" && rawAvatar.trim()) {
        avatarUrlField = rawAvatar.trim();
      }

      const rawBanner = formData.get("banner");
      if (rawBanner instanceof Blob) {
        bannerFile = rawBanner;
      }

      try {
        jsonbFields = parseProfileJsonbFields(formData);
      } catch (err) {
        if (err instanceof JsonbContractError) {
          return NextResponse.json(
            { error: `Invalid ${err.column} format`, issues: err.issues },
            { status: 400 }
          );
        }
        throw err;
      }
    }

    // Sanitize bio: strip control characters, enforce max length
    if (bio !== undefined && bio !== null) {
      bio = stripControlCharacters(String(bio)).trim();
      if (bio.length > 500) {
        return NextResponse.json(
          { error: "bio must be 500 characters or fewer" },
          { status: 400 }
        );
      }
    }

    // Validate
    const updateData: UserUpdateInput = {
      username,
      bio,
      streamkey,
      avatar: user.avatar,
      emailVerified: emailVerified as boolean | undefined,
      emailNotifications: emailNotifications as boolean | undefined,
      socialLinks: jsonbFields.socialLinks,
    };

    const validation = validateUserUpdate(updateData);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Username uniqueness — exclude current user.
    // Must explicitly handle NULL privy_id (wallet users) since NULL != x
    // evaluates to NULL in SQL, not TRUE, so they'd be silently excluded.
    if (username && username !== user.username) {
      const usernameExists = await sql`
        -- tombstone-aware: identifiers stay reserved until the account is purged
        SELECT id FROM users
        WHERE username = ${username}
          AND (privy_id IS NULL OR privy_id != ${privyId})
      `;
      if (usernameExists.rows.length > 0) {
        return NextResponse.json(
          { error: "Username already in use" },
          { status: 400 }
        );
      }
    }

    // Handle avatar — file upload (→ Cloudinary) or preset icon URL string
    let avatarUrl = user.avatar;
    if (avatarFile instanceof Blob) {
      if (avatarFile.type && !avatarFile.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Invalid avatar file type" },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await avatarFile.arrayBuffer());
      const uploadResult = await uploadImageFromBuffer(buffer);
      avatarUrl = uploadResult.secure_url;

      if (user.avatar) {
        const oldPublicId = extractPublicIdFromUrl(user.avatar);
        if (oldPublicId) {
          await deleteImage(oldPublicId);
        }
      }
    } else if (typeof avatarUrlField === "string" && avatarUrlField.trim()) {
      const trimmedUrl = avatarUrlField.trim();
      if (!isValidImageUrl(trimmedUrl)) {
        return NextResponse.json(
          { error: "Invalid avatar URL format" },
          { status: 400 }
        );
      }
      avatarUrl = trimmedUrl;
      // Clean up old Cloudinary photo if switching to a preset icon
      if (user.avatar) {
        const oldPublicId = extractPublicIdFromUrl(user.avatar);
        if (oldPublicId) {
          await deleteImage(oldPublicId);
        }
      }
    }

    // Handle banner — file upload (→ Cloudinary)
    let bannerUrl = user.banner;
    if (bannerFile instanceof Blob) {
      if (bannerFile.type && !bannerFile.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Invalid banner file type" },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await bannerFile.arrayBuffer());
      const uploadResult = await uploadImageFromBuffer(buffer);
      bannerUrl = uploadResult.secure_url;

      if (user.banner) {
        const oldPublicId = extractPublicIdFromUrl(user.banner);
        if (oldPublicId) {
          await deleteImage(oldPublicId);
        }
      }
    }

    const updatedUser = await sql`
      UPDATE users SET
        username = ${username},
        avatar = ${avatarUrl},
        banner = ${bannerUrl},
        bio = ${bio},
        streamkey = ${streamkey},
        sociallinks = COALESCE(${jsonbFields.socialLinks ? JSON.stringify(jsonbFields.socialLinks) : null}::jsonb, sociallinks),
        emailverified = ${emailVerified},
        emailnotifications = ${emailNotifications},
        creator = COALESCE(${jsonbFields.creator ? JSON.stringify(jsonbFields.creator) : null}::jsonb, creator),
        updated_at = CURRENT_TIMESTAMP
      WHERE privy_id = ${privyId} AND deleted_at IS NULL
      RETURNING id, username, email, streamkey, avatar, banner, bio, sociallinks,
                emailverified, emailnotifications, creator, privy_id,
                created_at, updated_at
    `;
    await invalidateUserCaches({
      id: user.id,
      username,
      previousUsername: user.username,
    });

    return NextResponse.json({
      message: "User updated successfully",
      user: updatedUser.rows[0],
    });
  } catch (err) {
    console.error("Privy update error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
