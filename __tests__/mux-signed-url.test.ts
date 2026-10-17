/**
 * @jest-environment node
 */

import crypto from "crypto";
import { createMuxSignedUrl } from "@/lib/mux/server";

describe("createMuxSignedUrl (#792)", () => {
  const originalEnv = process.env;
  let testKeyPrivateB64: string;

  beforeAll(() => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    testKeyPrivateB64 = Buffer.from(
      privateKey.export({ type: "pkcs8", format: "pem" })
    ).toString("base64");
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("throws when Mux signing keys are not configured", async () => {
    delete process.env.MUX_SIGNING_KEY_ID;
    delete process.env.MUX_SIGNING_KEY_PRIVATE;

    await expect(createMuxSignedUrl("playback-123", "video")).rejects.toThrow(
      "Mux signing keys"
    );
  });

  it("generates a signed video URL with valid RS256 token and aud='v'", async () => {
    process.env.MUX_SIGNING_KEY_ID = "key-test-id";
    process.env.MUX_SIGNING_KEY_PRIVATE = testKeyPrivateB64;

    const url = await createMuxSignedUrl("playback-test-video", "video");

    expect(url).toContain(
      "https://stream.mux.com/playback-test-video.m3u8?token="
    );
    const token = new URL(url).searchParams.get("token");
    expect(token).toBeTruthy();

    const [headerB64, payloadB64] = token!.split(".");
    const header = JSON.parse(
      Buffer.from(headerB64, "base64url").toString("utf8")
    );
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );

    expect(header.alg).toBe("RS256");
    expect(header.kid).toBe("key-test-id");
    expect(payload.sub).toBe("playback-test-video");
    expect(payload.aud).toBe("v");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("generates a signed thumbnail URL with valid RS256 token and aud='t'", async () => {
    process.env.MUX_SIGNING_KEY_ID = "key-test-id";
    process.env.MUX_SIGNING_KEY_PRIVATE = testKeyPrivateB64;

    const url = await createMuxSignedUrl("playback-test-thumb", "thumbnail");

    expect(url).toContain(
      "https://image.mux.com/playback-test-thumb/thumbnail.jpg?token="
    );
    const token = new URL(url).searchParams.get("token");
    expect(token).toBeTruthy();

    const [, payloadB64] = token!.split(".");
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );

    expect(payload.sub).toBe("playback-test-thumb");
    expect(payload.aud).toBe("t");
  });
});
