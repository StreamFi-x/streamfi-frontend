/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT, preferencesStore } from "../route";

const BASE_URL = "http://localhost/api/routes-f/notifications/preferences";

const FOLLOWER_ID = "f0110000-0000-4000-8000-000000000001";
const CREATOR_ID = "c0110000-0000-4000-8000-000000000002";
const OTHER_CREATOR = "c0110000-0000-4000-8000-000000000003";

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

describe("GET + PUT /api/routes-f/notifications/preferences", () => {
  beforeEach(() => {
    preferencesStore.clear();
  });

  // -------------------------------------------------------------------------
  // GET
  // -------------------------------------------------------------------------
  describe("GET", () => {
    it("returns defaults (both true) when no preference has been stored", async () => {
      const res = await GET(
        makeGetReq({ follower_id: FOLLOWER_ID, creator_id: CREATOR_ID })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ notify_live: true, notify_vods: true });
    });

    it("returns stored preference after a PUT", async () => {
      // PUT first
      await PUT(
        makePutReq({
          follower_id: FOLLOWER_ID,
          creator_id: CREATOR_ID,
          notify_live: false,
          notify_vods: true,
        })
      );

      const res = await GET(
        makeGetReq({ follower_id: FOLLOWER_ID, creator_id: CREATOR_ID })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ notify_live: false, notify_vods: true });
    });

    it("400 — missing follower_id", async () => {
      const res = await GET(makeGetReq({ creator_id: CREATOR_ID }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    });

    it("400 — missing creator_id", async () => {
      const res = await GET(makeGetReq({ follower_id: FOLLOWER_ID }));
      expect(res.status).toBe(400);
    });

    it("400 — both params missing", async () => {
      const res = await GET(makeGetReq({}));
      expect(res.status).toBe(400);
    });

    it("isolates preferences per creator — defaults still apply for an unset creator", async () => {
      // Store prefs for CREATOR_ID
      await PUT(
        makePutReq({
          follower_id: FOLLOWER_ID,
          creator_id: CREATOR_ID,
          notify_live: false,
          notify_vods: false,
        })
      );

      // OTHER_CREATOR should still have defaults
      const res = await GET(
        makeGetReq({ follower_id: FOLLOWER_ID, creator_id: OTHER_CREATOR })
      );
      const body = await res.json();
      expect(body).toEqual({ notify_live: true, notify_vods: true });
    });
  });

  // -------------------------------------------------------------------------
  // PUT
  // -------------------------------------------------------------------------
  describe("PUT", () => {
    it("stores and returns the updated preferences", async () => {
      const res = await PUT(
        makePutReq({
          follower_id: FOLLOWER_ID,
          creator_id: CREATOR_ID,
          notify_live: false,
          notify_vods: true,
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ notify_live: false, notify_vods: true });
    });

    it("partial update merges with existing — unset fields keep their prior value", async () => {
      // Set both to false
      await PUT(
        makePutReq({
          follower_id: FOLLOWER_ID,
          creator_id: CREATOR_ID,
          notify_live: false,
          notify_vods: false,
        })
      );

      // Update only notify_live
      const res = await PUT(
        makePutReq({
          follower_id: FOLLOWER_ID,
          creator_id: CREATOR_ID,
          notify_live: true,
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ notify_live: true, notify_vods: false });
    });

    it("subsequent GET reflects the PUT change", async () => {
      await PUT(
        makePutReq({
          follower_id: FOLLOWER_ID,
          creator_id: CREATOR_ID,
          notify_live: false,
          notify_vods: false,
        })
      );

      const res = await GET(
        makeGetReq({ follower_id: FOLLOWER_ID, creator_id: CREATOR_ID })
      );
      const body = await res.json();
      expect(body).toEqual({ notify_live: false, notify_vods: false });
    });

    it("400 — missing follower_id", async () => {
      const res = await PUT(
        makePutReq({ creator_id: CREATOR_ID, notify_live: false })
      );
      expect(res.status).toBe(400);
    });

    it("400 — missing creator_id", async () => {
      const res = await PUT(
        makePutReq({ follower_id: FOLLOWER_ID, notify_live: false })
      );
      expect(res.status).toBe(400);
    });

    it("400 — notify_live is not a boolean", async () => {
      const res = await PUT(
        makePutReq({
          follower_id: FOLLOWER_ID,
          creator_id: CREATOR_ID,
          notify_live: "yes",
        })
      );
      expect(res.status).toBe(400);
    });
  });
});
