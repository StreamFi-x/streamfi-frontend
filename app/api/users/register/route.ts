import { NextRequest, NextResponse } from "next/server";
import { checkExistingTableDetail, validateEmail } from "@/utils/validators";
import { sql } from "@vercel/postgres";
import { sendWelcomeRegistrationEmail } from "@/utils/send-email";
import { createMuxStream } from "@/lib/mux/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { getRandomProfileIcon } from "@/lib/profile-icons";
import {
  JsonbContractError,
  prepareCreator,
  prepareSocialLinks,
} from "@/lib/db/jsonb-contracts";
import { invalidateUserCaches } from "@/lib/cache/invalidation";

// Registration creates a Mux stream + DB write — strict limit to prevent abuse
const isRateLimited = createRateLimiter(60 * 60 * 1000, 5); // 5 per hour per IP

async function handler(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  if (req.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
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

  // Normalize to lowercase — prevents case-variant duplicates across auth methods
  const username = rawUsername ? String(rawUsername).trim().toLowerCase() : "";

  if (!username) {
    return NextResponse.json(
      { error: "Username is required" },
      { status: 400 }
    );
  }

  if (!wallet) {
    return NextResponse.json({ error: "Wallet is required" }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!validateEmail(email)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
  }

  // Validate JSONB documents before any side effect (Mux stream creation).
  let socialLinksDocument: ReturnType<typeof prepareSocialLinks>;
  let creatorDocument: ReturnType<typeof prepareCreator>;
  try {
    socialLinksDocument = prepareSocialLinks(socialLinks);
    creatorDocument = prepareCreator(creator);
  } catch (error) {
    if (error instanceof JsonbContractError) {
      return NextResponse.json(
        { error: `Invalid ${error.column}`, issues: error.issues },
        { status: 400 }
      );
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
    const { rows: usernameRows } = await sql`
      -- tombstone-aware: identifiers stay reserved until the account is purged
      SELECT id FROM users WHERE LOWER(username) = ${username} LIMIT 1
    `;
    const usernameExist = usernameRows.length > 0;

    if (userEmailExist || userWalletExist) {
      // A tombstoned account keeps its email/wallet until it is purged; the
      // owner can cancel the deletion instead of registering again.
      const { rows: pending } = await sql`
        SELECT 1 FROM users
        WHERE deleted_at IS NOT NULL AND (email = ${email} OR wallet = ${wallet})
        LIMIT 1
      `;
      if (pending.length > 0) {
        return NextResponse.json(
          {
            error:
              "An account with this email or wallet is pending deletion. Sign in and cancel the deletion, or register again after it has been purged.",
            code: "ACCOUNT_PENDING_DELETION",
          },
          { status: 409 }
        );
      }
    }

    if (userEmailExist) {
      return NextResponse.json(
        { error: "Email already exist" },
        { status: 400 }
      );
    }

    if (usernameExist) {
      return NextResponse.json(
        { error: "Username already exist" },
        { status: 400 }
      );
    }

    if (userWalletExist) {
      return NextResponse.json(
        { error: "Wallet address already exist" },
        { status: 400 }
      );
    }

    // Try to provision Mux stream, but do not block registration if unavailable.
    const hasMuxCredentials =
      !!process.env.MUX_TOKEN_ID && !!process.env.MUX_TOKEN_SECRET;

    let muxStream: Awaited<ReturnType<typeof createMuxStream>> | null = null;

    if (hasMuxCredentials) {
      console.log(`[register] Creating Mux stream for user: ${username}`);
      try {
        muxStream = await createMuxStream({
          name: `${username}'s Stream`,
          record: true,
        });
        console.log(`[register] Mux stream created: ${muxStream.id}`);
      } catch (muxError) {
        console.error("[register] Failed to create Mux stream:", muxError);
      }
    } else {
      console.warn(
        "[register] Mux credentials missing. Skipping stream provisioning."
      );
    }

    await sql`
      INSERT INTO users (
        email,
        username,
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
        ${wallet},
        ${JSON.stringify(socialLinksDocument)},
        ${emailNotifications},
        ${JSON.stringify(creatorDocument)},
        ${muxStream?.id ?? null},
        ${muxStream?.playbackId ?? null},
        ${muxStream?.streamKey ?? null},
        ${getRandomProfileIcon()}
      )
    `;

    // Profile layouts cache "not found" (unstable_cache); purge it for the new handle.
    await invalidateUserCaches({ username, wallet });
    console.log(`[register] User registered: ${username}`);

    await sendWelcomeRegistrationEmail(email, username);

    return NextResponse.json(
      {
        message: "User registration success",
        streamCreated: !!muxStream,
        streamData: {
          rtmpUrl: muxStream?.rtmpUrl ?? null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to register user" },
      { status: 500 }
    );
  }
}

export { handler as POST, handler as GET };
