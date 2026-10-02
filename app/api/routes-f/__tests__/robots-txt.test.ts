/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../robots-txt/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/robots-txt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/robots-txt", () => {
  it("generates robots.txt for multiple agents", async () => {
    const res = await POST(
      makeReq({
        rules: [
          { user_agent: "*", allow: ["/"], disallow: ["/private"] },
          { user_agent: "Googlebot", disallow: ["/no-google"] },
        ],
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.robots_txt).toBe(
      "User-agent: *\nAllow: /\nDisallow: /private\n\nUser-agent: Googlebot\nDisallow: /no-google\n"
    );
  });

  it("includes a sitemap line when provided", async () => {
    const res = await POST(
      makeReq({
        rules: [{ user_agent: "*", disallow: ["/drafts"] }],
        sitemap: "https://example.com/sitemap.xml",
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.robots_txt).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("rejects requests without at least one rule", async () => {
    const res = await POST(makeReq({ rules: [] }));
    expect(res.status).toBe(400);
  });
});
