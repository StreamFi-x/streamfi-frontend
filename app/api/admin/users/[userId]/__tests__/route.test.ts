/** @jest-environment node */
jest.mock("@/lib/admin-auth", () => ({
  authorizeAdmin: jest.fn().mockResolvedValue({
    ok: true,
    admin: { userId: "admin-user" },
    response: null,
  }),
  adminUnauthorized: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
}));
jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest
    .fn()
    .mockResolvedValue({ ok: true, userId: "admin-user" }),
}));
jest.mock("@/lib/security/step-up", () => ({ consumeStepUp: jest.fn() }));
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/postgres-transaction", () => ({
  withTransaction: jest.fn(
    async (fn: (tx: { sql: unknown }) => Promise<unknown>) => {
      const { sql } = jest.requireMock("@vercel/postgres");
      return fn({ sql });
    }
  ),
}));
jest.mock("@/lib/users/deletion", () => ({
  requestAccountDeletion: jest.fn(),
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { consumeStepUp } from "@/lib/security/step-up";
import { requestAccountDeletion } from "@/lib/users/deletion";
import { DELETE, PATCH } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const stepUpMock = consumeStepUp as jest.Mock;
const requestAccountDeletionMock = requestAccountDeletion as jest.Mock;
const params = Promise.resolve({ userId: "target-user" });

describe("admin user destructive action step-up", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sqlMock.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it("rejects a ban when no approved step-up challenge is supplied", async () => {
    stepUpMock.mockResolvedValue(false);
    const request = new NextRequest(
      "https://streamfi.media/api/admin/users/target-user",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "ban" }),
      }
    );
    const response = await PATCH(request, { params });
    expect(response.status).toBe(403);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("binds account deletion approval to the target user", async () => {
    stepUpMock.mockResolvedValue(false);
    const request = new NextRequest(
      "https://streamfi.media/api/admin/users/target-user",
      { method: "DELETE", headers: { "x-step-up-challenge": "challenge" } }
    );
    const response = await DELETE(request, { params });
    expect(response.status).toBe(403);
    expect(stepUpMock).toHaveBeenCalledWith(
      "admin-user",
      "challenge",
      "admin_user_delete",
      "target-user"
    );
    expect(sqlMock).not.toHaveBeenCalled();
  });

  describe("hard deletion in atomic transaction", () => {
    it("successfully hard-deletes user within an atomic transaction when hard=true", async () => {
      stepUpMock.mockResolvedValue(true);
      sqlMock.mockResolvedValueOnce({
        rows: [{ id: "target-user" }],
        rowCount: 1,
      }); // SELECT FOR UPDATE
      sqlMock.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // DELETE

      const request = new NextRequest(
        "https://streamfi.media/api/admin/users/target-user?hard=true",
        {
          method: "DELETE",
          headers: { "x-step-up-challenge": "valid-challenge" },
        }
      );
      const response = await DELETE(request, { params });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ ok: true, hard: true });
      expect(sqlMock).toHaveBeenCalledTimes(3);
    });

    it("returns 404 when target user is not found during hard delete", async () => {
      stepUpMock.mockResolvedValue(true);
      sqlMock.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT FOR UPDATE not found

      const request = new NextRequest(
        "https://streamfi.media/api/admin/users/target-user?hard=true",
        {
          method: "DELETE",
          headers: { "x-step-up-challenge": "valid-challenge" },
        }
      );
      const response = await DELETE(request, { params });
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe("User not found");
    });

    it("catches foreign-key violation (23503) during hard delete and returns 409 Conflict", async () => {
      stepUpMock.mockResolvedValue(true);
      sqlMock.mockResolvedValueOnce({
        rows: [{ id: "target-user" }],
        rowCount: 1,
      }); // SELECT FOR UPDATE
      const fkError = Object.assign(
        new Error("foreign key constraint violation"),
        {
          code: "23503",
          detail:
            'Key (id)=(target-user) is still referenced from table "unmigrated_table".',
        }
      );
      sqlMock.mockRejectedValueOnce(fkError);

      const request = new NextRequest(
        "https://streamfi.media/api/admin/users/target-user?hard=true",
        {
          method: "DELETE",
          headers: { "x-step-up-challenge": "valid-challenge" },
        }
      );
      const response = await DELETE(request, { params });
      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.code).toBe("23503");
      expect(json.error).toContain("foreign key constraint violation");
      expect(json.detail).toContain("unmigrated_table");
    });
  });

  describe("soft deletion and error handling", () => {
    it("calls requestAccountDeletion by default and returns 200", async () => {
      stepUpMock.mockResolvedValue(true);
      requestAccountDeletionMock.mockResolvedValue({
        outcome: "created",
        deletion: { status: "pending", purge_after: "2026-12-22" },
      });

      const request = new NextRequest(
        "https://streamfi.media/api/admin/users/target-user?reason=terms_violation",
        {
          method: "DELETE",
          headers: { "x-step-up-challenge": "valid-challenge" },
        }
      );
      const response = await DELETE(request, { params });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.ok).toBe(true);
      expect(json.status).toBe("pending");
      expect(requestAccountDeletionMock).toHaveBeenCalledWith({
        userId: "target-user",
        requestedByType: "admin",
        requestedBy: "admin-user",
        reason: "terms_violation",
      });
    });

    it("catches foreign-key violation (23503) if raised during deletion and returns 409 Conflict", async () => {
      stepUpMock.mockResolvedValue(true);
      const fkError = Object.assign(
        new Error("update or delete violates foreign key constraint"),
        {
          code: "23503",
          detail: "Key (id)=(target-user) is still referenced.",
        }
      );
      requestAccountDeletionMock.mockRejectedValueOnce(fkError);

      const request = new NextRequest(
        "https://streamfi.media/api/admin/users/target-user",
        {
          method: "DELETE",
          headers: { "x-step-up-challenge": "valid-challenge" },
        }
      );
      const response = await DELETE(request, { params });
      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.code).toBe("23503");
      expect(json.error).toContain("foreign key constraint violation");
    });
  });
});
