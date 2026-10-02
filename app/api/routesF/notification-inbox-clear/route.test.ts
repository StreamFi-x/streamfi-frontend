import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/notification-inbox-clear", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("Notification Inbox Clear API", () => {
  it("clears the inbox and returns cleared result", async () => {
    const res = await POST(makeReq({ user_id: "user-abc" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.cleared).toBe(true);
    expect(typeof data.notification_count).toBe("number");
    expect(data.notification_count).toBeGreaterThan(0);
    expect(typeof data.undo_available_until).toBe("string");
  });

  it("undo_available_until is a valid ISO date string", async () => {
    const res = await POST(makeReq({ user_id: "user-iso" }));
    const data = await res.json();

    expect(new Date(data.undo_available_until).getTime()).toBeGreaterThan(Date.now());
  });

  it("restores inbox within undo window", async () => {
    const userId = "user-undo-ok";
    await POST(makeReq({ user_id: userId }));

    const undoRes = await POST(makeReq({ user_id: userId, action: "undo" }));
    const undoData = await undoRes.json();

    expect(undoRes.status).toBe(200);
    expect(undoData.restored).toBe(true);
    expect(typeof undoData.notification_count).toBe("number");
  });

  it("returns 404 when undoing a non-existent clear", async () => {
    const res = await POST(makeReq({ user_id: "user-never-cleared", action: "undo" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when user_id is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not JSON", async () => {
    const req = new NextRequest("http://localhost/api/routesF/notification-inbox-clear", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("different users get independent clear state", async () => {
    await POST(makeReq({ user_id: "user-x" }));
    const res = await POST(makeReq({ user_id: "user-y", action: "undo" }));
    expect(res.status).toBe(404);
  });

  it("undo clears the stored state so a second undo returns 404", async () => {
    const userId = "user-double-undo";
    await POST(makeReq({ user_id: userId }));
    await POST(makeReq({ user_id: userId, action: "undo" }));

    const secondUndo = await POST(makeReq({ user_id: userId, action: "undo" }));
    expect(secondUndo.status).toBe(404);
  });
});
