
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { uploadImage, deleteImage } from "@/utils/upload/Dcloudinary";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { validateEmail } from "@/utils/validators";
import { validateUserUpdate } from "../../../../../utils/userValidators";
import { UserUpdateInput } from "../../../../../types/user";


export async function PUT(
  req: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const wallet = params.wallet.toLowerCase();


    // Fetching current user data
    const existingResult = await sql`
      SELECT * FROM users WHERE LOWER(wallet) = LOWER(${wallet})
    `;
    const user = existingResult.rows[0];
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    

    const formData = await req.formData();

    const username = formData.get("username") as string ?? user.username;
    const email = formData.get("email") as string ?? user.email;
    const bio = formData.get("bio") as string ?? user.bio;
    const streamkey = formData.get("streamkey") as string ?? user.streamkey;
    const emailVerified = formData.get("emailVerified") ?? user.emailVerified;
    const emailNotifications = formData.get("emailNotifications") ?? user.emailNotifications;

    // Social links
    let processedSocialLinks = user.sociallinks;
    const socialLinks = formData.get("socialLinks");
    if (socialLinks) {
      try {
        processedSocialLinks = JSON.stringify(
          typeof socialLinks === "string" ? JSON.parse(socialLinks) : socialLinks
        );
      } catch (err) {
        console.error("Invalid socialLinks JSON");
      }
    }

    const creatorRaw = formData.get("creator");
let creator = user.creator;

if (creatorRaw) {
  try {
    creator = typeof creatorRaw === "string" ? JSON.parse(creatorRaw) : creatorRaw;
  } catch (err) {
    console.error("Invalid creator JSON:", err);
    return NextResponse.json({ error: "Invalid creator format" }, { status: 400 });
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
      socialLinks: processedSocialLinks ? JSON.parse(processedSocialLinks) : undefined,
    };

    const validation = validateUserUpdate(updateData);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Email validation & uniqueness
    if (email && !validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    const emailExists = await sql`
      SELECT id FROM users WHERE email = ${email} AND wallet != ${wallet}
    `;
    if (emailExists.rows.length > 0) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    // Username uniqueness
    const usernameExists = await sql`
      SELECT id FROM users WHERE username = ${username} AND wallet != ${wallet}
    `;
    if (usernameExists.rows.length > 0) {
      return NextResponse.json({ error: "Username already in use" }, { status: 400 });
    }

    // Handle avatar upload
    let avatarUrl = user.avatar;
    const avatarFile = formData.get("avatar");
    if (avatarFile instanceof Blob) {
      const tempDir = path.join(os.tmpdir(), "avatar_uploads");
      await fs.mkdir(tempDir, { recursive: true });
      const tempFilePath = path.join(tempDir, `upload_${Date.now()}`);
      const buffer = Buffer.from(await avatarFile.arrayBuffer());
      await fs.writeFile(tempFilePath, buffer);

      const uploadResult = await uploadImage(tempFilePath);
      avatarUrl = uploadResult.secure_url;
      await fs.unlink(tempFilePath).catch(console.error);

      if (user.avatar) {
        const oldPublicId = extractPublicIdFromUrl(user.avatar);
        if (oldPublicId) await deleteImage(oldPublicId);
      }
    }

    // Prepare SQL update
    const updatedUser = await sql`
      UPDATE users SET
        username = ${username},
        email = ${email},
        avatar = ${avatarUrl},
        bio = ${bio},
        streamkey = ${streamkey},
        "socialLinks" = ${processedSocialLinks},
        "emailVerified" = ${emailVerified},
        "emailNotifications" = ${emailNotifications},
        creator = ${JSON.stringify(creator)},
        updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(wallet) = LOWER(${wallet})
      RETURNING id, username, email, streamkey, avatar, bio, "socialLinks", "emailVerified", "emailNotifications", wallet, created_at, updated_at
    `;

    return NextResponse.json({
      message: "User updated successfully",
      user: updatedUser.rows[0],
    });
  } catch (err) {
    console.error("Update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function extractPublicIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/");
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex < 0 || uploadIndex + 2 >= parts.length) return null;
    return parts.slice(uploadIndex + 2).join("/").replace(/\.[^/.]+$/, "");
  } catch (err) {
    console.error("Failed to extract public ID:", err);
    return null;
  }
}
