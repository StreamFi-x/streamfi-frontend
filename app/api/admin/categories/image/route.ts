import { authorizeAdmin } from "@/lib/admin-auth";
import { NextRequest } from "next/server";
import { fileTypeFromBuffer } from "file-type";
import { uploadImageFromBuffer } from "@/utils/upload/cloudinary";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: NextRequest): Promise<Response> {
  const { response: adminDenied } = await authorizeAdmin(
    req,
    "admin/categories/image"
  );
  if (adminDenied) {
    return adminDenied;
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (error) {
    console.error("[admin/categories/image] invalid multipart body:", error);
    return Response.json(
      { error: "Invalid multipart form data" },
      { status: 400 }
    );
  }
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const maxSizeBytes = 5 * 1024 * 1024; // 5 MB
  if (file.size > maxSizeBytes) {
    return Response.json(
      { error: "File too large (max 5 MB)" },
      { status: 413 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedType = await fileTypeFromBuffer(buffer);

    if (!detectedType || !ALLOWED_IMAGE_TYPES.has(detectedType.mime)) {
      return Response.json(
        { error: "Only JPEG, PNG, WebP, or GIF allowed" },
        { status: 415 }
      );
    }

    const { secure_url } = await uploadImageFromBuffer(buffer, "categories");
    return Response.json({ url: secure_url });
  } catch (err) {
    console.error("[admin/categories/image] validation or upload error:", err);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
