import { PATCH } from "./route";
import { NextRequest } from "next/server";

describe("PATCH /api/routes-f/admin-flag-user-verified", () => {
  it("successfully sets user verification status", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/routes-f/admin-flag-user-verified",
      {
        method: "PATCH",
        body: JSON.stringify({ userId: "usr_123", verified: true }),
      }
    );
    const res = await PATCH(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user_id).toBe("usr_123");
    expect(data.is_verified).toBe(true);
  });

  it("toggles verification status to false when specified", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/routes-f/admin-flag-user-verified",
      {
        method: "PATCH",
        body: JSON.stringify({ user_id: "usr_456", is_verified: false }),
      }
    );
    const res = await PATCH(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user_id).toBe("usr_456");
    expect(data.is_verified).toBe(false);
  });

  it("returns 400 when missing user identifier", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/routes-f/admin-flag-user-verified",
      {
        method: "PATCH",
        body: JSON.stringify({}),
      }
    );
    const res = await PATCH(req);

    expect(res.status).toBe(400);
  });
});
