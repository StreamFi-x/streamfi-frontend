import { NextRequest } from "next/server";
import { checkExistingTableDetail, validateEmail } from "@/utils/validators";
import { sql } from "@vercel/postgres";
import { sendWelcomeRegistrationEmail } from "@/utils/send-email";
import { createMuxStream } from "@/lib/mux/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { getRandomProfileIcon, isPresetIcon } from "@/lib/profile-icons";
import {
  JsonbContractError,
  prepareCreator,
  prepareSocialLinks,
} from "@/lib/db/jsonb-contracts";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import {
  UsernameValidationError,
  prepareUsername,
  type PreparedUsername,
} from "@/lib/validation/username";
import {
  LOOKALIKE_USERNAME_MESSAGE,
  findUsernameConflict,
} from "@/lib/users/username-conflict";
import {
  apiBadRequest,
  apiConflict,
  apiInternalError,
  apiMethodNotAllowed,
  apiRateLimited,
  apiSuccess,
  apiValidationError,
} from "@/lib/api";
import { checkUsernameReleaseHold } from "@/lib/users/username-history";
import { logger } from "@/lib/tracing/logger";
import { getReservedUsernameError } from "@/lib/reserved-usernames";

// Registration creates a Mux stream + DB write — strict limit to prevent abuse
const isRateLimited = createRateLimiter(60 * 60 * 1000, 5); // 5 per hour per IP

async function handler(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return apiRateLimited("Too many requests", { retryAfterSeconds: 3600 });
  }

  const requestBody = await req.json();
  const {
    email,
    username: rawUsername,
    wallet,
    socialLinks = [],
    emailNotifications = true,
    creator = {
      streamTitle: "",
      tags: [],
      category: "",
      payout: "",
      thumbnail: "",
    },
  } = requestBody;

  // Normalize (NFKC, trim, lowercase) and reject mixed-script or invisible
  // characters. The skeleton catches look-alike names such as a Cyrillic "a"
  // standing in for a Latin one.
  let prepared: PreparedUsername;
  try {
    prepared = prepareUsername(rawUsername ? String(rawUsername) : "");
  } catch (error) {
    if (error instanceof UsernameValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  const username = prepared.value;

  const reservedUsernameError = getReservedUsernameError(username);
  if (reservedUsernameError) {
    return NextResponse.json(
      { error: reservedUsernameError },
      { status: 400 }
    );
  }
  }
  const username = prepared.username;

  if (!wallet) {
    return apiBadRequest("Wallet is required");
  }

  if (!email) {
    return apiBadRequest("Email is required");
  }

  if (!validateEmail(email)) {
    return apiBadRequest("Invalid email format");
  }

  // Validate JSONB documents before any side effect (Mux stream creation).
  let socialLinksDocument: ReturnType<typeof prepareSocialLinks>;
  let creatorDocument: ReturnType<typeof prepareCreator>;
  try {
    socialLinksDocument = prepareSocialLinks(socialLinks);
    creatorDocument = prepareCreator(creator);
  } catch (error) {
    if (error instanceof JsonbContractError) {
      return apiValidationError(`Invalid ${error.column}`, error.issues, {
        legacyExtra: { issues: error.issues },
      });
    }
    throw error;
  }

  try {
    const userEmailExist = await checkExistingTableDetail(
      "users",
      "email",
      email
    );
    const userWalletExist = await checkExistingTableDetail(
      "users",
      "wallet",
      wallet
    );
    // Case-insensitive username check — username is stored lowercase but guard against
    // any legacy mixed-case rows that may exist
    const usernameConflict = await findUsernameConflict(prepared);
    const usernameExist = usernameConflict === "exact";

    if (userEmailExist || userWalletExist) {
      // A tombstoned account keeps its email/wallet until it is purged; the
      // owner can cancel the deletion instead of registering again.
      const { rows: pending } = await sql`
        SELECT 1 FROM users
        WHERE deleted_at IS NOT NULL AND (email = ${email} OR wallet = ${wallet})
        LIMIT 1
      `;
      if (pending.length > 0) {
        return apiConflict(
          "An account with this email or wallet is pending deletion. Sign in and cancel the deletion, or register again after it has been purged.",
          { code: "ACCOUNT_PENDING_DELETION" }
        );
      }
    }

    if (userEmailExist) {
      return apiBadRequest("Email already exist");
    }

    if (usernameExist) {
      return apiBadRequest("Username already exist");
    }

    const releaseHold = await checkUsernameReleaseHold({ username });
    if (releaseHold.held) {
      return NextResponse.json(
        {
          error:
            "This username was recently released by another account and cannot be registered during the cooldown period",
          code: "USERNAME_RECENTLY_RELEASED",
          availableAt: releaseHold.availableAt,
          retryAfterSeconds: releaseHold.retryAfterSeconds,
        },
        {
          status: 409,
          headers: {
            "Retry-After": String(releaseHold.retryAfterSeconds),
          },
        }
      );
    }

    if (usernameConflict === "lookalike") {
      return NextResponse.json(
        { error: LOOKALIKE_USERNAME_MESSAGE, code: "USERNAME_LOOKALIKE" },
        { status: 400 }
      );
    }

    if (userWalletExist) {
      return apiBadRequest("Wallet address already exist");
    }

    // Try to provision Mux stream, but do not block registration if unavailable.
    const hasMuxCredentials =
      !!process.env.MUX_TOKEN_ID && !!process.env.MUX_TOKEN_SECRET;

    let muxStream: Awaited<ReturnType<typeof createMuxStream>> | null = null;

    if (hasMuxCredentials) {
      logger.info("Creating Mux stream for user", {
        route: "POST /api/users/register",
        username,
      });
      try {
        muxStream = await createMuxStream({
          name: `${username}'s Stream`,
          record: true,
        });
        logger.info("Mux stream created for user", {
          route: "POST /api/users/register",
          username,
          streamId: muxStream.id,
        });
      } catch (muxError) {
        logger.error(
          "Failed to create Mux stream during registration",
          muxError,
          {
            route: "POST /api/users/register",
            username,
          }
        );
      }
    } else {
      logger.warn("Mux credentials missing. Skipping stream provisioning.", {
        route: "POST /api/users/register",
      });
    }

    await sql`
      INSERT INTO users (
        email,
        username,
        username_skeleton,
        wallet,
        socialLinks,
        emailNotifications,
        creator,
        mux_stream_id,
        mux_playback_id,
        streamkey,
        avatar
      )
      VALUES (
        ${email},
        ${username},
        ${prepared.skeleton},
        ${wallet},
        ${JSON.stringify(socialLinksDocument)},
        ${emailNotifications},
        ${JSON.stringify(creatorDocument)},
        ${muxStream?.id ?? null},
        ${muxStream?.playbackId ?? null},
        ${muxStream?.streamKey ?? null},
        ${
          typeof requestBody.avatar === "string" &&
          isPresetIcon(requestBody.avatar)
            ? requestBody.avatar
            : getRandomProfileIcon()
        }
      )
    `;

    // Profile layouts cache "not found" (unstable_cache); purge it for the new handle.
    await invalidateUserCaches({ username, wallet });
    logger.info("User registered", {
      route: "POST /api/users/register",
      username,
    });

    // The account already exists at this point; a mail failure must not turn a
    // successful registration into a 500 (the client would retry and hit
    // "Email already exist").
    try {
      await sendWelcomeRegistrationEmail(email, username);
    } catch (emailError) {
      // eslint-disable-next-line no-console
      console.error("[register] Failed to send welcome email:", emailError);
    }

    return apiSuccess(
      {
        streamCreated: !!muxStream,
        streamData: {
          rtmpUrl: muxStream?.rtmpUrl ?? null,
        },
      },
      { message: "User registration success", legacyFlat: true }
    );
  } catch (error) {
    logger.error("Registration error", error, {
      route: "POST /api/users/register",
    });
    return apiInternalError("Failed to register user");
  }
}

export { handler as POST };

// Registration mutates state; only POST is allowed.
export async function GET() {
  return apiMethodNotAllowed("POST");
}
