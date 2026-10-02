import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/safety-list-check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Safety List Check API", () => {
  it("flags a viewer that is on the list", async () => {
    const res = await POST(makeReq({ viewer_id: "v_banned_001" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.on_list).toBe(true);
    expect(data.list_source).toBe("global-blocklist");
    expect(data.flagged_at).toBe("2026-01-14T09:30:00Z");
  });

  it("clears a viewer that is not on the list", async () => {
    const res = await POST(makeReq({ viewer_id: "v_regular_999" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.on_list).toBe(false);
    expect(data.list_source).toBeUndefined();
    expect(data.flagged_at).toBeUndefined();
  });

  it("scopes the check to a specific source when provided", async () => {
    const res = await POST(
      makeReq({ viewer_id: "v_banned_001", source: "fraud-net" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    // On the global blocklist, but not on fraud-net
    expect(data.on_list).toBe(false);
  });

  it("rejects an unknown source with 400", async () => {
    const res = await POST(
      makeReq({ viewer_id: "v_banned_001", source: "made-up-list" })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Unknown source");
  });

  it("rejects a missing viewer_id with 400", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("rejects an empty viewer_id with 400", async () => {
    const res = await POST(makeReq({ viewer_id: "" }));
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON with 400", async () => {
    const req = new NextRequest("http://localhost/api/routesF/safety-list-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
