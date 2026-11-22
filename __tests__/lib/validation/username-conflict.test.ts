/**
 * @jest-environment node
 */
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));

import { findUsernameConflict } from "@/lib/users/username-conflict";
import { prepareUsername } from "@/lib/validation/username";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => mockDb.reset());

describe("findUsernameConflict", () => {
  it("returns null when nothing matches", async () => {
    mockDb.on(/FROM users/, { rows: [] });
    await expect(
      findUsernameConflict(prepareUsername("alice"))
    ).resolves.toBeNull();
  });

  it("reports an exact match", async () => {
    mockDb.on(/FROM users/, { rows: [{ username: "alice" }] });
    await expect(findUsernameConflict(prepareUsername("Alice"))).resolves.toBe(
      "exact"
    );
  });

  it("reports a look-alike when the matching row has a different username", async () => {
    mockDb.on(/FROM users/, { rows: [{ username: "alice" }] });
    await expect(
      findUsernameConflict(prepareUsername("\u0430\u04cf\u0456\u0441\u0435"))
    ).resolves.toBe("lookalike");
  });

  it("queries by skeleton, by lowercase skeleton and by exact name", async () => {
    mockDb.on(/FROM users/, { rows: [] });
    await findUsernameConflict(
      prepareUsername("\u0430\u04cf\u0456\u0441\u0435")
    );

    const [call] = mockDb.calls;
    expect(call.text).toMatch(/username_skeleton = \$\?/);
    expect(call.values).toContain("alice");
  });

  it("excludes the caller's own row when a user id is given", async () => {
    mockDb.on(/FROM users/, { rows: [] });
    await findUsernameConflict(prepareUsername("alice"), USER_ID);

    expect(mockDb.calls[0].values).toContain(USER_ID);
  });
});
