import { NextRequest } from "next/server";
import { GET, POST, DELETE, _resetStreamHosts } from "./route";

describe("Stream Hosts API", () => {
  beforeEach(() => {
    _resetStreamHosts();
  });

  const mockRequest = (method: string, url: string, body?: any) => {
    return new NextRequest(`http://localhost${url}`, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  };

  it("should add a host (POST)", async () => {
    const req = mockRequest("POST", "/api/routes-f/stream-hosts", {
      stream_id: "s1",
      host_user_id: "u1",
      role: "host",
    });
    
    const res = await POST(req);
    expect(res.status).toBe(201);
    
    const data = await res.json();
    expect(data.added_at).toBeDefined();
  });

  it("should list hosts (GET)", async () => {
    const postReq = mockRequest("POST", "/api/routes-f/stream-hosts", {
      stream_id: "s2",
      host_user_id: "u2",
      role: "guest",
    });
    await POST(postReq);

    const getReq = mockRequest("GET", "/api/routes-f/stream-hosts?stream_id=s2");
    const res = await GET(getReq);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.hosts.length).toBe(1);
    expect(data.hosts[0].stream_id).toBe("s2");
    expect(data.hosts[0].host_user_id).toBe("u2");
    expect(data.hosts[0].role).toBe("guest");
  });

  it("should cap total hosts at 4", async () => {
    // Add 4 hosts
    for (let i = 1; i <= 4; i++) {
      const postReq = mockRequest("POST", "/api/routes-f/stream-hosts", {
        stream_id: "s3",
        host_user_id: `u${i}`,
        role: "co-host",
      });
      const res = await POST(postReq);
      expect(res.status).toBe(201);
    }

    // Try to add 5th host
    const failReq = mockRequest("POST", "/api/routes-f/stream-hosts", {
      stream_id: "s3",
      host_user_id: "u5",
      role: "guest",
    });
    const failRes = await POST(failReq);
    expect(failRes.status).toBe(403);
    const failData = await failRes.json();
    expect(failData.error).toContain("Maximum number of hosts");
  });

  it("should remove a host (DELETE)", async () => {
    const postReq = mockRequest("POST", "/api/routes-f/stream-hosts", {
      stream_id: "s4",
      host_user_id: "u4",
      role: "co-host",
    });
    await POST(postReq);

    const delReq = mockRequest(
      "DELETE",
      "/api/routes-f/stream-hosts?stream_id=s4&host_user_id=u4"
    );
    const delRes = await DELETE(delReq);
    expect(delRes.status).toBe(200);

    const getReq = mockRequest("GET", "/api/routes-f/stream-hosts?stream_id=s4");
    const getRes = await GET(getReq);
    const data = await getRes.json();
    expect(data.hosts.length).toBe(0);
  });
});
