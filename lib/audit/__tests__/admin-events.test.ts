jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

import { recordAdminEvent } from "@/lib/audit/admin-events";

describe("recordAdminEvent", () => {
  it("writes actor, target, and allowlisted before/after state through the transaction executor", async () => {
    const execute = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    await recordAdminEvent({ sql: execute } as never, {
      actorId: "did:privy:admin",
      action: "user_ban",
      targetType: "user",
      targetId: "user-42",
      beforeState: { is_banned: false },
      afterState: { is_banned: true },
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][1]).toEqual([
      "did:privy:admin",
      "user_ban",
      "user",
      "user-42",
      JSON.stringify({ is_banned: false }),
      JSON.stringify({ is_banned: true }),
      null,
    ]);
  });
});