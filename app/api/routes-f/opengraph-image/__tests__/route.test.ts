/**
 * @jest-environment node
 *
 * Only covers the request-validation path (no type/id, invalid type) —
 * ImageResponse itself does real font shaping via Satori and isn't
 * meaningfully unit-testable in isolation, matching every other
 * ImageResponse route in this repo (e.g. preview/placeholder/route.tsx),
 * none of which have tests either. The data-resolution logic that decides
 * *what* gets rendered is covered separately and thoroughly in
 * resolve.test.ts.
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

function req(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/opengraph-image${query}`);
}

describe("GET /api/routes-f/opengraph-image", () => {
  it("returns 400 when type is missing", async () => {
    const res = await GET(req("?id=moonshot_dev"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when type is invalid", async () => {
    const res = await GET(req("?type=stream&id=moonshot_dev"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when id is missing", async () => {
    const res = await GET(req("?type=channel"));
    expect(res.status).toBe(400);
  });
});
