import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { uploadImageFromBuffer } from "@/utils/upload/cloudinary";
import { createImageCleanup } from "@/lib/users/image-cleanup";
import { JsonbContractError } from "@/lib/db/jsonb-contracts";
import { parseProfileJsonbFields } from "@/lib/users/profile-form";
import { validateUserUpdate } from "../../../../../../utils/userValidators";
import { UserUpdateInput } from "../../../../../../types/user";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import {
  checkUsernameChangeCooldown,
  checkUsernameReleaseHold,
  getUsernameCooldownDays,
  recordUsernameChange,
} from "@/lib/users/username-history";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ privyId: string }> }
) {
  try {
    const { privyId } = await params;

    // Fetch current user record by privy_id
    const existingResult = await sql`
      SELECT id, username, email, bio, streamkey, avatar, banner, sociallinks,
             emailverified, emailnotifications, creator, enable_recording,
             privy_id, username_changed_at
      FROM users WHERE privy_id = ${privyId} AND deleted_at IS NULL
    `;
    const user = existingResult.rows[0];
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const formData = await req.formData();

    const username = (formData.get("username") as string) ?? user.username;
    const bio = (formData.get("bio") as string) ?? user.bio;
    const streamkey = (formData.get("streamkey") as string) ?? user.streamkey;
    const emailVerified = formData.get("emailVerified") ?? user.emailverified;
    const emailNotifications =
      formData.get("emailNotifications") ?? user.emailnotifications;

    let jsonbFields: ReturnType<typeof parseProfileJsonbFields>;
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

    const isUsernameChanged = Boolean(
      username &&
      user.username &&
      username.toLowerCase() !== String(user.username).toLowerCase()
    );

    // Username cooldown, uniqueness, and recent-release hold (#1730, #1734)
    // Must explicitly handle NULL privy_id (wallet users) since NULL != x
    // evaluates to NULL in SQL, not TRUE, so they'd be silently excluded.
    if (username && username !== user.username) {
      if (isUsernameChanged) {
        const cooldown = await checkUsernameChangeCooldown({
          userId: user.id,
          lastChangedAt: user.username_changed_at,
        });
        if (!cooldown.allowed) {
          return NextResponse.json(
            {
              error: `Username can only be changed once every ${getUsernameCooldownDays()} days`,
              code: "USERNAME_CHANGE_COOLDOWN",
              nextAllowedAt: cooldown.nextAllowedAt,
              retryAfterSeconds: cooldown.retryAfterSeconds,
            },
            {
              status: 429,
              headers: {
                "Retry-After": String(cooldown.retryAfterSeconds),
              },
            }
          );
        }
      }

      const usernameExists = await sql`
        -- tombstone-aware: identifiers stay reserved until the account is purged
        SELECT id FROM users
        WHERE LOWER(username) = LOWER(${username})
          AND (privy_id IS NULL OR privy_id != ${privyId})
      `;
      if (usernameExists.rows.length > 0) {
        return NextResponse.json(
          { error: "Username already in use" },
          { status: 400 }
        );
      }

      const hold = await checkUsernameReleaseHold({
        username,
        requestingUserId: user.id,
      });
      if (hold.held) {
        return NextResponse.json(
          {
            error:
              "This username was recently released by another account and cannot be registered during the cooldown period",
            code: "USERNAME_RECENTLY_RELEASED",
            availableAt: hold.availableAt,
            retryAfterSeconds: hold.retryAfterSeconds,
          },
          {
            status: 409,
            headers: {
              "Retry-After": String(hold.retryAfterSeconds),
            },
          }
        );
      }
    }

    // Old images are deleted only after the UPDATE succeeds (see image-cleanup).
    const imageCleanup = createImageCleanup();

    // Handle avatar — file upload (→ Cloudinary) or preset icon URL string
    let avatarUrl = user.avatar;
    const avatarFile = formData.get("avatar");
    const avatarUrlField = formData.get("avatarUrl");

    if (avatarFile instanceof Blob) {
      const buffer = Buffer.from(await avatarFile.arrayBuffer());
      const uploadResult = await uploadImageFromBuffer(buffer);
      avatarUrl = uploadResult.secure_url;
      imageCleanup.trackUpload(uploadResult.public_id);
      imageCleanup.trackReplaced(user.avatar);
    } else if (typeof avatarUrlField === "string" && avatarUrlField.trim()) {
      avatarUrl = avatarUrlField.trim();
      // Clean up old Cloudinary photo if switching to a preset icon
      imageCleanup.trackReplaced(user.avatar);
    }

    // Handle banner — file upload (→ Cloudinary)
    let bannerUrl = user.banner;
    const bannerFile = formData.get("banner");

    if (bannerFile instanceof Blob) {
      const buffer = Buffer.from(await bannerFile.arrayBuffer());
      const uploadResult = await uploadImageFromBuffer(buffer);
      bannerUrl = uploadResult.secure_url;
      imageCleanup.trackUpload(uploadResult.public_id);
      imageCleanup.trackReplaced(user.banner);
    }

    let updatedUser: Awaited<ReturnType<typeof sql>>;
    try {
      updatedUser = await sql`
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
    } catch (updateError) {
      await imageCleanup.rollback();
      throw updateError;
    }
    await imageCleanup.commit();
    if (isUsernameChanged) {
      await recordUsernameChange({
        userId: user.id,
        previousUsername: user.username,
        newUsername: username,
      });
    }
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
