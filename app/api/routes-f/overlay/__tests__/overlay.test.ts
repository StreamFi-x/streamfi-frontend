import { NextRequest } from "next/server";
import { GET as getOverlay, PATCH as patchOverlay } from "../route";
import { POST as rotateTokenPost } from "../token/route";
import { resetOverlayStore } from "../store";

function makeGetReq(token?: string): NextRequest {
  const url = token
    ? `http://localhost/api/routes-f/overlay?token=${token}`
    : "http://localhost/api/routes-f/overlay";
  return new NextRequest(url, { method: "GET" });
}

function makePatchReq(body: unknown, userId?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userId) {
    headers["x-user-id"] = userId;
  }
  return new NextRequest("http://localhost/api/routes-f/overlay", {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

function makeTokenReq(userId?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (userId) {
    headers["x-user-id"] = userId;
  }
  return new NextRequest("http://localhost/api/routes-f/overlay/token", {
    method: "POST",
    headers,
  });
}

describe("OBS Overlay API & Token Authentication", () => {
  beforeEach(() => {
    resetOverlayStore();
  });

  const validTestToken = "test_overlay_token_secret_1234567890abcdef1234567890abcdef";

  it("returns 400 when token parameter is missing", async () => {
    const res = await getOverlay(makeGetReq());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/token required/i);
  });

  it("returns 401 for invalid or guessed token", async () => {
    const res = await getOverlay(makeGetReq("guessed_fake_token_12345"));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/invalid or expired/i);
  });

  it("returns scoped public overlay configuration for valid token with caching headers", async () => {
    const res = await getOverlay(makeGetReq(validTestToken));
    expect(res.status).toBe(200);

    // Verify OBS caching headers
    expect(res.headers.get("Cache-Control")).toContain("max-age=10");

    const data = await res.json();
    expect(data.theme).toBe("streamfi");
    expect(data.position).toBe("bottom-right");
    expect(data.fontSize).toBe(18);
    expect(data.opacity).toBe(0.95);
    expect(data.primary_color).toBe("#ac39f2");

    // Security scope check: sensitive fields must NEVER be exposed
    expect(data.user_id).toBeUndefined();
    expect(data.token).toBeUndefined();
    expect(data.email).toBeUndefined();
  });

  it("rotates token with 1-click and immediately invalidates the old token", async () => {
    const userId = "creator_test_overlay_user";

    // 1. Verify old token works initially
    const beforeRes = await getOverlay(makeGetReq(validTestToken));
    expect(beforeRes.status).toBe(200);

    // 2. Rotate token
    const rotateRes = await rotateTokenPost(makeTokenReq(userId));
    expect(rotateRes.status).toBe(200);
    const rotateData = await rotateRes.json();
    const newToken = rotateData.token;
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(validTestToken);

    // 3. Immediately verify the OLD token is rejected with 401
    const oldTokenRes = await getOverlay(makeGetReq(validTestToken));
    expect(oldTokenRes.status).toBe(401);

    // 4. Verify the NEW token works
    const newTokenRes = await getOverlay(makeGetReq(newToken));
    expect(newTokenRes.status).toBe(200);
    const newConfig = await newTokenRes.json();
    expect(newConfig.theme).toBe("streamfi"); // Preserved configuration
  });

  it("updates overlay appearance settings via PATCH", async () => {
    const userId = "creator_test_overlay_user";

    const updateRes = await patchOverlay(
      makePatchReq(
        {
          theme: "cyberpunk",
          position: "top-left",
          font_size: 22,
          opacity: 0.8,
        },
        userId
      )
    );
    expect(updateRes.status).toBe(200);

    // Fetch public overlay to verify changes are reflected
    const res = await getOverlay(makeGetReq(validTestToken));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.theme).toBe("cyberpunk");
    expect(data.position).toBe("top-left");
    expect(data.fontSize).toBe(22);
    expect(data.opacity).toBe(0.8);
    expect(data.primary_color).toBe("#00ffcc");
  });

  it("rejects unauthorized token rotation or settings modification", async () => {
    const rotateRes = await rotateTokenPost(makeTokenReq());
    expect(rotateRes.status).toBe(401);

    const patchRes = await patchOverlay(makePatchReq({ theme: "dark" }));
    expect(patchRes.status).toBe(401);
  });
});
