// @ts-nocheck
import { sql } from "@vercel/postgres";
import { uploadImage } from "@/utils/upload/cloudinary";
import { hashPassword } from "@/lib/stream-access/password";
import {
  JsonbContractError,
  isMergeableCreator,
  prepareCreatorPatch,
} from "@/lib/db/jsonb-contracts";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import {
  apiBadRequest,
  apiConflict,
  apiInternalError,
  apiNotFound,
  apiSuccess,
  apiValidationError,
} from "@/lib/api";

export async function PATCH(req: Request) {
  try {
    const {
      wallet,
      title,
      description,
      category,
      tags,
      thumbnail,
      password,
      streamAccessType,
    } = await req.json();

    if (!wallet) {
      return apiBadRequest("Wallet is required");
    }

    if (title && title.length > 100) {
      return apiBadRequest("Title must be 100 characters or less");
    }

    if (description && description.length > 500) {
      return apiBadRequest("Description must be 500 characters or less");
    }

    const userResult = await sql`
      SELECT id, username, mux_stream_id, creator
      FROM users
      WHERE wallet = ${wallet} AND deleted_at IS NULL
    `;

    if (userResult.rows.length === 0) {
      return apiNotFound("User not found");
    }

    const user = userResult.rows[0];
    const currentCreator = user.creator || {};

    if (!user.mux_stream_id) {
      return apiNotFound("No stream configured for this user");
    }

    // Handle thumbnail upload to Cloudinary if it's base64
    let thumbnailUrl = thumbnail;
    if (thumbnail && thumbnail.startsWith("data:image")) {
      try {
        const uploadResult = await uploadImage(thumbnail, "stream-thumbnails");
        thumbnailUrl = uploadResult.secure_url;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Cloudinary upload error:", error);
        return apiInternalError("Failed to upload thumbnail");
      }
    }

    // Handle stream password: set/update or remove
    if (password !== undefined) {
      if (password === null || password === "") {
        await sql`
          UPDATE users SET
            stream_password_hash = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE wallet = ${wallet}
        `;
        await invalidateUserCaches({ wallet });
      } else {
        if (typeof password !== "string" || password.length < 4) {
          return apiBadRequest("Password must be at least 4 characters");
        }
        const hashed = hashPassword(password);
        await sql`
          UPDATE users SET
            stream_password_hash = ${hashed},
            updated_at = CURRENT_TIMESTAMP
          WHERE wallet = ${wallet}
        `;
        await invalidateUserCaches({ wallet });
      }
    }

    if (streamAccessType !== undefined) {
      const validAccessTypes = ["public", "password", "subscription"];
      if (
        typeof streamAccessType !== "string" ||
        !validAccessTypes.includes(streamAccessType)
      ) {
        return apiBadRequest(
          "streamAccessType must be public, password, or subscription"
        );
      }

      const subscriptionPrice = Number(
        currentCreator.subscriptionPrice ??
          currentCreator.subscription_price_usdc
      );
      if (
        streamAccessType === "subscription" &&
        (!Number.isFinite(subscriptionPrice) || subscriptionPrice <= 0)
      ) {
        return apiBadRequest(
          "Set a subscription price before enabling subscriber access"
        );
      }

      await sql`
        UPDATE users SET
          stream_access_type = ${streamAccessType},
          updated_at = CURRENT_TIMESTAMP
        WHERE wallet = ${wallet}
      `;
      await invalidateUserCaches({ wallet });
    }

    let creatorPatch: ReturnType<typeof prepareCreatorPatch>;
    try {
      creatorPatch = prepareCreatorPatch({
        ...(title && { streamTitle: title }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(tags && { tags }),
        ...(thumbnailUrl && { thumbnail: thumbnailUrl }),
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof JsonbContractError) {
        return apiValidationError("Invalid stream details", error.issues, {
          legacyExtra: { issues: error.issues },
        });
      }
      throw error;
    }

    // Merge in SQL so concurrent updates to different keys are not lost. The
    // object check refuses to merge into a malformed stored value.
    const { rows: updatedRows } = await sql`
      UPDATE users SET
        creator = COALESCE(creator, '{}'::jsonb) || ${JSON.stringify(creatorPatch)}::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE wallet = ${wallet}
        AND deleted_at IS NULL
        AND (creator IS NULL OR jsonb_typeof(creator) = 'object')
      RETURNING creator
    `;
    await invalidateUserCaches({ wallet });

    if (updatedRows.length === 0) {
      if (!isMergeableCreator(user.creator)) {
        // eslint-disable-next-line no-console
        console.error(
          `[streams/update] stored creator for user ${user.id} is malformed; run the JSONB audit`
        );
        return apiConflict("Stored stream details are malformed");
      }
      return apiNotFound("User not found");
    }

    const updatedCreator = updatedRows[0].creator ?? {};

    return apiSuccess(
      {
        streamData: {
          title: updatedCreator.streamTitle,
          description: updatedCreator.description,
          category: updatedCreator.category,
          tags: updatedCreator.tags,
          thumbnail: updatedCreator.thumbnail,
          streamAccessType: streamAccessType ?? "public",
        },
      },
      { message: "Stream updated successfully", legacyFlat: true }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Stream update error:", error);
    return apiInternalError("Failed to update stream");
  }
}
