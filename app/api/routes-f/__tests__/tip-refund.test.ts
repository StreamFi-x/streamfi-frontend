/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST as postRequest, refundRequests } from "../tip-refund/route";
import { POST as postResolve } from "../tip-refund/resolve/route";

function makePost(url: string, body: object) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const BASE = "http://localhost/api/routes-f/tip-refund";
const RESOLVE = "http://localhost/api/routes-f/tip-refund/resolve";

describe("Tip Refund API", () => {
  beforeEach(() => {
    refundRequests.length = 0;
  });

  describe("POST /api/routes-f/tip-refund", () => {
    it("returns 400 for missing fields", async () => {
      const res = await postRequest(makePost(BASE, {}));
      expect(res.status).toBe(400);
    });

    it("returns 404 for unknown tip", async () => {
      const res = await postRequest(makePost(BASE, { tip_id: "bad-tip", tipper_id: "viewer-1", reason: "wrong amount" }));
      expect(res.status).toBe(404);
    });

    it("returns 400 for tip older than 24h", async () => {
      const res = await postRequest(makePost(BASE, { tip_id: "tip-003", tipper_id: "viewer-3", reason: "expired" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/24 hours/);
    });

    it("returns 403 if tipper_id does not match", async () => {
      const res = await postRequest(makePost(BASE, { tip_id: "tip-001", tipper_id: "wrong-viewer", reason: "test" }));
      expect(res.status).toBe(403);
    });

    it("creates a pending refund request", async () => {
      const res = await postRequest(makePost(BASE, { tip_id: "tip-001", tipper_id: "viewer-1", reason: "sent too much" }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.status).toBe("pending");
      expect(body.request_id).toBeDefined();
    });
  });

  describe("POST /api/routes-f/tip-refund/resolve", () => {
    it("returns 400 for missing fields", async () => {
      const res = await postResolve(makePost(RESOLVE, {}));
      expect(res.status).toBe(400);
    });

    it("returns 404 for unknown request_id", async () => {
      const res = await postResolve(makePost(RESOLVE, { request_id: "req-9999", decision: "approve", creator_id: "creator-1" }));
      expect(res.status).toBe(404);
    });

    it("approves a refund request", async () => {
      await postRequest(makePost(BASE, { tip_id: "tip-001", tipper_id: "viewer-1", reason: "test" }));
      const reqId = refundRequests[0].request_id;
      const res = await postResolve(makePost(RESOLVE, { request_id: reqId, decision: "approve", creator_id: "creator-1", note: "ok" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.decision).toBe("approve");
      expect(body.note).toBe("ok");
    });

    it("denies a refund request", async () => {
      await postRequest(makePost(BASE, { tip_id: "tip-002", tipper_id: "viewer-2", reason: "test" }));
      const reqId = refundRequests[0].request_id;
      const res = await postResolve(makePost(RESOLVE, { request_id: reqId, decision: "deny", creator_id: "creator-1" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.decision).toBe("deny");
    });

    it("returns 409 if already resolved", async () => {
      await postRequest(makePost(BASE, { tip_id: "tip-001", tipper_id: "viewer-1", reason: "test" }));
      const reqId = refundRequests[0].request_id;
      await postResolve(makePost(RESOLVE, { request_id: reqId, decision: "approve", creator_id: "creator-1" }));
      const res = await postResolve(makePost(RESOLVE, { request_id: reqId, decision: "deny", creator_id: "creator-1" }));
      expect(res.status).toBe(409);
    });
  });
});
