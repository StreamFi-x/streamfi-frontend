import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { POST as POSTUnsubscribe } from "../unsubscribe/route";
import {
  __resetBanSyncStore,
  __seedChannelBan,
  getBanSyncStatus,
  isViewerBannedOnChannel,
} from "../store";

const BASE = "http://localhost/api/routes-f/ban-sync";
const UNSUB = `${BASE}/unsubscribe`;

function req(method: string, url: string, body?: object): NextRequest {
  return new NextRequest(url, {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });
}

beforeEach(() => {
  __resetBanSyncStore();
});

describe("Ban sync subscriptions", () => {
  it("subscribes target to source bans with bidirectional status", async () => {
    const res = await POST(
      req("POST", BASE, {
        source_creator_id: "creator-alpha",
        target_creator_id: "creator-beta",
      })
    );
    expect(res.status).toBe(201);

    const targetStatus = await GET(
      req("GET", `${BASE}?creator_id=creator-beta`)
    );
    expect((await targetStatus.json()).subscribed_to).toEqual(["creator-alpha"]);

    const sourceStatus = await GET(
      req("GET", `${BASE}?creator_id=creator-alpha`)
    );
    expect((await sourceStatus.json()).subscribed_by).toEqual(["creator-beta"]);
  });

  it("copies existing bans when copy_existing is true", async () => {
    __seedChannelBan("creator-src", "viewer-toxic");
    __seedChannelBan("creator-src", "viewer-spam");

    await POST(
      req("POST", BASE, {
        source_creator_id: "creator-src",
        target_creator_id: "creator-dst",
        copy_existing: true,
      })
    );

    expect(isViewerBannedOnChannel("creator-dst", "viewer-toxic")).toBe(true);
    expect(isViewerBannedOnChannel("creator-dst", "viewer-spam")).toBe(true);
    expect(isViewerBannedOnChannel("creator-dst", "viewer-other")).toBe(false);
  });

  it("inherits new source bans after subscription without copy_existing", async () => {
    await POST(
      req("POST", BASE, {
        source_creator_id: "creator-src",
        target_creator_id: "creator-dst",
      })
    );

    expect(isViewerBannedOnChannel("creator-dst", "viewer-new")).toBe(false);

    __seedChannelBan("creator-src", "viewer-new");
    expect(isViewerBannedOnChannel("creator-dst", "viewer-new")).toBe(true);
  });

  it("unsubscribes and clears bidirectional links", async () => {
    await POST(
      req("POST", BASE, {
        source_creator_id: "creator-a",
        target_creator_id: "creator-b",
      })
    );

    const unsubRes = await POSTUnsubscribe(
      req("POST", UNSUB, {
        source_creator_id: "creator-a",
        target_creator_id: "creator-b",
      })
    );
    expect(unsubRes.status).toBe(200);

    expect(getBanSyncStatus("creator-b").subscribed_to).toEqual([]);
    expect(getBanSyncStatus("creator-a").subscribed_by).toEqual([]);
  });

  it("returns 404 when unsubscribing a non-existent link", async () => {
    const res = await POSTUnsubscribe(
      req("POST", UNSUB, {
        source_creator_id: "ghost-src",
        target_creator_id: "ghost-dst",
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 for duplicate subscription", async () => {
    const body = {
      source_creator_id: "creator-x",
      target_creator_id: "creator-y",
    };
    await POST(req("POST", BASE, body));
    const dup = await POST(req("POST", BASE, body));
    expect(dup.status).toBe(409);
  });

  it("returns 400 when creator_id is missing on GET", async () => {
    const res = await GET(req("GET", BASE));
    expect(res.status).toBe(400);
  });
});
