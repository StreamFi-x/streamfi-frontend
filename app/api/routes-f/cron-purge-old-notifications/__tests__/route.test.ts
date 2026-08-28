/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as store from "../store";
import { getStore, resetStore } from "../store";

jest.mock("../store", () => {
  const actual = jest.requireActual("../store");
  return { ...actual, getStore: jest.fn(actual.getStore) };
});

const ORIGINAL_ENV = process.env;
const NOW = new Date("2026-08-28T00:00:00Z");

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/cron-purge-old-notifications",
    {
      method: "POST",
      headers,
    }
  );
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, CRON_SECRET: "test-cron-secret" };
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  resetStore();
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/routes-f/cron-purge-old-notifications", () => {
  it("rejects requests without the correct CRON_SECRET bearer token", async () => {
    const res = await POST(req({ authorization: "Bearer nope" }));
    expect(res.status).toBe(401);
  });

  it("rejects requests missing the authorization header entirely", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("removes only notifications that are both older than 90 days AND already read", async () => {
    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.max_age_days).toBe(90);
    expect(data.removed_count).toBe(2);
    expect(data.removed_ids.sort()).toEqual(["old_read_1", "old_read_2"]);
  });

  it("keeps old-but-unread notifications", async () => {
    await POST(req({ authorization: "Bearer test-cron-secret" }));

    const remaining = getStore().map((n) => n.id);
    expect(remaining).toContain("old_unread");
  });

  it("keeps recent notifications regardless of read state", async () => {
    await POST(req({ authorization: "Bearer test-cron-secret" }));

    const remaining = getStore().map((n) => n.id);
    expect(remaining).toContain("recent_read");
    expect(remaining).toContain("recent_unread");
  });

  it("actually shrinks the store, not just reports a count", async () => {
    const before = getStore().length;
    await POST(req({ authorization: "Bearer test-cron-secret" }));
    const after = getStore().length;

    expect(after).toBe(before - 2);
  });

  it("is idempotent — running twice removes nothing the second time", async () => {
    await POST(req({ authorization: "Bearer test-cron-secret" }));
    const res2 = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data2 = await res2.json();

    expect(data2.removed_count).toBe(0);
  });

  it("returns 500 when purging throws", async () => {
    (store.getStore as jest.Mock).mockImplementationOnce(() => {
      throw new Error("store unavailable");
    });

    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    expect(res.status).toBe(500);
  });
});
