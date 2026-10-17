/**
 * @jest-environment node
 */

import { validateAllowedUserIds } from "../route";

describe("admin/feature-flags validation", () => {
  const validUuid1 = "11111111-1111-4111-8111-111111111111";
  const validUuid2 = "22222222-2222-4222-8222-222222222222";
  const missingUuid = "33333333-3333-4333-8333-333333333333";

  it("passes when allowedUserIds is undefined or null", async () => {
    expect(await validateAllowedUserIds(undefined)).toBeNull();
    expect(await validateAllowedUserIds(null)).toBeNull();
  });

  it("passes for empty allowedUserIds array", async () => {
    expect(await validateAllowedUserIds([])).toBeNull();
  });

  it("rejects non-array allowed_user_ids", async () => {
    const res = await validateAllowedUserIds("not-an-array" as any);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(400);
    const body = await res?.json();
    expect(body.error).toBe("invalid_user_ids");
  });

  it("rejects malformed UUID formats", async () => {
    const res = await validateAllowedUserIds([validUuid1, "bad-uuid", "12345"]);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(400);
    const body = await res?.json();
    expect(body.error).toBe("invalid_user_ids");
    expect(body.invalidIds).toEqual(["bad-uuid", "12345"]);
  });

  it("rejects user IDs that do not exist in the database", async () => {
    const mockDb = {
      sql: jest.fn().mockResolvedValueOnce({
        rows: [{ id: validUuid1 }],
      }),
    };

    const res = await validateAllowedUserIds(
      [validUuid1, missingUuid],
      mockDb as any
    );
    expect(res).not.toBeNull();
    expect(res?.status).toBe(400);
    const body = await res?.json();
    expect(body.error).toBe("users_not_found");
    expect(body.notFoundIds).toEqual([missingUuid]);
  });

  it("accepts valid and existing UUIDs", async () => {
    const mockDb = {
      sql: jest.fn().mockResolvedValueOnce({
        rows: [{ id: validUuid1 }, { id: validUuid2 }],
      }),
    };

    const res = await validateAllowedUserIds(
      [validUuid1, validUuid2],
      mockDb as any
    );
    expect(res).toBeNull();
  });
});
