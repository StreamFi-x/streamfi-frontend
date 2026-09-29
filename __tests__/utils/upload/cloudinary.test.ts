/**
 * @jest-environment node
 */
const mockUpload = jest.fn();
const mockDestroy = jest.fn();
jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: (...args: unknown[]) => mockUpload(...args),
      destroy: (...args: unknown[]) => mockDestroy(...args),
    },
  },
}));

import {
  extractPublicIdFromUrl,
  importRemoteImage,
} from "@/utils/upload/cloudinary";

const RULES = {
  folder: "stream-thumbnails",
  allowedFormats: ["jpg", "png", "webp"],
  maxBytes: 10 * 1024 * 1024,
  minWidth: 1280,
  minHeight: 720,
};

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "streamfi";
  mockUpload.mockReset();
  mockDestroy.mockReset().mockResolvedValue({ result: "ok" });
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("extractPublicIdFromUrl", () => {
  it.each([
    [
      "https://res.cloudinary.com/streamfi/image/upload/v1712345678/avatars/abc123.jpg",
      "avatars/abc123",
    ],
    [
      "https://res.cloudinary.com/streamfi/image/upload/stream-thumbnails/x/y.webp",
      "stream-thumbnails/x/y",
    ],
  ])("extracts the public id from our own image %s", (url, id) => {
    expect(extractPublicIdFromUrl(url)).toBe(id);
  });

  it.each([
    // The old extractor accepted any host with an /upload/ segment, so a
    // crafted avatar URL could name another user's asset for deletion.
    "https://evil.example/a/upload/v1/avatars/victim.jpg",
    "https://res.cloudinary.com/other-cloud/image/upload/v1/avatars/abc.jpg",
    "http://res.cloudinary.com/streamfi/image/upload/v1/avatars/abc.jpg",
    "https://res.cloudinary.com/streamfi/video/upload/v1/clip.mp4",
    "https://res.cloudinary.com/streamfi/image/upload/v1",
    "/Images/profile-icon/icon3.png",
    "not a url",
  ])("refuses %s", url => {
    expect(extractPublicIdFromUrl(url)).toBeNull();
  });

  it("refuses everything when the cloud is not configured", () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect(
      extractPublicIdFromUrl(
        "https://res.cloudinary.com/streamfi/image/upload/v1/avatars/abc.jpg"
      )
    ).toBeNull();
  });
});

describe("importRemoteImage", () => {
  const uploaded = (overrides = {}) => ({
    public_id: "stream-thumbnails/new",
    secure_url:
      "https://res.cloudinary.com/streamfi/image/upload/v1/stream-thumbnails/new.jpg",
    width: 1920,
    height: 1080,
    bytes: 500_000,
    ...overrides,
  });

  it("has Cloudinary fetch the URL with the allowed formats and returns our copy", async () => {
    mockUpload.mockResolvedValue(uploaded());
    const result = await importRemoteImage("https://img.example/a.jpg", RULES);

    expect(result).toEqual({
      ok: true,
      publicId: "stream-thumbnails/new",
      url: "https://res.cloudinary.com/streamfi/image/upload/v1/stream-thumbnails/new.jpg",
      width: 1920,
      height: 1080,
    });
    expect(mockUpload).toHaveBeenCalledWith("https://img.example/a.jpg", {
      folder: "stream-thumbnails",
      resource_type: "image",
      allowed_formats: ["jpg", "png", "webp"],
      timeout: 20_000,
    });
  });

  it("rejects and deletes an image below the minimum size", async () => {
    mockUpload.mockResolvedValue(uploaded({ width: 800, height: 600 }));
    expect(await importRemoteImage("https://img.example/a.jpg", RULES)).toEqual(
      {
        ok: false,
        status: 400,
        error: "Image must be at least 1280x720",
      }
    );
    expect(mockDestroy).toHaveBeenCalledWith("stream-thumbnails/new");
  });

  it("rejects and deletes an image over the byte limit", async () => {
    mockUpload.mockResolvedValue(uploaded({ bytes: 11 * 1024 * 1024 }));
    const result = await importRemoteImage("https://img.example/a.jpg", RULES);
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(mockDestroy).toHaveBeenCalled();
  });

  it("reports a URL Cloudinary could not use (wrong format, unreachable) as a 400", async () => {
    mockUpload.mockRejectedValue({
      http_code: 400,
      message: "Image file format gif not allowed",
    });
    expect(await importRemoteImage("https://img.example/a.gif", RULES)).toEqual(
      {
        ok: false,
        status: 400,
        error: "Image could not be imported: Image file format gif not allowed",
      }
    );
  });

  it("reports a Cloudinary outage as a 502", async () => {
    mockUpload.mockRejectedValue({ http_code: 500, message: "server error" });
    expect(
      await importRemoteImage("https://img.example/a.jpg", RULES)
    ).toMatchObject({ ok: false, status: 502 });
  });
});
