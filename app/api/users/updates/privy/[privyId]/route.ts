import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { uploadImageFromBuffer, deleteImage } from "@/utils/upload/cloudinary";
import { validateUserUpdate } from "../../../../../../utils/userValidators";
import { UserUpdateInput } from "../../../../../../types/user";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ privyId: string }> }
) {
  try {
    const { privyId } = await params;

    // Fetch current user record by privy_id
    const existingResult = await sql`
      SELECT id, username, email, bio, streamkey, avatar, sociallinks,
             emailverified, emailnotifications, creator, enable_recording,
             privy_id
      FROM users WHERE privy_id = ${privyId}
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

    // Social links
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
      bio,
      streamkey,
      avatar: user.avatar,
      emailVerified: emailVerified as boolean | undefined,
      emailNotifications: emailNotifications as boolean | undefined,
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

    // Username uniqueness — exclude current user.
    // Must explicitly handle NULL privy_id (wallet users) since NULL != x
    // evaluates to NULL in SQL, not TRUE, so they'd be silently excluded.
    if (username && username !== user.username) {
      const usernameExists = await sql`
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

    const updatedUser = await sql`
      UPDATE users SET
        username = ${username},
        avatar = ${avatarUrl},
        bio = ${bio},
        streamkey = ${streamkey},
        sociallinks = ${processedSocialLinks},
        emailverified = ${emailVerified},
        emailnotifications = ${emailNotifications},
        creator = ${creator ? JSON.stringify(creator) : user.creator},
        updated_at = CURRENT_TIMESTAMP
      WHERE privy_id = ${privyId}
      RETURNING id, username, email, streamkey, avatar, bio, sociallinks,
                emailverified, emailnotifications, creator, privy_id,
                created_at, updated_at
    `;

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
  } catch {
    return null;
  }
}
