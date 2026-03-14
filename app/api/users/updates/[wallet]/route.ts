import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { uploadImageFromBuffer, deleteImage } from "@/utils/upload/cloudinary";
import { updateMuxStreamRecording } from "@/lib/mux/server";
import { validateEmail } from "@/utils/validators";
import { validateUserUpdate } from "../../../../../utils/userValidators";
import { UserUpdateInput } from "../../../../../types/user";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    const normalizedWallet = wallet.toLowerCase();

    // Fetching current user data
    const existingResult = await sql`
      SELECT id, username, email, bio, streamkey, avatar, banner, sociallinks,
             emailverified, emailnotifications, creator, enable_recording,
             mux_stream_id, wallet
      FROM users WHERE LOWER(wallet) = LOWER(${normalizedWallet})
    `;
    const user = existingResult.rows[0];
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const formData = await req.formData();

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

    // Social links - Use lowercase column name to match database
    let processedSocialLinks = user.sociallinks;
    const socialLinks = formData.get("socialLinks");
    if (
      socialLinks &&
      socialLinks !== "" &&
      socialLinks !== "null" &&
      socialLinks !== "undefined"
    ) {
      try {
        const parsedLinks =
          typeof socialLinks === "string"
            ? JSON.parse(socialLinks)
            : socialLinks;
        processedSocialLinks = JSON.stringify(parsedLinks);
      } catch (err) {
        console.error("Invalid socialLinks JSON:", err);
        return NextResponse.json(
          { error: "Invalid socialLinks format" },
          { status: 400 }
        );
      }
    }

    const creatorRaw = formData.get("creator");
    let creator = user.creator;

    if (
      creatorRaw &&
      creatorRaw !== "" &&
      creatorRaw !== "null" &&
      creatorRaw !== "undefined"
    ) {
      try {
        creator =
          typeof creatorRaw === "string" ? JSON.parse(creatorRaw) : creatorRaw;
      } catch (err) {
        console.error("Invalid creator JSON:", err);
        return NextResponse.json(
          { error: "Invalid creator format" },
          { status: 400 }
        );
      }
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
      socialLinks: processedSocialLinks
        ? typeof processedSocialLinks === "string"
          ? JSON.parse(processedSocialLinks)
          : processedSocialLinks
        : undefined,
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
        SELECT id FROM users WHERE email = ${email} AND wallet != ${normalizedWallet}
      `;
      if (emailExists.rows.length > 0) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        );
      }
    }

    // Username uniqueness
    if (username && username !== user.username) {
      const usernameExists = await sql`
        SELECT id FROM users WHERE username = ${username} AND wallet != ${normalizedWallet}
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
    const avatarFile = formData.get("avatar");
    const avatarUrlField = formData.get("avatarUrl");

    if (avatarFile instanceof Blob) {
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
      avatarUrl = avatarUrlField.trim();
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
    const bannerFile = formData.get("banner");

    if (bannerFile instanceof Blob) {
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

    // Prepare SQL update - Use lowercase column name for Postgres
    const updatedUser = await sql`
      UPDATE users SET
        username = ${username},
        email = ${email},
        avatar = ${avatarUrl},
        banner = ${bannerUrl},
        bio = ${bio},
        streamkey = ${streamkey},
        sociallinks = ${processedSocialLinks},
        emailverified = ${emailVerified},
        emailnotifications = ${emailNotifications},
        creator = ${creator ? JSON.stringify(creator) : user.creator},
        enable_recording = ${enableRecording},
        updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(wallet) = LOWER(${normalizedWallet})
      RETURNING id, username, email, streamkey, avatar, banner, bio, sociallinks, emailverified, emailnotifications, creator, wallet, enable_recording, created_at, updated_at
    `;

    // Sync recording preference to Mux if it changed and the user has a stream
    const recordingChanged = enableRecording !== user.enable_recording;
    if (recordingChanged && user.mux_stream_id) {
      try {
        await updateMuxStreamRecording(user.mux_stream_id, enableRecording);
      } catch (muxErr) {
        // Log but don't fail the settings save — user preference is stored in DB
        console.error("Failed to sync recording preference to Mux:", muxErr);
      }
    }

    return NextResponse.json({
      message: "User updated successfully",
      user: updatedUser.rows[0],
    });
  } catch (err) {
    console.error("Update error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function extractPublicIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/");
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex < 0 || uploadIndex + 2 >= parts.length) {
      return null;
    }
    return parts
      .slice(uploadIndex + 2)
      .join("/")
      .replace(/\.[^/.]+$/, "");
  } catch (err) {
    console.error("Failed to extract public ID:", err);
    return null;
  }
}
