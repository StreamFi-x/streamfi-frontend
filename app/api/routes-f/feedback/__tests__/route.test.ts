import { POST } from "../route";
import { NextRequest } from "next/server";
import { resetState, feedbackStorage } from "../_lib/helpers";

describe("POST /api/routes-f/feedback", () => {
  beforeEach(() => {
    resetState();
  });

  function createRequest(body: any, ip: string = "127.0.0.1") {
    return new NextRequest("http://localhost/api/routes-f/feedback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    });
  }

  it("should validate and store a successful request", async () => {
    const req = createRequest({ message: "This is a valid message length", category: "bug" });
    const res = await POST(req);
    expect(res.status).toBe(201);
    
    expect(feedbackStorage.length).toBe(1);
    expect(feedbackStorage[0].message).toBe("This is a valid message length");
    expect(feedbackStorage[0].category).toBe("bug");
  });

  it("should strip HTML tags from the message", async () => {
    const req = createRequest({ message: "This <script>alert(1)</script> is a <b>valid</b> message", category: "feature" });
    const res = await POST(req);
    expect(res.status).toBe(201);
    
    expect(feedbackStorage[0].message).toBe("This alert(1) is a valid message");
  });

  it("should reject message that is too short", async () => {
    const req = createRequest({ message: "short", category: "other" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/between 10 and 2000 characters/);
  });

  it("should reject invalid category", async () => {
    const req = createRequest({ message: "This is a valid message length", category: "invalid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid category");
  });

  it("should rate limit after 5 requests from the same IP", async () => {
    const ip = "192.168.1.1";
    for (let i = 0; i < 5; i++) {
      const req = createRequest({ message: "This is a valid message length", category: "bug" }, ip);
      const res = await POST(req);
      expect(res.status).toBe(201);
    }

    const req = createRequest({ message: "This is a valid message length", category: "bug" }, ip);
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/Too many requests/);
  });

  it("should not rate limit different IPs", async () => {
    for (let i = 0; i < 5; i++) {
      const req = createRequest({ message: "This is a valid message length", category: "bug" }, "ip1");
      await POST(req);
    }

    const req2 = createRequest({ message: "This is a valid message length", category: "bug" }, "ip2");
    const res2 = await POST(req2);
    expect(res2.status).toBe(201);
  });
});
