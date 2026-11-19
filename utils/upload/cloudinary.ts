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
 * Uploads a Buffer directly to Cloudinary via upload_stream — no disk I/O.
 * Rejects after `timeoutMs` (default 10 s) so a slow Cloudinary response
 * never hangs the API route.
 */
export async function uploadImageFromBuffer(
  buffer: Buffer,
  folder: string = "avatars",
  timeoutMs: number = 10_000
): Promise<{ public_id: string; secure_url: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Cloudinary upload timed out")),
      timeoutMs
    );

    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        clearTimeout(timer);
        if (error || !result) {
          return reject(error ?? new Error("No result from Cloudinary"));
        }
        resolve({ public_id: result.public_id, secure_url: result.secure_url });
      }
    );

    stream.end(buffer);
  });
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

/**
 * Public ID of an image stored in this app's Cloudinary cloud, or null for
 * any other URL (preset icons, external images, other clouds). Only such
 * IDs may be passed to deleteImage: a user-supplied URL must never be able
 * to name someone else's asset.
 */
export function extractPublicIdFromUrl(url: string): string | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "res.cloudinary.com"
  ) {
    return null;
  }
  // /<cloud>/image/upload/[v<version>/]<public_id>.<ext>
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts[0] !== cloudName || parts[1] !== "image" || parts[2] !== "upload") {
    return null;
  }
  const rest = parts.slice(3);
  if (rest[0] && /^v\d+$/.test(rest[0])) {
    rest.shift();
  }
  if (rest.length === 0) {
    return null;
  }
  return decodeURIComponent(rest.join("/")).replace(/\.[^/.]+$/, "");
}

export interface RemoteImageRules {
  folder: string;
  /** Cloudinary format names, e.g. ["jpg", "png", "webp"]. */
  allowedFormats: string[];
  maxBytes: number;
  minWidth: number;
  minHeight: number;
  timeoutMs?: number;
}

export type RemoteImageImport =
  | { ok: true; publicId: string; url: string; width: number; height: number }
  | { ok: false; status: 400 | 502; error: string };

/**
 * Copies an image from a public URL into Cloudinary and validates it there.
 * Cloudinary fetches the URL, so this server never downloads user-supplied
 * URLs itself (no request to internal addresses, no unbounded download),
 * and the stored image no longer depends on the original host. An image
 * that fails validation is deleted again.
 */
export async function importRemoteImage(
  url: string,
  rules: RemoteImageRules
): Promise<RemoteImageImport> {
  let result: {
    public_id: string;
    secure_url: string;
    width?: number;
    height?: number;
    bytes?: number;
  };
  try {
    result = await cloudinary.uploader.upload(url, {
      folder: rules.folder,
      resource_type: "image",
      allowed_formats: rules.allowedFormats,
      timeout: rules.timeoutMs ?? 20_000,
    });
  } catch (error) {
    const httpCode = (error as { http_code?: number })?.http_code;
    if (httpCode === 400) {
      return {
        ok: false,
        status: 400,
        error: `Image could not be imported: ${(error as { message?: string }).message ?? "invalid image"}`,
      };
    }
    console.error("Cloudinary remote import failed:", error);
    return { ok: false, status: 502, error: "Image storage is unavailable" };
  }

  const width = result.width ?? 0;
  const height = result.height ?? 0;
  const bytes = result.bytes ?? 0;
  let problem: string | null = null;
  if (bytes > rules.maxBytes) {
    problem = `Image exceeds ${Math.round(rules.maxBytes / (1024 * 1024))}MB limit`;
  } else if (width < rules.minWidth || height < rules.minHeight) {
    problem = `Image must be at least ${rules.minWidth}x${rules.minHeight}`;
  }
  if (problem) {
    await deleteImage(result.public_id).catch(() => undefined);
    return { ok: false, status: 400, error: problem };
  }
  return {
    ok: true,
    publicId: result.public_id,
    url: result.secure_url,
    width,
    height,
  };
}
