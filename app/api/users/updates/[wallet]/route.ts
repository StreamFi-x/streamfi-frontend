// import { NextResponse } from 'next/server';
// import { sql } from '@vercel/postgres';
// import { uploadImage, deleteImage } from "@/utils/upload/Dcloudinary";

// export async function PUT(
//   req: Request,
//   { params }: { params: { wallet: string } }
// ) {
//   try {
//     const userData = await req.json();
//     const wallet = params.wallet.toLowerCase();
    
//     console.log(`Updating user with wallet: ${wallet}`);
    
//     // Fetch user from the database
//     const result = await sql`SELECT * FROM users WHERE LOWER(wallet) = LOWER(${wallet})`;
//     const user = result.rows[0];
    
//     if (!user) {
//       console.log(`User not found with wallet: ${wallet}`);
//       return NextResponse.json({ error: 'User not found' }, { status: 404 });
//     }
    
//     console.log(`Found user: ${user.username}`);

//     // Prepare update data
//     const { username, email, avatar, bio, streamkey, socialLinks } = userData;

//     // Upload avatar if a new one is provided
//     let avatarUrl = user.avatar;
//     if (avatar && avatar !== user.avatar) {
//       console.log('Processing new avatar image');
//       try {
//         // If there's a new avatar, upload it to Cloudinary
//         const uploadResult = await uploadImage(avatar);
//         avatarUrl = uploadResult.secure_url;
//         console.log(`New avatar URL: ${avatarUrl}`);
        
//         // Delete old avatar if it exists
//         if (user.avatar) {
//           try {
//             // Extract public_id from URL
//             const oldAvatarPublicId = extractPublicIdFromUrl(user.avatar);
//             if (oldAvatarPublicId) {
//               await deleteImage(oldAvatarPublicId);
//               console.log(`Deleted old avatar: ${oldAvatarPublicId}`);
//             }
//           } catch (deleteErr) {
//             // Log but don't fail if we can't delete the old image
//             console.error('Error deleting old avatar:', deleteErr);
//           }
//         }
//       } catch (uploadErr) {
//         console.error('Avatar upload error:', uploadErr);
//         return NextResponse.json(
//           { error: 'Failed to upload avatar image' }, 
//           { status: 500 }
//         );
//       }
//     }

//     // Prepare socialLinks JSON if provided as string
//     let processedSocialLinks = user.sociallinks;
//     if (socialLinks) {
//       if (typeof socialLinks === 'string') {
//         try {
//           processedSocialLinks = JSON.parse(socialLinks);
//         } catch (e) {
//           console.error('Error parsing socialLinks JSON:', e);
//           // Keep the existing socialLinks if parsing fails
//         }
//       } else {
//         processedSocialLinks = socialLinks;
//       }
//     }

//     console.log('Updating user in database with data:', {
//       username: username || user.username,
//       email: email || user.email,
//       avatarUrl,
//       bio: bio || user.bio,
//       streamkey: streamkey || user.streamkey,
//       hasSocialLinks: !!processedSocialLinks
//     });

//     // Update user in the database
//     const updateQuery = await sql`
//       UPDATE users
//       SET
//         username = ${username || user.username},
//         email = ${email || user.email},
//         avatar = ${avatarUrl},
//         bio = ${bio !== undefined ? bio : user.bio},
//         streamkey = ${streamkey || user.streamkey},
//         socialLinks = ${processedSocialLinks ? JSON.stringify(processedSocialLinks) : user.sociallinks},
//         updated_at = CURRENT_TIMESTAMP
//       WHERE LOWER(wallet) = LOWER(${wallet})
//       RETURNING *;
//     `;

//     const updatedUser = updateQuery.rows[0];
//     console.log('User updated successfully');

//     return NextResponse.json({ user: updatedUser });
//   } catch (error) {
//     console.error('Error updating user:', error);
//     return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
//   }
// }

// /**
//  * Extracts the public ID from a Cloudinary URL
//  * @param {string} url - Cloudinary URL
//  * @returns {string|null} Public ID or null if it couldn't be extracted
//  */
// function extractPublicIdFromUrl(url: string): string | null {
//   try {
//     // Example URL: https://res.cloudinary.com/dqmt1ggqu/image/upload/v1744909390/avatars/Oval_i2o8zh.svg
//     const urlObj = new URL(url);
//     const pathParts = urlObj.pathname.split('/');
    
//     // Find the index of 'upload' in the path
//     const uploadIndex = pathParts.findIndex(part => part === 'upload');
    
//     if (uploadIndex < 0 || uploadIndex + 2 >= pathParts.length) {
//       return null;
//     }
    
//     // The public ID is everything after the version (which follows 'upload')
//     // and includes the folder if present
//     const versionPart = pathParts[uploadIndex + 1]; // e.g., 'v1744909390'
    
//     // Everything after the version is the public ID with folders
//     const publicIdParts = pathParts.slice(uploadIndex + 2);
//     return publicIdParts.join('/');
//   } catch (error) {
//     console.error('Error extracting public ID from URL:', error);
//     return null;
//   }
// }

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { uploadImage, deleteImage } from "@/utils/upload/Dcloudinary";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

export async function PUT(
  req: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const wallet = params.wallet.toLowerCase();
    
    // Get user record to check if they exist
    const result = await sql`SELECT * FROM users WHERE LOWER(wallet) = LOWER(${wallet})`;
    const user = result.rows[0];
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // In App Router, we need to use FormData API instead of formidable
    const formData = await req.formData();
    
    // Extract form fields
    const username = formData.get("username") as string || user.username;
    const email = formData.get("email") as string || user.email;
    const bio = formData.get("bio") as string ?? user.bio;
    const streamkey = formData.get("streamkey") as string || user.streamkey;
    
    // Handle socialLinks
    let processedSocialLinks = user.sociallinks;
    const socialLinks = formData.get("socialLinks");
    if (socialLinks) {
      try {
        processedSocialLinks = typeof socialLinks === "string" 
          ? JSON.parse(socialLinks) 
          : socialLinks;
      } catch (e) {
        console.error("Failed to parse socialLinks:", e);
      }
    }

    // Process avatar upload
    let avatarUrl = user.avatar;
    const avatarFile = formData.get("avatar");

    if (avatarFile instanceof Blob) {
      try {
        // Create a temporary file to store the blob data
        const tempDir = path.join(os.tmpdir(), 'avatar_uploads');
        await fs.mkdir(tempDir, { recursive: true });
        const tempFilePath = path.join(tempDir, `upload_${Date.now()}`);
        
        // Write blob data to the temp file
        const buffer = Buffer.from(await avatarFile.arrayBuffer());
        await fs.writeFile(tempFilePath, buffer);
        
        // Upload to Cloudinary
        const uploadResult = await uploadImage(tempFilePath);
        avatarUrl = uploadResult.secure_url;
        
        // Clean up the temp file
        await fs.unlink(tempFilePath).catch(err => 
          console.error("Error deleting temp file:", err)
        );
        
        // Delete old avatar if it exists
        if (user.avatar) {
          const oldPublicId = extractPublicIdFromUrl(user.avatar);
          if (oldPublicId) {
            await deleteImage(oldPublicId);
          }
        }
      } catch (err) {
        console.error("Avatar upload failed:", err);
        return NextResponse.json(
          { error: "Failed to upload avatar" }, 
          { status: 500 }
        );
      }
    }

    // Update the user record
    const updateResult = await sql`
      UPDATE users
      SET
        username = ${username},
        email = ${email},
        avatar = ${avatarUrl},
        bio = ${bio},
        streamkey = ${streamkey},
        socialLinks = ${processedSocialLinks ? JSON.stringify(processedSocialLinks) : user.sociallinks},
        updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(wallet) = LOWER(${wallet})
      RETURNING *;
    `;

    return NextResponse.json({ user: updateResult.rows[0] });
  } catch (err) {
    console.error("Error updating user:", err);
    return NextResponse.json(
      { error: "Failed to update user" }, 
      { status: 500 }
    );
  }
}

function extractPublicIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    const uploadIndex = pathParts.findIndex(part => part === "upload");
    
    if (uploadIndex < 0 || uploadIndex + 2 >= pathParts.length) {
      return null;
    }
    
    return pathParts.slice(uploadIndex + 2).join("/").replace(/\.[^/.]+$/, ""); // Remove file extension
  } catch (err) {
    console.error("Error extracting public ID from URL:", err);
    return null;
  }
}