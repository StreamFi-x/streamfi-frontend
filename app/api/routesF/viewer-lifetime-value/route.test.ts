import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/viewer-lifetime-value", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/viewer-lifetime-value", () => {
  it("returns known lifetime value metrics for a viewer", async () => {
    const res = await POST(
      makeReq({ viewer_id: "viewer-alpha", creator_id: "creator-alpha" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total_tips_usdc).toBe(30);
    expect(data.total_sub_months).toBe(3);
    expect(data.ltv_usdc).toBe(45);
    expect(data.cohort).toBe("steady");
  });

  it("returns zeroed metrics for an unseen viewer", async () => {
    const res = await POST(
      makeReq({ viewer_id: "viewer-novel", creator_id: "creator-alpha" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total_tips_usdc).toBe(0);
    expect(data.total_sub_months).toBe(0);
    expect(data.ltv_usdc).toBe(0);
    expect(data.cohort).toBe("new");
  });

  it("rejects requests without a viewer_id", async () => {
    const res = await POST(makeReq({ creator_id: "creator-alpha" }));

    expect(res.status).toBe(400);
  });
});
