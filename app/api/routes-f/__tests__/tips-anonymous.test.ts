/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../tips/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/tips", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/tips", () => {
  describe("POST", () => {
    it("toggles anonymous flag on a tip", async () => {
      const req = makeReq({
        tip_id: "tip123",
        anonymous: true,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty("updated");
      expect(data.updated).toBe(true);
      expect(data.tip).toHaveProperty("anonymous");
    });

    it("accepts boolean toggle to false", async () => {
      const req = makeReq({
        tip_id: "tip456",
        anonymous: false,
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.updated).toBe(true);
      expect(data.tip.anonymous).toBe(false);
    });

    it("rejects missing tip_id", async () => {
      const req = makeReq({
        anonymous: true,
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects missing anonymous field", async () => {
      const req = makeReq({
        tip_id: "tip789",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects non-boolean anonymous", async () => {
      const req = makeReq({
        tip_id: "tip789",
        anonymous: "yes",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent tip", async () => {
      const req = makeReq({
        tip_id: "nonexistent",
        anonymous: true,
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
    });
  });
});
