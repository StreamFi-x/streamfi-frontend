/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import { POST } from "../route";
import { authorizeAdmin } from "@/lib/admin-auth";
import { fileTypeFromBuffer } from "file-type";
import { uploadImageFromBuffer } from "@/utils/upload/cloudinary";

jest.mock("@/lib/admin-auth", () => ({
  authorizeAdmin: jest.fn(),
}));
jest.mock("file-type", () => ({
  fileTypeFromBuffer: jest.fn(),
}));
jest.mock("@/utils/upload/cloudinary", () => ({
  uploadImageFromBuffer: jest.fn(),
}));

const mockAuthorizeAdmin = authorizeAdmin as jest.Mock;
const mockFileTypeFromBuffer = fileTypeFromBuffer as jest.Mock;
const mockUploadImageFromBuffer = uploadImageFromBuffer as jest.Mock;
const URL = "http://localhost/api/admin/categories/image";

function makeRequest(file?: File) {
  const form = new FormData();
  if (file) {
    form.set("file", file);
  }
  return new NextRequest(URL, { method: "POST", body: form });
}

describe("POST /api/admin/categories/image", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthorizeAdmin.mockResolvedValue({ response: null });
    mockUploadImageFromBuffer.mockResolvedValue({
      secure_url: "https://cdn.example/category.png",
    });
  });

  it.each(["image/jpeg", "image/png", "image/webp", "image/gif"])(
    "accepts detected %s bytes regardless of the declared MIME",
    async mime => {
      mockFileTypeFromBuffer.mockResolvedValue({ mime, ext: "image" });

      const response = await POST(
        makeRequest(
          new File(["detected image bytes"], "upload.bin", {
            type: "application/pdf",
          })
        )
      );

      expect(response.status).toBe(200);
      expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(expect.any(Buffer));
      expect(mockUploadImageFromBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        "categories"
      );
    }
  );

  it("rejects non-image bytes even when the client claims they are an image", async () => {
    mockFileTypeFromBuffer.mockResolvedValue({
      mime: "application/pdf",
      ext: "pdf",
    });

    const response = await POST(
      makeRequest(
        new File(["not an image"], "spoofed.png", { type: "image/png" })
      )
    );

    expect(response.status).toBe(415);
    expect(mockUploadImageFromBuffer).not.toHaveBeenCalled();
  });

  it("rejects unrecognized bytes before Cloudinary", async () => {
    mockFileTypeFromBuffer.mockResolvedValue(undefined);

    const response = await POST(
      makeRequest(new File(["unknown"], "unknown.png", { type: "image/png" }))
    );

    expect(response.status).toBe(415);
    expect(mockUploadImageFromBuffer).not.toHaveBeenCalled();
  });

  it("rejects oversized files before content detection", async () => {
    const oversized = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      "large.png",
      { type: "image/png" }
    );

    const response = await POST(makeRequest(oversized));

    expect(response.status).toBe(413);
    expect(mockFileTypeFromBuffer).not.toHaveBeenCalled();
    expect(mockUploadImageFromBuffer).not.toHaveBeenCalled();
  });

  it("does not validate or upload when the admin guard denies access", async () => {
    mockAuthorizeAdmin.mockResolvedValue({
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await POST(
      makeRequest(new File(["content"], "upload.png", { type: "image/png" }))
    );

    expect(response.status).toBe(403);
    expect(mockFileTypeFromBuffer).not.toHaveBeenCalled();
    expect(mockUploadImageFromBuffer).not.toHaveBeenCalled();
  });
});
