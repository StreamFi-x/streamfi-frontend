/**
 * @jest-environment node
 *
 * Every application write to users.sociallinks / creator / notifications goes
 * through the contracts in lib/db/jsonb-contracts.ts (#1407). These tests hit
 * each write boundary with valid, invalid and legacy input.
 */
import { NextRequest } from "next/server";
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => async () => false,
}));
jest.mock("@/utils/validators", () => ({
  validateEmail: () => true,
  checkExistingTableDetail: jest.fn(async () => false),
}));
jest.mock("@/utils/send-email", () => ({
  sendWelcomeRegistrationEmail: jest.fn(async () => true),
}));
jest.mock("@/lib/profile-icons", () => ({
  getRandomProfileIcon: () => "/icons/1.svg",
}));
jest.mock("@/lib/mux/server", () => ({
  createMuxStream: jest.fn(async () => ({
    id: "ls-1",
    playbackId: "pb-1",
    streamKey: "key-1",
    rtmpUrl: "rtmp://x",
  })),
  updateMuxStreamRecording: jest.fn(async () => ({ success: true })),
}));
jest.mock("@/lib/cache/invalidation", () => ({
  invalidateUserCaches: jest.fn(),
}));
jest.mock("@/utils/upload/cloudinary", () => ({
  uploadImage: jest.fn(),
  uploadImageFromBuffer: jest.fn(),
  deleteImage: jest.fn(),
  extractPublicIdFromUrl: jest.fn(() => null),
}));

import { createMuxStream } from "@/lib/mux/server";
import { POST as register } from "@/app/api/users/register/route";
import { PUT as updateProfile } from "@/app/api/users/updates/[wallet]/route";
import { PATCH as updateStream } from "@/app/api/streams/update/route";
import { PATCH as updateCreator } from "@/app/api/users/update-creator/route";
import { POST as postNotification } from "@/app/api/users/notifications/route";
import { writeNotification } from "@/lib/notifications";

const WALLET = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";

function jsonRequest(url: string, method: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(url: string, fields: Record<string, string>) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  return new NextRequest(`http://localhost${url}`, {
    method: "PUT",
    body: form,
  });
}

beforeEach(() => {
  mockDb.reset();
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/users/register", () => {
  const base = { email: "a@b.io", username: "alice", wallet: WALLET };

  beforeEach(() => {
    process.env.MUX_TOKEN_ID = "id";
    process.env.MUX_TOKEN_SECRET = "secret";
    mockDb.on(/SELECT id FROM users WHERE LOWER\(username\)/, { rows: [] });
    mockDb.on(/INSERT INTO users/, { rowCount: 1 });
  });

  it("rejects an invalid socialLinks document before creating a Mux stream", async () => {
    const res = await register(
      jsonRequest("/api/users/register", "POST", {
        ...base,
        socialLinks: { twitter: "javascript:alert(1)" },
      })
    );
    expect(res.status).toBe(400);
    expect(createMuxStream).not.toHaveBeenCalled();
    expect(mockDb.callsMatching(/INSERT INTO users/)).toHaveLength(0);
  });

  it("rejects a creator document with a wrong type", async () => {
    const res = await register(
      jsonRequest("/api/users/register", "POST", {
        ...base,
        creator: { streamTitle: "x", tags: "a,b" },
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid creator");
  });

  it("stores the default [] and legacy arrays as the canonical map", async () => {
    const res = await register(
      jsonRequest("/api/users/register", "POST", {
        ...base,
        socialLinks: [{ socialTitle: "X", socialLink: "https://x.com/alice" }],
      })
    );
    expect(res.status).toBe(200);
    const insert = mockDb.callsMatching(/INSERT INTO users/)[0];
    expect(insert.values).toContain(
      JSON.stringify({ twitter: "https://x.com/alice" })
    );
  });
});

describe("PUT /api/users/updates/[wallet]", () => {
  const params = { params: Promise.resolve({ wallet: WALLET }) };

  beforeEach(() => {
    mockDb.on(/SELECT id, username, email, bio/, {
      rows: [
        {
          id: "u1",
          username: "alice",
          email: "a@b.io",
          sociallinks: [{ socialTitle: "x", socialLink: "https://x.com/a" }],
          creator: { streamTitle: "old" },
          enable_recording: false,
          mux_stream_id: null,
          wallet: WALLET,
        },
      ],
    });
    mockDb.on(/UPDATE users SET/, { rows: [{ id: "u1" }] });
  });

  it("rejects malformed JSON and invalid shapes with 400 and no write", async () => {
    const invalid: Array<Record<string, string>> = [
      { socialLinks: "{not json" },
      { socialLinks: JSON.stringify({ x: 1 }) },
      { creator: JSON.stringify({ tags: "nope" }) },
    ];
    for (const fields of invalid) {
      const res = await updateProfile(
        formRequest(`/api/users/updates/${WALLET}`, fields),
        params
      );
      expect(res.status).toBe(400);
    }
    expect(mockDb.callsMatching(/UPDATE users SET/)).toHaveLength(0);
  });

  it("writes validated documents and leaves absent fields untouched", async () => {
    const res = await updateProfile(
      formRequest(`/api/users/updates/${WALLET}`, {
        socialLinks: JSON.stringify({ twitter: "https://x.com/alice" }),
      }),
      params
    );
    expect(res.status).toBe(200);
    const update = mockDb.callsMatching(/UPDATE users SET/)[0];
    expect(update.text).toMatch(
      /sociallinks = COALESCE\(\$\?::jsonb, sociallinks\)/
    );
    expect(update.text).toMatch(/creator = COALESCE\(\$\?::jsonb, creator\)/);
    expect(update.values).toContain(
      JSON.stringify({ twitter: "https://x.com/alice" })
    );
    // creator was not submitted: NULL keeps the stored document.
    expect(update.values.filter(v => v === null).length).toBeGreaterThan(0);
  });
});

describe("PATCH /api/streams/update (partial creator update)", () => {
  it("merges a validated patch in SQL", async () => {
    mockDb.on(/SELECT id, username, mux_stream_id, creator/, {
      rows: [{ id: "u1", mux_stream_id: "ls", creator: { streamTitle: "a" } }],
    });
    mockDb.on(/UPDATE users SET/, {
      rows: [{ creator: { streamTitle: "New", category: "Music" } }],
    });

    const res = await updateStream(
      jsonRequest("/api/streams/update", "PATCH", {
        wallet: WALLET,
        title: "New",
        category: "Music",
      })
    );
    expect(res.status).toBe(200);
    const update = mockDb.callsMatching(/UPDATE users SET/)[0];
    expect(update.text).toMatch(
      /COALESCE\(creator, '\{\}'::jsonb\) \|\| \$\?::jsonb/
    );
    expect(update.text).toMatch(/jsonb_typeof\(creator\) = 'object'/);
    const patch = JSON.parse(String(update.values[0]));
    expect(patch).toMatchObject({ streamTitle: "New", category: "Music" });
    expect(patch).not.toHaveProperty("tags");
  });

  it("rejects an invalid patch", async () => {
    mockDb.on(/SELECT id, username, mux_stream_id, creator/, {
      rows: [{ id: "u1", mux_stream_id: "ls", creator: {} }],
    });
    const res = await updateStream(
      jsonRequest("/api/streams/update", "PATCH", {
        wallet: WALLET,
        tags: "not-an-array",
      })
    );
    expect(res.status).toBe(400);
    expect(mockDb.callsMatching(/UPDATE users SET/)).toHaveLength(0);
  });

  it("refuses to merge into a malformed stored document", async () => {
    mockDb.on(/SELECT id, username, mux_stream_id, creator/, {
      rows: [{ id: "u1", mux_stream_id: "ls", creator: ["legacy", "array"] }],
    });
    mockDb.on(/UPDATE users SET/, { rows: [] });
    const res = await updateStream(
      jsonRequest("/api/streams/update", "PATCH", {
        wallet: WALLET,
        title: "New",
      })
    );
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/users/update-creator (full replace)", () => {
  it("rejects an invalid document and writes a valid one", async () => {
    mockDb.on(/UPDATE users/, { rowCount: 1 });
    const bad = await updateCreator(
      jsonRequest("/api/users/update-creator", "PATCH", {
        email: "a@b.io",
        creator: { tags: [1, 2] },
      }) as unknown as Request
    );
    expect(bad.status).toBe(400);

    const good = await updateCreator(
      jsonRequest("/api/users/update-creator", "PATCH", {
        email: "a@b.io",
        creator: { streamTitle: "Hi", tags: ["a"] },
      }) as unknown as Request
    );
    expect(good.status).toBe(200);
    expect(JSON.parse(String(mockDb.calls[0].values[0]))).toEqual({
      streamTitle: "Hi",
      tags: ["a"],
      category: "",
      payout: "",
      thumbnail: "",
    });
  });
});

describe("notifications writes", () => {
  it("writeNotification appends a validated element", async () => {
    mockDb.on(/UPDATE users/, { rowCount: 1 });
    await writeNotification("u1", "follow", "New follower", "b followed you");
    const [call] = mockDb.calls;
    const element = JSON.parse(String(call.values[0]));
    expect(element).toMatchObject({
      type: "follow",
      title: "New follower",
      read: false,
    });
    expect(call.text).toMatch(/deleted_at IS NULL/);
  });

  it("writeNotification refuses an invalid element before touching the DB", async () => {
    await expect(
      writeNotification("u1", "follow", "", "text")
    ).rejects.toThrow();
    expect(mockDb.calls).toHaveLength(0);
  });

  it("POST /api/users/notifications rejects unknown types", async () => {
    process.env.INTERNAL_API_SECRET = "internal";
    const req = new NextRequest("http://localhost/api/users/notifications", {
      method: "POST",
      headers: { "x-internal-secret": "internal" },
      body: JSON.stringify({
        recipientId: "u1",
        type: "mention",
        title: "t",
        text: "x",
      }),
    });
    const res = await postNotification(req);
    expect(res.status).toBe(400);
    expect(mockDb.calls).toHaveLength(0);
  });
});
