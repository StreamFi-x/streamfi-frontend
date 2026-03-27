import { NextRequest } from "next/server";
import { verifyAdminSession, adminUnauthorized } from "@/lib/admin-auth";
import { uploadImageFromBuffer } from "@/utils/upload/cloudinary";

export async function POST(req: NextRequest): Promise<Response> {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return adminUnauthorized();
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const maxSizeBytes = 5 * 1024 * 1024; // 5 MB
  if (file.size > maxSizeBytes) {
    return Response.json(
      { error: "File too large (max 5 MB)" },
      { status: 413 }
    );
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return Response.json(
      { error: "Only JPEG, PNG, WebP, or GIF allowed" },
      { status: 415 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { secure_url } = await uploadImageFromBuffer(buffer, "categories");
    return Response.json({ url: secure_url });
  } catch (err) {
    console.error("[admin/categories/image] upload error:", err);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
