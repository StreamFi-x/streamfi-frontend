import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import os from "os";
import { promises as fsPromises } from "fs";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Determines if the image source is a URL or Base64 data
 * @param {string} source - Image source
 * @returns {boolean} True if the source is a URL
 */
function isUrl(source: string): boolean {
  try {
    new URL(source);
    return true;
  } catch {
    return false;
  }
}

/**
 * Determines if the source is a base64 encoded image
 * @param {string} source - Image source
 * @returns {boolean} True if the source is base64 encoded
 */
function isBase64Image(source: string): boolean {
  return source.startsWith("data:image");
}

/**
 * Creates a temporary file from a base64 string
 * @param {string} base64String - Base64 encoded image
 * @returns {Promise<string>} Path to temporary file
 */
async function createTempFileFromBase64(base64String: string): Promise<string> {
  // Extract content type and base64 data
  const matches = base64String.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);

  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 string");
  }

  // Determine file extension from mime type
  const mimeType = matches[1];
  const base64Data = matches[2];
  let extension = ".png"; // Default extension

  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    extension = ".jpg";
  } else if (mimeType.includes("png")) {
    extension = ".png";
  } else if (mimeType.includes("svg")) {
    extension = ".svg";
  } else if (mimeType.includes("webp")) {
    extension = ".webp";
  }

  // Create a temp directory for the file
  const tempDir = path.join(os.tmpdir(), "cloudinary_uploads");
  await fsPromises.mkdir(tempDir, { recursive: true });

  // Create temp file path
  const tempFilePath = path.join(tempDir, `upload_${Date.now()}${extension}`);

  // Write the buffer to the temp file
  const buffer = Buffer.from(base64Data, "base64");
  await fsPromises.writeFile(tempFilePath, buffer);

  return tempFilePath;
}

/**
 * Uploads an image to Cloudinary
 * @param {string} source - Image source (URL, base64, or local path)
 * @param {string} [folder='avatars'] - Cloudinary folder to store the image
 * @returns {Promise<{public_id: string, secure_url: string}>} Upload result
 */
export async function uploadImage(source: string, folder: string = "avatars") {
  try {
    console.log(
      `Uploading image to Cloudinary. Source type: ${isUrl(source) ? "URL" : isBase64Image(source) ? "Base64" : "Local file"}`
    );

    let uploadResult;

    // Handle different source types
    if (isUrl(source)) {
      // URL - upload directly to Cloudinary
      console.log(`Uploading from URL: ${source}`);
      uploadResult = await cloudinary.uploader.upload(source, { folder });
    } else if (isBase64Image(source)) {
      // Base64 - create temp file and upload
      console.log("Processing base64 image data");
      const tempFilePath = await createTempFileFromBase64(source);
      console.log(`Created temp file at: ${tempFilePath}`);

      try {
        uploadResult = await cloudinary.uploader.upload(tempFilePath, {
          folder,
        });
        // Clean up the temp file
        await fsPromises.unlink(tempFilePath);
      } catch (error) {
        console.error("Error during Cloudinary upload:", error);
        // Clean up the temp file even if upload fails
        await fsPromises
          .unlink(tempFilePath)
          .catch(err => console.error("Error deleting temp file:", err));
        throw error;
      }
    } else {
      // Assume it's a local file path
      console.log(`Uploading from local path: ${source}`);
      if (!fs.existsSync(source)) {
        throw new Error(`File does not exist at path: ${source}`);
      }
      uploadResult = await cloudinary.uploader.upload(source, { folder });
    }

    console.log("Cloudinary upload successful:", {
      public_id: uploadResult.public_id,
      secure_url: uploadResult.secure_url,
    });

    return {
      public_id: uploadResult.public_id,
      secure_url: uploadResult.secure_url,
    };
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw new Error("Failed to upload image to Cloudinary");
  }
}

/**
 * Deletes an image from Cloudinary
 * @param {string} publicId - Public ID of the image to delete
 * @returns {Promise<void>}
 */
export async function deleteImage(publicId: string) {
  try {
    await cloudinary.uploader.destroy(publicId);
    console.log(`Successfully deleted image with publicId: ${publicId}`);
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    throw new Error("Failed to delete image from Cloudinary");
  }
}
