import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { uploadImage } from "@/utils/upload/cloudinary";
import { hashPassword } from "@/lib/stream-access/password";

export async function PATCH(req: Request) {
  try {
    const { wallet, title, description, category, tags, thumbnail, password } =
      await req.json();

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet is required" },
        { status: 400 }
      );
    }

    if (title && title.length > 100) {
      return NextResponse.json(
        { error: "Title must be 100 characters or less" },
        { status: 400 }
      );
    }

    if (description && description.length > 500) {
      return NextResponse.json(
        { error: "Description must be 500 characters or less" },
        { status: 400 }
      );
    }

    const userResult = await sql`
      SELECT id, username, mux_stream_id, creator
      FROM users
      WHERE wallet = ${wallet}
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    if (!user.mux_stream_id) {
      return NextResponse.json(
        { error: "No stream configured for this user" },
        { status: 404 }
      );
    }

    // Note: Mux streams don't require metadata updates on the service side
    // All stream metadata is stored in the database

    // Handle thumbnail upload to Cloudinary if it's base64
    let thumbnailUrl = thumbnail;
    if (thumbnail && thumbnail.startsWith("data:image")) {
      try {
        const uploadResult = await uploadImage(thumbnail, "stream-thumbnails");
        thumbnailUrl = uploadResult.secure_url;
        console.log("Thumbnail uploaded to Cloudinary:", thumbnailUrl);
      } catch (error) {
        console.error("Cloudinary upload error:", error);
        return NextResponse.json(
          { error: "Failed to upload thumbnail" },
          { status: 500 }
        );
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
      } else {
        if (typeof password !== "string" || password.length < 4) {
          return NextResponse.json(
            { error: "Password must be at least 4 characters" },
            { status: 400 }
          );
        }
        const hashed = hashPassword(password);
        await sql`
          UPDATE users SET
            stream_password_hash = ${hashed},
            updated_at = CURRENT_TIMESTAMP
          WHERE wallet = ${wallet}
        `;
      }
    }

    const currentCreator = user.creator || {};
    const updatedCreator = {
      ...currentCreator,
      ...(title && { streamTitle: title }),
      ...(description !== undefined && { description }),
      ...(category && { category }),
      ...(tags && { tags }),
      ...(thumbnailUrl && { thumbnail: thumbnailUrl }),
      lastUpdated: new Date().toISOString(),
    };

    await sql`
      UPDATE users SET
        creator = ${JSON.stringify(updatedCreator)},
        updated_at = CURRENT_TIMESTAMP
      WHERE wallet = ${wallet}
    `;

    return NextResponse.json(
      {
        message: "Stream updated successfully",
        streamData: {
          title: updatedCreator.streamTitle,
          description: updatedCreator.description,
          category: updatedCreator.category,
          tags: updatedCreator.tags,
          thumbnail: updatedCreator.thumbnail,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Stream update error:", error);
    return NextResponse.json(
      { error: "Failed to update stream" },
      { status: 500 }
    );
  }
}
