/**
 * @jest-environment node
 */
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));

import { auditUsersJsonb } from "@/lib/db/jsonb-audit";

const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";
const USER_C = "00000000-0000-0000-0000-00000000000c";

const validNotification = {
  id: "5b0d9f7e-1c1c-4c7a-9a33-0d6c2b8f4e11",
  type: "follow",
  title: "New follower",
  text: "x followed you",
  read: false,
  created_at: "2026-09-25T00:00:00.000Z",
};

beforeEach(() => {
  mockDb.reset();
  mockDb.on(/INSERT INTO job_runs/, { rows: [{ id: "run-1" }] });
  mockDb.on(/UPDATE job_runs/, { rowCount: 1 });
  mockDb.on(/SELECT id, sociallinks, creator, notifications FROM users/, {
    rows: [
      {
        id: USER_A,
        sociallinks: { twitter: "https://x.com/a" },
        creator: { streamTitle: "ok" },
        notifications: [validNotification],
      },
      {
        id: USER_B,
        sociallinks: [{ socialTitle: "t", socialLink: "https://t.me/b" }],
        creator: { streamTitle: "b", thumbnail: null },
        notifications: [{ title: "old", text: "legacy" }],
      },
      {
        id: USER_C,
        sociallinks: "garbage",
        creator: { tags: "a,b" },
        notifications: [validNotification, "junk"],
      },
    ],
  });
});

describe("auditUsersJsonb", () => {
  it("reports every column without writing and without stored values", async () => {
    const report = await auditUsersJsonb({ action: "report", actor: "a" });

    expect(report.scanned).toBe(3);
    expect(report.counts.sociallinks).toMatchObject({
      valid: 1,
      normalizable: 1,
      invalid: 1,
    });
    expect(report.counts.creator).toMatchObject({
      valid: 1,
      normalizable: 1,
      invalid: 1,
    });
    expect(report.counts.notifications).toMatchObject({
      valid: 1,
      legacy: 1,
      invalid: 1,
    });
    expect(mockDb.callsMatching(/^UPDATE users|jsonb_quarantine/)).toHaveLength(
      0
    );
    // Findings name users, columns and schema paths only — never values.
    expect(JSON.stringify(report.findings)).not.toMatch(/garbage|t\.me/);
  });

  it("returns a cursor for the next batch when the batch is full", async () => {
    const report = await auditUsersJsonb({
      action: "report",
      actor: "a",
      limit: 3,
    });
    expect(report.nextCursor).toBe(USER_C);
    const lastPage = await auditUsersJsonb({
      action: "report",
      actor: "a",
      limit: 10,
    });
    expect(lastPage.nextCursor).toBeNull();
  });

  it("normalises only normalizable values, conditional on the stored value", async () => {
    mockDb.on(/UPDATE users SET (sociallinks|creator) =/, { rowCount: 1 });

    const report = await auditUsersJsonb({ action: "normalize", actor: "a" });

    const writes = mockDb.callsMatching(
      /UPDATE users SET (sociallinks|creator) =/
    );
    expect(writes).toHaveLength(2);
    expect(
      writes.every(w => w.values[0] === USER_B || w.values[1] === USER_B)
    ).toBe(true);
    const socialWrite = writes.find(w => /sociallinks =/.test(w.text))!;
    expect(JSON.parse(String(socialWrite.values[0]))).toEqual({
      telegram: "https://t.me/b",
    });
    // The WHERE clause carries the classified original value.
    expect(socialWrite.text).toMatch(/AND sociallinks = \$\?::jsonb/);
    expect(report.normalized).toBe(2);
  });

  it("counts a concurrent change instead of overwriting it", async () => {
    mockDb.on(/UPDATE users SET (sociallinks|creator) =/, { rowCount: 0 });
    const report = await auditUsersJsonb({ action: "normalize", actor: "a" });
    expect(report.normalized).toBe(0);
    expect(report.skippedConcurrentChange).toBe(2);
  });

  it("quarantines invalid values with the original preserved", async () => {
    mockDb.on(/jsonb_quarantine/, { rowCount: 1 });

    const report = await auditUsersJsonb({
      action: "quarantine",
      actor: "admin-1",
    });

    const quarantines = mockDb.callsMatching(/jsonb_quarantine/);
    expect(quarantines).toHaveLength(3);
    expect(quarantines.every(q => q.values.includes("admin-1"))).toBe(true);
    const notif = quarantines.find(q => /'notifications'/.test(q.text))!;
    // Only element index 1 (Postgres position 2) is removed.
    expect(notif.values).toContain("{2}");
    expect(report.quarantined).toBe(3);
  });

  it("records a failed run and rethrows when the scan fails", async () => {
    mockDb.reset();
    mockDb.on(/INSERT INTO job_runs/, { rows: [{ id: "run-2" }] });
    mockDb.on(/UPDATE job_runs/, { rowCount: 1 });
    mockDb.on(/FROM users/, () => {
      throw new Error("db down");
    });

    await expect(
      auditUsersJsonb({ action: "report", actor: "a" })
    ).rejects.toThrow("db down");
    const finish = mockDb.callsMatching(/UPDATE job_runs/)[0];
    expect(finish.values).toContain("failed");
  });
});
