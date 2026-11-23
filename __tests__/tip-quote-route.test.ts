/** @jest-environment node */
import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { POST } from "@/app/api/tips/get-quote/route";

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock("@/lib/tracing/trace-context", () => ({
  getCurrentTraceContext: () => undefined,
}));

const creatorId = "f4cd5d90-d0d3-4f2a-8f3b-b9c5c8b29ff8";
function request(cents: number) {
  return new NextRequest("http://localhost/api/tips/get-quote", {
    method: "POST",
    body: JSON.stringify({ fiat_amount_cents: cents, creator_id: creatorId }),
  });
}

afterEach(() => jest.restoreAllMocks());

it("stores the calculated quote and prevents caching", async () => {
  jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(Response.json({ price: 0.25 }));
  (sql as jest.Mock).mockResolvedValueOnce({ rows: [{ id: "quote-1" }] });
  const response = await POST(request(100));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({
    quote_id: "quote-1",
    quoted_xlm_amount: 4,
    ttl_seconds: 300,
  });
});

it("rejects invalid amounts and fails safely when the rate is unavailable", async () => {
  const fetch = jest
    .spyOn(global, "fetch")
    .mockRejectedValueOnce(new Error("offline"));
  expect((await POST(request(0))).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
  expect((await POST(request(100))).status).toBe(500);
  expect(sql).not.toHaveBeenCalled();
});
