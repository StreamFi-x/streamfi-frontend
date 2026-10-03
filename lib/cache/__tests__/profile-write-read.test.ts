/**
 * @jest-environment node
 *
 * End-to-end through real route handlers: a cached public profile read,
 * a profile write, and the read after it. The database is a tiny fake that
 * understands the three statements involved.
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("next/cache", () => ({ revalidateTag: jest.fn() }));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { revalidateTag } from "next/cache";
import { resetAppCacheForTests } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { GET as getProfile } from "@/app/api/users/[username]/route";
import { PATCH as patchBio } from "@/app/api/routes-f/profile-update-bio/route";

const sqlMock = sql as unknown as jest.Mock;
const row = { id: "u1", username: "alice", wallet: "GALICE", bio: "old bio" };
let profileReads = 0;

function fakeDb(strings: TemplateStringsArray, ...values: unknown[]) {
  const text = strings.join("?");
  if (text.includes("follower_count")) {
    profileReads += 1;
    return Promise.resolve({ rows: values[0] === "alice" ? [{ ...row }] : [] });
  }
  if (text.includes("UPDATE users") && text.includes("SET bio")) {
    row.bio = String(values[0]);
    return Promise.resolve({ rows: [{ ...row }] });
  }
  if (text.includes("SELECT username, wallet FROM users")) {
    return Promise.resolve({
      rows: [{ username: row.username, wallet: row.wallet }],
    });
  }
  throw new Error(`unexpected query: ${text}`);
}

const read = async () => {
  const res = await getProfile(
    new Request("http://localhost/api/users/Alice"),
    {
      params: Promise.resolve({ username: "Alice" }),
    }
  );
  return { res, body: await res.json() };
};

describe("profile cache: write followed by read", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    resetAppCacheForTests();
    sqlMock.mockReset().mockImplementation(fakeDb);
    profileReads = 0;
    row.bio = "old bio";
  });

  it("serves repeat reads from cache, then fresh data after the write", async () => {
    expect((await read()).body.user.bio).toBe("old bio");
    expect((await read()).body.user.bio).toBe("old bio");
    expect(profileReads).toBe(1);

    const write = await patchBio(
      new NextRequest("http://localhost/api/routes-f/profile-update-bio", {
        method: "PATCH",
        body: JSON.stringify({ username: "alice", bio: "new bio" }),
      })
    );
    expect(write.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith(cacheTags.userByName("alice"), {
      expire: 0,
    });

    const after = await read();
    expect(after.body.user.bio).toBe("new bio");
    expect(profileReads).toBe(2);
    expect(after.res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=5, stale-while-revalidate=10"
    );
  });

  it("does not cache a 404, so a user created later is visible at once", async () => {
    sqlMock.mockImplementation(() => Promise.resolve({ rows: [] }));
    expect((await read()).res.status).toBe(404);

    sqlMock.mockImplementation(fakeDb);
    expect((await read()).res.status).toBe(200);
  });
});
