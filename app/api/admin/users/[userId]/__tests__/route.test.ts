jest.mock("@/lib/admin-auth", () => ({
  verifyAdminSession: jest.fn().mockResolvedValue(true),
  adminUnauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));
jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn().mockResolvedValue({ ok: true, userId: "admin-user" }),
}));
jest.mock("@/lib/security/step-up", () => ({ consumeStepUp: jest.fn() }));
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { consumeStepUp } from "@/lib/security/step-up";
import { DELETE, PATCH } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const stepUpMock = consumeStepUp as jest.Mock;
const params = Promise.resolve({ userId: "target-user" });

describe("admin user destructive action step-up", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sqlMock.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it("rejects a ban when no approved step-up challenge is supplied", async () => {
    stepUpMock.mockResolvedValue(false);
    const request = new NextRequest("https://streamfi.media/api/admin/users/target-user", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "ban" }),
    });
    const response = await PATCH(request, { params });
    expect(response.status).toBe(403);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("binds account deletion approval to the target user", async () => {
    stepUpMock.mockResolvedValue(false);
    const request = new NextRequest("https://streamfi.media/api/admin/users/target-user", { method: "DELETE" });
    const response = await DELETE(request, { params });
    expect(response.status).toBe(403);
    expect(stepUpMock).toHaveBeenCalledWith("admin-user", undefined, "admin_user_delete", "target-user");
    expect(sqlMock).not.toHaveBeenCalled();
  });
});