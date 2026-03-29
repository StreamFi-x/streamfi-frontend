jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

import { sql } from "@vercel/postgres";
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;

const makeRequest = (body: object) =>
  new Request("http://localhost/api/routes-f/social/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;

describe("routes-f social share", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates Mux thumbnail metadata for clips", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "clip-1",
            playback_id: "mux-playback-id",
            title: "My clip",
            username: "creator",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ code: "Ab12Cd" }],
      });

    const res = await POST(
      makeRequest({
        item_id: "clip-1",
        item_type: "clip",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.short_url).toMatch(/^\/s\/[0-9A-Za-z]{6}$/);
    expect(body.og_image_url).toBe(
      "https://image.mux.com/mux-playback-id/thumbnail.jpg"
    );
    expect(body.twitter_card).toBe("summary_large_image");
  });
});
