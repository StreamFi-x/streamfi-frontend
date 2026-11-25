/**
 * @jest-environment node
 *
 * Foreign key constraint handling on admin user deletion (#1868)
 */
import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/admin/users/[userId]/route";

jest.mock("@/lib/admin-auth", () => ({
  authorizeAdmin: jest.fn(async () => ({
    ok: true,
    admin: { userId: "did:privy:admin" },
    response: null,
  })),
}));

jest.mock("@/lib/security/step-up", () => ({
  consumeStepUp: jest.fn(async () => true),
}));

const mockRequestAccountDeletion = jest.fn();
jest.mock("@/lib/users/deletion", () => ({
  requestAccountDeletion: (...args: unknown[]) => mockRequestAccountDeletion(...args),
}));

describe("Admin user deletion foreign key handling (#1868)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 409 with actionable error on foreign key constraint violation", async () => {
    const fkError = new Error('update or delete on table "users" violates foreign key constraint');
    (fkError as any).code = "23503";
    mockRequestAccountDeletion.mockRejectedValueOnce(fkError);

    const req = new NextRequest("http://localhost/api/admin/users/user-123", {
      method: "DELETE",
      headers: {
        "x-step-up-challenge": "valid-challenge",
      },
    });

    const res = await DELETE(req, {
      params: Promise.resolve({ userId: "user-123" }),
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe("FOREIGN_KEY_VIOLATION");
    expect(data.error).toContain("foreign key constraints");
  });
});
