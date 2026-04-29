/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/random-paragraph", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/random-paragraph", () => {
  it.each(["technical", "casual", "formal", "news"])(
    "generates %s paragraphs",
    async (style) => {
      const res = await POST(makeReq({ style, seed: 12 }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.paragraphs).toHaveLength(1);
      expect(body.paragraphs[0].split(". ").length).toBeGreaterThanOrEqual(3);
      expect(body.paragraphs[0].split(". ").length).toBeLessThanOrEqual(7);
    },
  );

  it("honors count", async () => {
    const res = await POST(makeReq({ count: 4, style: "news", seed: 7 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.paragraphs).toHaveLength(4);
  });

  it("is deterministic with the same seed", async () => {
    const payload = { count: 3, style: "formal", seed: "stable-seed" };
    const first = await POST(makeReq(payload));
    const second = await POST(makeReq(payload));

    expect(await first.json()).toEqual(await second.json());
  });

  it("rejects counts above the maximum", async () => {
    const res = await POST(makeReq({ count: 21 }));

    expect(res.status).toBe(400);
  });
});
