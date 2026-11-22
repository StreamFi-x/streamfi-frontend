import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { uploadImageFromBuffer } from "@/utils/upload/cloudinary";
import { createImageCleanup } from "@/lib/users/image-cleanup";
import { JsonbContractError } from "@/lib/db/jsonb-contracts";
import { parseProfileJsonbFields } from "@/lib/users/profile-form";
import { updateMuxStreamRecording } from "@/lib/mux/server";
import { validateEmail } from "@/utils/validators";
import { validateUserUpdate } from "../../../../../utils/userValidators";
import { UserUpdateInput } from "../../../../../types/user";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import { verifySession } from "@/lib/auth/verify-session";
import { shouldBypassAuth } from "@/lib/dev-mode";
import {
  checkUsernameChangeCooldown,
  checkUsernameReleaseHold,
  getUsernameCooldownDays,
  recordUsernameChange,
} from "@/lib/users/username-history";
import { logger } from "@/lib/tracing/logger";
import { normalizeSocialLinksRecord } from "@/lib/users/profile-partial-update";
import { createSanitizedErrorResponse } from "@/lib/api/error-response";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    const normalizedWallet = wallet.toLowerCase();

    // Rewrites profile fields (username, email, avatar, banner, bio,
    // streamkey) — never let a caller mutate a wallet's record without
    // proving they ARE that wallet's authenticated user. Compared
    // case-insensitively (not via assertOwnership's strict ===) since every
    // query in this route already treats wallet casing as unreliable
    // (LOWER(wallet) = LOWER(...) below).
    if (!shouldBypassAuth()) {
      const session = await verifySession(req);
      if (!session.ok) {
        return session.response;
      }
      if (session.wallet?.toLowerCase() !== normalizedWallet) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Fetching current user data
    const existingResult = await sql`
      SELECT id, username, email, bio, streamkey, avatar, banner, sociallinks,
             emailverified, emailnotifications, creator, enable_recording,
             mux_stream_id, wallet, username_changed_at, pending_email, email_change_status, previous_verified_email, updated_at
      FROM users WHERE LOWER(wallet) = LOWER(${normalizedWallet}) AND deleted_at IS NULL
    `;
    const user = existingResult.rows[0];
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const formData = await req.formData();

    const hasUsername = formData.has("username");
    const hasEmail = formData.has("email");
    const hasBio = formData.has("bio");
    const hasStreamkey = formData.has("streamkey");
    const hasEmailVerified = formData.has("emailVerified");
    const hasEmailNotifications = formData.has("emailNotifications");
    const hasEnableRecording = formData.has("enable_recording");
    const hasLatencyMode = formData.has("latency_mode");
    const hasSocialLinks = formData.has("socialLinks") || formData.has("sociallinks");
    const hasCreator = formData.has("creator");

    const username = (formData.get("username") as string) ?? user.username;
    const email = (formData.get("email") as string) ?? user.email;
    const bio = (formData.get("bio") as string) ?? user.bio;
    const streamkey = (formData.get("streamkey") as string) ?? user.streamkey;
    const emailVerified = formData.get("emailVerified") ?? user.emailVerified;
    const emailNotifications =
      formData.get("emailNotifications") ?? user.emailNotifications;
    const enableRecordingRaw = formData.get("enable_recording");
    const enableRecording =
      enableRecordingRaw !== null && enableRecordingRaw !== undefined
        ? String(enableRecordingRaw) === "true"
        : user.enable_recording;
    const latencyModeRaw = formData.get("latency_mode");
    const latencyMode =
      latencyModeRaw !== null && latencyModeRaw !== undefined
        ? String(latencyModeRaw)
        : user.latency_mode || "low";

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
      email,
      streamkey,
      avatar: user.avatar,
      bio,
      emailVerified,
      emailNotifications,
      socialLinks: jsonbFields.socialLinks,
    };

    const validation = validateUserUpdate(updateData);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Email validation & uniqueness
    if (email && email !== user.email && !validateEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (email && email !== user.email) {
      const emailExists = await sql`
        -- tombstone-aware: identifiers stay reserved until the account is purged
        SELECT id FROM users WHERE email = ${email} AND wallet != ${normalizedWallet}
      `;
      if (emailExists.rows.length > 0) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        );
      }
    }

    const isUsernameChanged = Boolean(
      username &&
      user.username &&
      username.toLowerCase() !== String(user.username).toLowerCase()
    );

    // Username cooldown, uniqueness, and recent-release hold (#1730, #1734)
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
        SELECT id FROM users WHERE LOWER(username) = LOWER(${username}) AND LOWER(wallet) != LOWER(${normalizedWallet})
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

    const hasAvatar =
      avatarFile instanceof Blob ||
      (typeof avatarUrlField === "string" && avatarUrlField.trim().length > 0);
    const hasBanner = bannerFile instanceof Blob;

    // Partial sociallinks merge (#1736)
    const existingSocialLinks = normalizeSocialLinksRecord(user.sociallinks);
    const incomingSocialLinks = jsonbFields.socialLinks
      ? normalizeSocialLinksRecord(jsonbFields.socialLinks)
      : {};
    const mergedSocialLinks = hasSocialLinks
      ? { ...existingSocialLinks, ...incomingSocialLinks }
      : existingSocialLinks;

    // Email change re-verification state machine (#1735)
    let emailToSet = user.email;
    let pendingEmailToSet = user.pending_email ?? null;
    let emailChangeStatusToSet = user.email_change_status ?? "none";
    let previousVerifiedEmailToSet = user.previous_verified_email ?? null;
    let emailVerifiedToSet = user.emailverified;

    if (hasEmail && email !== user.email) {
      if (user.emailverified) {
        pendingEmailToSet = email;
        emailChangeStatusToSet = "pending";
        previousVerifiedEmailToSet = user.email;
      } else {
        emailToSet = email;
        emailVerifiedToSet = false;
        pendingEmailToSet = null;
        emailChangeStatusToSet = "none";
      }
    }

    // Prepare SQL update - partial update preserving untouched fields (#1736)
    let updatedUser: Awaited<ReturnType<typeof sql>>;
    try {
      updatedUser = await sql`
        UPDATE users SET
          username = CASE WHEN ${hasUsername} THEN ${username} ELSE username END,
          email = ${emailToSet},
          pending_email = ${pendingEmailToSet},
          email_change_status = ${emailChangeStatusToSet},
          previous_verified_email = ${previousVerifiedEmailToSet},
          emailverified = ${emailVerifiedToSet},
          avatar = CASE WHEN ${hasAvatar} THEN ${avatarUrl} ELSE avatar END,
          banner = CASE WHEN ${hasBanner} THEN ${bannerUrl} ELSE banner END,
          bio = CASE WHEN ${hasBio} THEN ${bio} ELSE bio END,
          streamkey = CASE WHEN ${hasStreamkey} THEN ${streamkey} ELSE streamkey END,
          sociallinks = CASE WHEN ${hasSocialLinks} THEN ${JSON.stringify(mergedSocialLinks)}::jsonb ELSE sociallinks END,
          emailnotifications = CASE WHEN ${hasEmailNotifications} THEN ${emailNotifications} ELSE emailnotifications END,
          creator = CASE WHEN ${hasCreator} THEN COALESCE(${jsonbFields.creator ? JSON.stringify(jsonbFields.creator) : null}::jsonb, creator) ELSE creator END,
          enable_recording = CASE WHEN ${hasEnableRecording} THEN ${enableRecording} ELSE enable_recording END,
          latency_mode = CASE WHEN ${hasLatencyMode} THEN ${latencyMode} ELSE latency_mode END,
          updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(wallet) = LOWER(${normalizedWallet}) AND deleted_at IS NULL
        RETURNING id, username, email, streamkey, avatar, banner, bio, sociallinks, emailverified, emailnotifications, creator, wallet, enable_recording, latency_mode, pending_email, email_change_status, previous_verified_email, created_at, updated_at
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

    // Sync recording preference to Mux if it changed and the user has a stream
    const recordingChanged = enableRecording !== user.enable_recording;
    if (recordingChanged && user.mux_stream_id) {
      try {
        await updateMuxStreamRecording(user.mux_stream_id, enableRecording);
      } catch (muxErr) {
        // Log but don't fail the settings save — user preference is stored in DB
        logger.error("Failed to sync recording preference to Mux", muxErr, {
          route: "PUT /api/users/updates/[wallet]",
          userId: user.id,
          muxStreamId: user.mux_stream_id,
        });
      }
    }

    return NextResponse.json({
      message: "User updated successfully",
      user: updatedUser.rows[0],
    });
  } catch (err) {
    logger.error("User profile update error", err, {
      route: "PUT /api/users/updates/[wallet]",
    });
    return createSanitizedErrorResponse(err, "Internal server error");
  }
}
