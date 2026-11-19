/**
 * @jest-environment node
 *
 * Custom stream thumbnails (#1419): imported into Cloudinary instead of being
 * downloaded and inspected with sharp on this server.
 */
const mockSql = jest.fn();
const mockVerifySession = jest.fn();
const mockImport = jest.fn();
const mockDeleteImage = jest.fn();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));
jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
}));
jest.mock("@/lib/cache/invalidation", () => ({
  invalidateUserCaches: jest.fn(),
}));
jest.mock("@/utils/upload/cloudinary", () => ({
  ...jest.requireActual("@/utils/upload/cloudinary"),
  importRemoteImage: (...args: unknown[]) => mockImport(...args),
  deleteImage: (...args: unknown[]) => mockDeleteImage(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { DELETE, POST } from "@/app/api/routes-f/preview/custom/route";

const OURS =
  "https://res.cloudinary.com/streamfi/image/upload/v1/stream-thumbnails/old.jpg";
const NEW =
  "https://res.cloudinary.com/streamfi/image/upload/v2/stream-thumbnails/new.jpg";

const post = (body: unknown) =>
  new NextRequest("http://localhost/api/routes-f/preview/custom", {
    method: "POST",
    body: JSON.stringify(body),
  });
const del = () =>
  new NextRequest("http://localhost/api/routes-f/preview/custom", {
    method: "DELETE",
  });

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "streamfi";
  mockVerifySession.mockResolvedValue({ ok: true, userId: "user-1" });
  mockSql.mockReset().mockResolvedValue({ rows: [{ previous_url: null }] });
  mockImport.mockReset().mockResolvedValue({
    ok: true,
    publicId: "stream-thumbnails/new",
    url: NEW,
    width: 1920,
    height: 1080,
  });
  mockDeleteImage.mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/routes-f/preview/custom", () => {
  it("requires a session", async () => {
    mockVerifySession.mockResolvedValue({
      ok: false,
      response: NextResponse.json({}, { status: 401 }),
    });
    expect((await POST(post({ public_url: "https://x/a.jpg" }))).status).toBe(
      401
    );
    expect(mockImport).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 400],
    [{ public_url: "not a url" }, 400],
    [{ public_url: "file:///etc/passwd" }, 400],
  ])("rejects %p without importing", async (body, status) => {
    expect((await POST(post(body))).status).toBe(status);
    expect(mockImport).not.toHaveBeenCalled();
  });

  it("stores the Cloudinary copy, never the user-supplied URL", async () => {
    const res = await POST(post({ public_url: "https://img.example/a.jpg" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ type: "custom", url: NEW });
    expect(mockImport).toHaveBeenCalledWith(
      "https://img.example/a.jpg",
      expect.objectContaining({
        folder: "stream-thumbnails",
        minWidth: 1280,
        minHeight: 720,
        maxBytes: 10 * 1024 * 1024,
      })
    );
    const storedValues = mockSql.mock.calls[0].slice(1);
    expect(storedValues).toContain(NEW);
    expect(storedValues).not.toContain("https://img.example/a.jpg");
  });

  it("passes a validation failure through with its status", async () => {
    mockImport.mockResolvedValue({
      ok: false,
      status: 400,
      error: "Image must be at least 1280x720",
    });
    const res = await POST(post({ public_url: "https://img.example/a.jpg" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Image must be at least 1280x720",
    });
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("deletes the previous thumbnail when it was our Cloudinary copy", async () => {
    mockSql.mockResolvedValue({ rows: [{ previous_url: OURS }] });
    await POST(post({ public_url: "https://img.example/a.jpg" }));
    expect(mockDeleteImage).toHaveBeenCalledWith("stream-thumbnails/old");
  });

  it("leaves an existing external thumbnail URL alone (pre-migration data)", async () => {
    mockSql.mockResolvedValue({
      rows: [{ previous_url: "https://cdn.example/thumb.jpg" }],
    });
    await POST(post({ public_url: "https://img.example/a.jpg" }));
    expect(mockDeleteImage).not.toHaveBeenCalled();
  });

  it("removes the new upload if saving it fails", async () => {
    mockSql.mockRejectedValue(new Error("db down"));
    const res = await POST(post({ public_url: "https://img.example/a.jpg" }));
    expect(res.status).toBe(500);
    expect(mockDeleteImage).toHaveBeenCalledWith("stream-thumbnails/new");
  });
});

describe("DELETE /api/routes-f/preview/custom", () => {
  it("removes our Cloudinary copy and falls back to the Mux thumbnail", async () => {
    mockSql.mockResolvedValue({
      rows: [{ previous_url: OURS, mux_playback_id: "pb1", is_live: true }],
    });
    const res = await DELETE(del());
    expect(await res.json()).toMatchObject({
      type: "mux_auto",
      url: "https://image.mux.com/pb1/thumbnail.jpg?time=5",
    });
    expect(mockDeleteImage).toHaveBeenCalledWith("stream-thumbnails/old");
  });
});
