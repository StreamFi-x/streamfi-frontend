jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

import { sql } from "@vercel/postgres";
import { consumeStepUp, STEP_UP_ACTIONS } from "@/lib/security/step-up";

const sqlMock = sql as unknown as jest.Mock;

describe("single-use step-up approvals", () => {
  beforeEach(() => jest.clearAllMocks());

  it("restricts challenges to the centrally configured action set", () => {
    expect(STEP_UP_ACTIONS).toEqual(["wallet_export", "wallet_regeneration", "admin_user_ban", "admin_user_delete"]);
  });

  it("consumes only an unexpired approval matching user, action, and resource", async () => {
    sqlMock.mockResolvedValue({ rows: [{ id: "challenge-1" }] });
    await expect(consumeStepUp("user-1", "challenge-1", "wallet_export", "user-1")).resolves.toBe(true);
    expect(sqlMock.mock.calls[0][1]).toContain("wallet_export");
    expect(sqlMock.mock.calls[0][1]).toContain("user-1");
    expect(sqlMock.mock.calls[0][0].join("")).toContain("consumed_at IS NULL");
    expect(sqlMock.mock.calls[0][0].join("")).toContain("expires_at > now()");
  });

  it("rejects a replayed or mismatched challenge", async () => {
    sqlMock.mockResolvedValue({ rows: [] });
    await expect(consumeStepUp("user-1", "challenge-1", "wallet_regeneration", "user-1")).resolves.toBe(false);
  });
});