/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { isActive, filterActiveSubscriptions, toActiveEntry } from "../utils";
import {
  getSubscriptionsForSubscriber,
  subscriptionRecordStore,
} from "../seedData";

function makeReq(viewerId?: string): NextRequest {
  const url = viewerId
    ? `http://localhost/api/routes-f/subscription-my-active?viewer_id=${viewerId}`
    : "http://localhost/api/routes-f/subscription-my-active";
  return new NextRequest(url);
}

describe("GET /api/routes-f/subscription-my-active", () => {
  describe("Required Parameters", () => {
    it("returns 400 when viewer_id is missing", async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("viewer_id");
    });
  });

  describe("Active subscriptions", () => {
    it("returns only active, non-expired subscriptions for viewer-1", async () => {
      const res = await GET(makeReq("viewer-1"));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.subscriptions).toHaveLength(2);
      const ids = body.subscriptions.map(
        (s: { subscription_id: string }) => s.subscription_id
      );
      expect(ids).toEqual(["sub_1", "sub_2"]);
    });

    it("excludes a subscription whose status is active but expiry has passed", async () => {
      const res = await GET(makeReq("viewer-1"));
      const body = await res.json();
      const ids = body.subscriptions.map(
        (s: { subscription_id: string }) => s.subscription_id
      );
      expect(ids).not.toContain("sub_3");
    });

    it("excludes a cancelled subscription", async () => {
      const res = await GET(makeReq("viewer-1"));
      const body = await res.json();
      const ids = body.subscriptions.map(
        (s: { subscription_id: string }) => s.subscription_id
      );
      expect(ids).not.toContain("sub_4");
    });

    it("includes creator and tier details on each entry", async () => {
      const res = await GET(makeReq("viewer-1"));
      const body = await res.json();

      expect(body.subscriptions[0]).toEqual({
        subscription_id: "sub_1",
        creator_id: "creator-alpha",
        creator_name: "AlphaStreams",
        tier_id: "tier_alpha_basic",
        tier_name: "Basic",
        started_at: "2026-01-01T00:00:00.000Z",
        expires_at: "2099-01-01T00:00:00.000Z",
      });
    });

    it("does not leak subscriber_id or status", async () => {
      const res = await GET(makeReq("viewer-1"));
      const body = await res.json();

      for (const sub of body.subscriptions) {
        expect(sub).not.toHaveProperty("subscriber_id");
        expect(sub).not.toHaveProperty("status");
      }
    });

    it("returns an empty array for a viewer with no subscriptions", async () => {
      const res = await GET(makeReq("viewer-with-no-subs"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.subscriptions).toEqual([]);
    });
  });

  describe("utils: isActive", () => {
    it("is false when status is not active", () => {
      const sub = subscriptionRecordStore.find(s => s.subscription_id === "sub_4")!;
      expect(isActive(sub)).toBe(false);
    });

    it("is false when expires_at is in the past, even if status is active", () => {
      const sub = subscriptionRecordStore.find(s => s.subscription_id === "sub_3")!;
      expect(isActive(sub)).toBe(false);
    });

    it("is true when status is active and not yet expired", () => {
      const sub = subscriptionRecordStore.find(s => s.subscription_id === "sub_1")!;
      expect(isActive(sub)).toBe(true);
    });

    it("respects an injected now for boundary checks", () => {
      const sub = subscriptionRecordStore.find(s => s.subscription_id === "sub_1")!;
      const farFuture = new Date("2100-01-01T00:00:00.000Z").getTime();
      expect(isActive(sub, farFuture)).toBe(false);
    });
  });

  describe("utils: toActiveEntry / filterActiveSubscriptions", () => {
    it("strips subscriber_id and status", () => {
      const sub = subscriptionRecordStore.find(s => s.subscription_id === "sub_1")!;
      const entry = toActiveEntry(sub);
      expect(entry).not.toHaveProperty("subscriber_id");
      expect(entry).not.toHaveProperty("status");
    });

    it("filters and maps in one pass", () => {
      const subs = getSubscriptionsForSubscriber("viewer-1");
      const active = filterActiveSubscriptions(subs);
      expect(active).toHaveLength(2);
    });
  });

  describe("seedData", () => {
    it("filters by subscriber_id", () => {
      const subs = getSubscriptionsForSubscriber("viewer-1");
      expect(subs.every(s => s.subscriber_id === "viewer-1")).toBe(true);
      expect(subs.length).toBe(4);
    });
  });
});
