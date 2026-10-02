import { NextRequest } from "next/server";
import { GET, POST, DELETE, _resetBans } from "./route";

describe("Channel Bans API", () => {
  beforeEach(() => {
    _resetBans();
  });

  const mockRequest = (method: string, url: string, body?: any) => {
    return new NextRequest(`http://localhost${url}`, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  };

  it("should add a ban (POST)", async () => {
    const req = mockRequest("POST", "/api/routes-f/channel-bans", {
      creator_id: "c1",
      viewer_id: "v1",
      reason: "Spamming",
    });
    
    const res = await POST(req);
    expect(res.status).toBe(201);
    
    const data = await res.json();
    expect(data.ban.creator_id).toBe("c1");
    expect(data.ban.viewer_id).toBe("v1");
    expect(data.ban.reason).toBe("Spamming");
    expect(data.ban.ts).toBeDefined();
  });

  it("should list bans (GET)", async () => {
    // Add a ban first
    const postReq = mockRequest("POST", "/api/routes-f/channel-bans", {
      creator_id: "c2",
      viewer_id: "v2",
      reason: "Toxicity",
    });
    await POST(postReq);

    // List bans
    const getReq = mockRequest("GET", "/api/routes-f/channel-bans?creator_id=c2");
    const res = await GET(getReq);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.bans.length).toBe(1);
    expect(data.bans[0].creator_id).toBe("c2");
    expect(data.bans[0].viewer_id).toBe("v2");
    expect(data.bans[0].reason).toBe("Toxicity");
  });

  it("should lift a ban (DELETE)", async () => {
    // Add a ban first
    const postReq = mockRequest("POST", "/api/routes-f/channel-bans", {
      creator_id: "c3",
      viewer_id: "v3",
      reason: "Botting",
    });
    await POST(postReq);

    // Lift the ban
    const delReq = mockRequest(
      "DELETE",
      "/api/routes-f/channel-bans?creator_id=c3&viewer_id=v3"
    );
    const delRes = await DELETE(delReq);
    expect(delRes.status).toBe(200);

    // Verify it's gone
    const getReq = mockRequest("GET", "/api/routes-f/channel-bans?creator_id=c3");
    const getRes = await GET(getReq);
    const data = await getRes.json();
    expect(data.bans.length).toBe(0);
  });
});
