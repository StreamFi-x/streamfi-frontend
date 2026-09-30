import { NextRequest } from "next/server";
import { POST } from "../route";
import { GET as getIncoming } from "../incoming/route";
import { GET as getActive } from "../active/route";
import { resetRaidStore, setChannel } from "../store";

function makePostReq(body: unknown, userId?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userId) {
    headers["x-user-id"] = userId;
  }
  return new NextRequest("http://localhost/api/routes-f/live/raid", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function makeIncomingReq(userId?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (userId) {
    headers["x-user-id"] = userId;
  }
  return new NextRequest("http://localhost/api/routes-f/live/raid/incoming", {
    method: "GET",
    headers,
  });
}

function makeActiveReq(channel: string): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/live/raid/active?channel=${channel}`, {
    method: "GET",
  });
}

describe("Raid Flow API", () => {
  beforeEach(() => {
    resetRaidStore();
  });

  it("initiates a raid and provides prompt banner and incoming announcement", async () => {
    // Raider: user_raider_1 ("streamer_alpha"), Target: streamer_beta
    const res = await POST(
      makePostReq({ targetUsername: "streamer_beta", viewerCount: 150 }, "user_raider_1")
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.raid).toBeTruthy();
    expect(data.raid.viewer_count).toBe(150);
    expect(data.prompt).toBeTruthy();
    expect(data.prompt.target_channel_url).toBe("/streamer_beta");

    // 1. Initiating channel viewers can query active raid prompt banner
    const activeRes = await getActive(makeActiveReq("streamer_alpha"));
    expect(activeRes.status).toBe(200);
    const activeData = await activeRes.json();
    expect(activeData.active_raid).toBeTruthy();
    expect(activeData.active_raid.viewer_count).toBe(150);

    // 2. Target channel receives real-time incoming raid announcement
    const incomingRes = await getIncoming(makeIncomingReq("user_target_1"));
    expect(incomingRes.status).toBe(200);
    const incomingData = await incomingRes.json();
    expect(incomingData.raid).toBeTruthy();
    expect(incomingData.raid.viewer_count).toBe(150);
    expect(incomingData.raid.is_acknowledged).toBe(true);

    // 3. Second incoming poll returns null because it was already acknowledged
    const secondIncoming = await getIncoming(makeIncomingReq("user_target_1"));
    const secondData = await secondIncoming.json();
    expect(secondData.raid).toBeNull();
  });

  it("rejects raid if target channel is offline (race condition handling)", async () => {
    const res = await POST(
      makePostReq({ targetUsername: "streamer_sleeping", viewerCount: 50 }, "user_raider_1")
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("TARGET_OFFLINE");
  });

  it("rejects raid if target creator has disabled incoming raids (abuse safeguard)", async () => {
    const res = await POST(
      makePostReq({ targetUsername: "streamer_privacy", viewerCount: 100 }, "user_raider_1")
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe("TARGET_OPTED_OUT");
  });

  it("enforces a 5-minute cooldown between raids for a creator", async () => {
    // First raid succeeds
    const res1 = await POST(
      makePostReq({ targetUsername: "streamer_beta", viewerCount: 20 }, "user_raider_1")
    );
    expect(res1.status).toBe(200);

    // Immediately attempting another raid triggers cooldown
    const res2 = await POST(
      makePostReq({ targetUsername: "streamer_beta", viewerCount: 20 }, "user_raider_1")
    );
    expect(res2.status).toBe(429);
    const data = await res2.json();
    expect(data.code).toBe("RAID_COOLDOWN");
    expect(data.error).toMatch(/cooldown/i);
  });

  it("prevents self-raiding", async () => {
    const res = await POST(
      makePostReq({ targetUsername: "streamer_alpha", viewerCount: 50 }, "user_raider_1")
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("CANNOT_RAID_SELF");
  });

  it("rejects if raider is not currently live", async () => {
    setChannel({
      id: "offline_raider",
      username: "streamer_off",
      is_live: false,
      allow_incoming_raids: true,
    });

    const res = await POST(
      makePostReq({ targetUsername: "streamer_beta", viewerCount: 10 }, "offline_raider")
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("RAIDER_NOT_LIVE");
  });

  it("returns 404 if target user is not found", async () => {
    const res = await POST(
      makePostReq({ targetUsername: "non_existent_streamer_999", viewerCount: 10 }, "user_raider_1")
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe("TARGET_NOT_FOUND");
  });

  it("returns 401 if unauthorized", async () => {
    const res = await POST(makePostReq({ targetUsername: "streamer_beta", viewerCount: 10 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for negative or invalid viewer count", async () => {
    const res = await POST(
      makePostReq({ targetUsername: "streamer_beta", viewerCount: -5 }, "user_raider_1")
    );
    expect(res.status).toBe(400);
  });
});
