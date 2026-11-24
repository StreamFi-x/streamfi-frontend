/**
 * @jest-environment node
 *
 * #1720 / #1721 / #1859 / #1860: the debug endpoints used to run destructive
 * DDL and leak a live API key prefix to unauthenticated callers, and were
 * reachable in production builds. They are now excluded in production
 * (returning 404 Not Found across route handlers, proxy, and Next.js rewrites),
 * gated by a shared secret in non-production (#1612), and the key preview is
 * gone. These tests lock that in.
 */
import { NextRequest } from "next/server";
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));

import { GET as clearUsersRoute } from "@/app/api/debug/clear-users/route";
import { GET as envRoute } from "@/app/api/debug/env/route";
import { GET as migrateChatRoute } from "@/app/api/debug/migrate-chat/route";
import nextConfig from "@/next.config.js";
import { proxy } from "@/proxy";

const SECRET = "debug-secret-value";
const LEAKY_KEY = "lp_live_abcdefgh1234567890";

const routes = [
  ["debug/env", "/api/debug/env", envRoute, "DEBUG_ENV_SECRET"],
  [
    "debug/migrate-chat",
    "/api/debug/migrate-chat",
    migrateChatRoute,
    "MIGRATE_CHAT_SECRET",
  ],
  [
    "debug/clear-users",
    "/api/debug/clear-users",
    clearUsersRoute,
    "CLEAR_USERS_SECRET",
  ],
] as const;

const saved: Record<string, string | undefined> = {};
const KEYS = [
  "DEBUG_ENV_SECRET",
  "MIGRATE_CHAT_SECRET",
  "CLEAR_USERS_SECRET",
  "LIVEPEER_API_KEY",
  "NODE_ENV",
];

beforeEach(() => {
  mockDb.reset();
  for (const key of KEYS) {
    saved[key] = process.env[key];
    if (key !== "NODE_ENV") {
      delete process.env[key];
    }
  }
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.LIVEPEER_API_KEY = LEAKY_KEY;
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      (process.env as Record<string, string | undefined>)[key] = saved[key];
    }
  }
});

describe.each(routes)("%s", (_name, path, handler, envVar) => {
  const call = (query = "") =>
    handler(new Request(`http://localhost${path}${query}`));

  it("returns 404 Not Found in production even when the valid secret is supplied (#1720)", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env[envVar] = SECRET;

    const res = await call(`?secret=${SECRET}`);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not Found" });
    expect(mockDb.calls).toHaveLength(0);
  });

  it("returns 404 Not Found in production without a secret (#1720)", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    const res = await call();

    expect(res.status).toBe(404);
    expect(mockDb.calls).toHaveLength(0);
  });

  it("returns 403 on a bare GET when its secret is configured", async () => {
    process.env[envVar] = SECRET;

    const res = await call();

    expect(res.status).toBe(403);
    expect(mockDb.calls).toHaveLength(0);
  });

  it("returns 403 for a wrong secret", async () => {
    process.env[envVar] = SECRET;

    const res = await call("?secret=wrong");

    expect(res.status).toBe(403);
    expect(mockDb.calls).toHaveLength(0);
  });

  it("fails closed with 403 when no secret is configured, even if one is guessed", async () => {
    const res = await call("?secret=");

    expect(res.status).toBe(403);
    expect(mockDb.calls).toHaveLength(0);
  });

  it("never echoes the configured secret or any API key material in a rejection", async () => {
    process.env[envVar] = SECRET;

    const text = await (await call("?secret=wrong")).text();

    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(LEAKY_KEY.slice(0, 8));
  });
});

describe("production debug route exclusion (#1720)", () => {
  it("proxy blocks /api/debug/* with 404 in production", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    const res = proxy(
      new NextRequest("https://streamfi.media/api/debug/env?secret=any")
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });

  it("next.config.js rewrites /api/debug/:path* to /404 in production builds", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    const rewrites = await nextConfig.rewrites!();
    expect(rewrites).toEqual({
      beforeFiles: [
        {
          source: "/api/debug/:path*",
          destination: "/404",
        },
      ],
    });
  });

  it("next.config.js does not rewrite /api/debug/:path* in non-production builds", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV =
      "development";

    const rewrites = await nextConfig.rewrites!();
    expect(rewrites).toEqual([]);
  });
});

describe("debug/env (#1721, #1860)", () => {
  it("does not return any part of LIVEPEER_API_KEY, even to an authorized caller", async () => {
    process.env.DEBUG_ENV_SECRET = SECRET;

    const res = await envRoute(
      new Request(`http://localhost/api/debug/env?secret=${SECRET}`)
    );
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).not.toContain(LEAKY_KEY.slice(0, 8));
    expect(text).not.toMatch(/LIVEPEER/i);
  });

  it("only reports booleans and NODE_ENV, with no lengths or key previews", async () => {
    process.env.DEBUG_ENV_SECRET = SECRET;

    const res = await envRoute(
      new Request(`http://localhost/api/debug/env?secret=${SECRET}`)
    );
    const body = await res.json();

    expect(Object.keys(body.environment).sort()).toEqual([
      "NODE_ENV",
      "POSTGRES_URL",
    ]);
    expect(typeof body.environment.POSTGRES_URL).toBe("boolean");
  });
});

describe("removed debug routes (#1720, #1859)", () => {
  it("debug/fix-db no longer exists as a route", () => {
    expect(() => require("@/app/api/debug/fix-db/route")).toThrow();
  });

  it("debug/user-stream no longer exists as a route", () => {
    expect(() => require("@/app/api/debug/user-stream/route")).toThrow();
  });
});
