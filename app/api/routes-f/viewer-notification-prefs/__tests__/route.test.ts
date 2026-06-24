/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT, prefsStore } from "../route";

const BASE_URL =
  "http://localhost/api/routes-f/viewer-notification-prefs";

const VIEWER_A = "viewer-aaa-0001";
const VIEWER_B = "viewer-bbb-0002";

function makeGetReq(params: Record<string, string>) {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

function makePutReq(body: unknown) {
  return new NextRequest(BASE_URL, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET + PUT /api/routes-f/viewer-notification-prefs", () => {
  beforeEach(() => {
    prefsStore.clear();
  });

  // -------------------------------------------------------------------------
  // Defaults
  // -------------------------------------------------------------------------
  describe("GET — defaults for a new viewer", () => {
    it("returns default prefs (live_alerts, tips_received, chat_mentions true; email_digest false)", async () => {
      const res = await GET(makeGetReq({ viewer_id: VIEWER_A }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        live_alerts: true,
        tips_received: true,
        chat_mentions: true,
        email_digest: false,
      });
    });

    it("isolates defaults per viewer", async () => {
      // Update A
      await PUT(makePutReq({ viewer_id: VIEWER_A, email_digest: true }));
      // B should still have defaults
      const res = await GET(makeGetReq({ viewer_id: VIEWER_B }));
      const body = await res.json();
      expect(body.email_digest).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Partial update
  // -------------------------------------------------------------------------
  describe("PUT — partial update", () => {
    it("partial update merges — unset fields keep prior value", async () => {
      // Set all to non-default
      await PUT(
        makePutReq({
          viewer_id: VIEWER_A,
          live_alerts: false,
          tips_received: false,
          chat_mentions: false,
          email_digest: true,
        })
      );

      // Update only live_alerts
      const res = await PUT(
        makePutReq({ viewer_id: VIEWER_A, live_alerts: true })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        live_alerts: true,
        tips_received: false,
        chat_mentions: false,
        email_digest: true,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Full update
  // -------------------------------------------------------------------------
  describe("PUT — full update", () => {
    it("stores and returns all updated preferences", async () => {
      const res = await PUT(
        makePutReq({
          viewer_id: VIEWER_A,
          live_alerts: false,
          tips_received: false,
          chat_mentions: true,
          email_digest: true,
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        live_alerts: false,
        tips_received: false,
        chat_mentions: true,
        email_digest: true,
      });
    });

    it("subsequent GET reflects the PUT change", async () => {
      await PUT(
        makePutReq({
          viewer_id: VIEWER_A,
          live_alerts: false,
          email_digest: true,
        })
      );
      const res = await GET(makeGetReq({ viewer_id: VIEWER_A }));
      const body = await res.json();
      expect(body.live_alerts).toBe(false);
      expect(body.email_digest).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Validation errors
  // -------------------------------------------------------------------------
  describe("400 errors", () => {
    it("GET — 400 when viewer_id is missing", async () => {
      const res = await GET(makeGetReq({}));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    });

    it("PUT — 400 when viewer_id is missing", async () => {
      const res = await PUT(makePutReq({ live_alerts: false }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    });

    it("PUT — 400 when live_alerts is not a boolean", async () => {
      const res = await PUT(
        makePutReq({ viewer_id: VIEWER_A, live_alerts: "yes" })
      );
      expect(res.status).toBe(400);
    });

    it("PUT — 400 when email_digest is not a boolean", async () => {
      const res = await PUT(
        makePutReq({ viewer_id: VIEWER_A, email_digest: 1 })
      );
      expect(res.status).toBe(400);
    });
  });
});
