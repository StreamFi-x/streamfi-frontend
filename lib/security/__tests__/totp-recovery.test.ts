jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

import { hash } from "bcryptjs";
import { sql } from "@vercel/postgres";
import { consumeRecoveryCode } from "@/lib/security/step-up";

const sqlMock = sql as unknown as jest.Mock;

describe("TOTP recovery codes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("consumes a valid recovery code once", async () => {
    const recoveryCode = "0123456789AB";
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: "recovery-1", code_hash: await hash(recoveryCode, 4) }] })
      .mockResolvedValueOnce({ rows: [{ id: "recovery-1" }] });

    await expect(consumeRecoveryCode("user-1", recoveryCode)).resolves.toBe(true);
    expect(sqlMock).toHaveBeenCalledTimes(2);
    expect(sqlMock.mock.calls[1][0].join("")).toContain("used_at IS NULL");
  });

  it("rejects an already-consumed recovery code", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });
    await expect(consumeRecoveryCode("user-1", "not-a-recovery-code")).resolves.toBe(false);
  });
});