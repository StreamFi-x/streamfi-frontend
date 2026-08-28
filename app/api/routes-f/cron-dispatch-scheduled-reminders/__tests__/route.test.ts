/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as store from "../store";
import { getStore, resetStore, REFERENCE_NOW } from "../store";

jest.mock("../store", () => {
  const actual = jest.requireActual("../store");
  return { ...actual, getStore: jest.fn(actual.getStore) };
});

const ORIGINAL_ENV = process.env;

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/cron-dispatch-scheduled-reminders",
    {
      method: "POST",
      headers,
    }
  );
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, CRON_SECRET: "test-cron-secret" };
  jest.useFakeTimers();
  jest.setSystemTime(new Date(REFERENCE_NOW));
  resetStore();
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/routes-f/cron-dispatch-scheduled-reminders", () => {
  it("rejects requests without the correct CRON_SECRET bearer token", async () => {
    const res = await POST(req({ authorization: "Bearer nope" }));
    expect(res.status).toBe(401);
  });

  it("rejects requests missing the authorization header entirely", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("dispatches only reminders firing within the next hour bucket", async () => {
    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.bucket_window_minutes).toBe(60);
    expect(data.dispatched_count).toBe(2);
    expect(data.dispatched.map((d: { id: string }) => d.id).sort()).toEqual([
      "rem_in_bucket_1",
      "rem_in_bucket_2",
    ]);
  });

  it("does not dispatch a reminder that is already past due", async () => {
    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data = await res.json();

    expect(
      data.dispatched.some((d: { id: string }) => d.id === "rem_past_due")
    ).toBe(false);
  });

  it("does not dispatch a reminder beyond the one-hour window", async () => {
    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data = await res.json();

    expect(
      data.dispatched.some((d: { id: string }) => d.id === "rem_beyond_bucket")
    ).toBe(false);
  });

  it("skips a reminder that was already dispatched", async () => {
    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data = await res.json();

    expect(
      data.dispatched.some((d: { id: string }) => d.id === "rem_already_dispatched")
    ).toBe(false);
  });

  it("marks dispatched reminders in the store so they're not sent twice", async () => {
    await POST(req({ authorization: "Bearer test-cron-secret" }));

    const store = getStore();
    const inBucket1 = store.find((r) => r.id === "rem_in_bucket_1")!;
    expect(inBucket1.dispatched).toBe(true);
    expect(inBucket1.dispatched_at).not.toBeNull();
  });

  it("is idempotent — running twice dispatches nothing new the second time", async () => {
    await POST(req({ authorization: "Bearer test-cron-secret" }));
    const res2 = await POST(req({ authorization: "Bearer test-cron-secret" }));
    const data2 = await res2.json();

    expect(data2.dispatched_count).toBe(0);
  });

  it("returns 500 when dispatch throws", async () => {
    (store.getStore as jest.Mock).mockImplementationOnce(() => {
      throw new Error("store unavailable");
    });

    const res = await POST(req({ authorization: "Bearer test-cron-secret" }));
    expect(res.status).toBe(500);
  });
});
