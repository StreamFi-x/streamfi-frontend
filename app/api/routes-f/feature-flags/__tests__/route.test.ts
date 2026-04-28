import { GET, PUT, DELETE } from "../route";
import { isEnabledForUser } from "../_lib/store";
import type { FeatureFlag } from "../_lib/types";
import { NextRequest } from "next/server";

function makeGet(path: string): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/feature-flags${path}`);
}

function makePut(body: object): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/feature-flags", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDelete(key: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/feature-flags?key=${encodeURIComponent(key)}`,
    { method: "DELETE" },
  );
}

describe("PUT /api/routes-f/feature-flags", () => {
  it("creates a new flag", async () => {
    const res = await PUT(makePut({ key: "test-flag", enabled: true, rollout_percent: 50 }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.flag.key).toBe("test-flag");
    expect(data.flag.rollout_percent).toBe(50);
  });

  it("updates an existing flag", async () => {
    await PUT(makePut({ key: "update-flag", enabled: true }));
    const res = await PUT(makePut({ key: "update-flag", enabled: false }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.flag.enabled).toBe(false);
  });

  it("defaults rollout_percent to 100", async () => {
    await PUT(makePut({ key: "default-pct", enabled: true }));
    const res = await GET(makeGet("?key=default-pct"));
    const data = await res.json();
    expect(data.flag.rollout_percent).toBe(100);
  });

  it("rejects missing key", async () => {
    const res = await PUT(makePut({ enabled: true }));
    expect(res.status).toBe(400);
  });

  it("rejects non-boolean enabled", async () => {
    const res = await PUT(makePut({ key: "x", enabled: "yes" }));
    expect(res.status).toBe(400);
  });

  it("rejects rollout_percent out of range", async () => {
    const res = await PUT(makePut({ key: "x", enabled: true, rollout_percent: 150 }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/feature-flags", {
      method: "PUT",
      body: "not-json",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/routes-f/feature-flags", () => {
  it("returns all flags", async () => {
    const res = await GET(makeGet(""));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.flags)).toBe(true);
  });

  it("returns a single flag by key", async () => {
    await PUT(makePut({ key: "get-single", enabled: true, rollout_percent: 30 }));
    const res = await GET(makeGet("?key=get-single"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.flag.key).toBe("get-single");
  });

  it("returns 404 for unknown flag", async () => {
    const res = await GET(makeGet("?key=does-not-exist-xyz"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/routes-f/feature-flags", () => {
  it("deletes an existing flag", async () => {
    await PUT(makePut({ key: "del-flag", enabled: true }));
    const res = await DELETE(makeDelete("del-flag"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(true);
  });

  it("returns 404 for unknown flag", async () => {
    const res = await DELETE(makeDelete("ghost-flag-xyz"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when key is missing", async () => {
    const res = await DELETE(new NextRequest(
      "http://localhost/api/routes-f/feature-flags",
      { method: "DELETE" },
    ));
    expect(res.status).toBe(400);
  });
});

describe("isEnabledForUser — rollout bucketing", () => {
  const flag: FeatureFlag = {
    key: "rollout",
    enabled: true,
    rollout_percent: 50,
    created_at: "",
    updated_at: "",
  };

  it("is deterministic for the same userId", () => {
    const r1 = isEnabledForUser(flag, "user-abc");
    const r2 = isEnabledForUser(flag, "user-abc");
    expect(r1).toBe(r2);
  });

  it("disabled flag always returns false", () => {
    const disabled = { ...flag, enabled: false };
    expect(isEnabledForUser(disabled, "user-abc")).toBe(false);
  });

  it("100% rollout always returns true", () => {
    const full = { ...flag, rollout_percent: 100 };
    expect(isEnabledForUser(full, "anyone")).toBe(true);
  });

  it("0% rollout always returns false", () => {
    const none = { ...flag, rollout_percent: 0 };
    expect(isEnabledForUser(none, "anyone")).toBe(false);
  });

  it("roughly 50% of users are enabled at 50% rollout", () => {
    const users = Array.from({ length: 200 }, (_, i) => `user-${i}`);
    const enabled = users.filter((u) => isEnabledForUser(flag, u)).length;
    // Allow ±20% tolerance
    expect(enabled).toBeGreaterThan(60);
    expect(enabled).toBeLessThan(140);
  });
});
