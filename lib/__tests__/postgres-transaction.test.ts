/**
 * @jest-environment node
 */
const mockConnect = jest.fn();
jest.mock("@vercel/postgres", () => ({
  db: { connect: () => mockConnect() },
}));

import { withTransaction } from "@/lib/postgres-transaction";

function fakeClient(failOn?: string) {
  const log: string[] = [];
  const client = {
    sql: jest.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join("?").trim();
      log.push(text);
      if (failOn && text.startsWith(failOn)) {
        throw new Error(`${failOn} failed`);
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  mockConnect.mockResolvedValue(client);
  return { client, log };
}

describe("withTransaction", () => {
  beforeEach(() => mockConnect.mockReset());

  it("runs BEGIN, the work and COMMIT on one pooled client, then releases it", async () => {
    const { client, log } = fakeClient();
    const result = await withTransaction(async c => {
      await c.sql`DELETE FROM featured_streams`;
      return "done";
    });
    expect(result).toBe("done");
    expect(log).toEqual(["BEGIN", "DELETE FROM featured_streams", "COMMIT"]);
    expect(client.release).toHaveBeenCalledWith(false);
  });

  it("rolls back, rethrows and releases when the work fails", async () => {
    const { client, log } = fakeClient("INSERT");
    await expect(
      withTransaction(async c => {
        await c.sql`DELETE FROM featured_streams`;
        await c.sql`INSERT INTO featured_streams VALUES (1)`;
      })
    ).rejects.toThrow("INSERT failed");
    expect(log).toEqual([
      "BEGIN",
      "DELETE FROM featured_streams",
      "INSERT INTO featured_streams VALUES (1)",
      "ROLLBACK",
    ]);
    expect(client.release).toHaveBeenCalledWith(false);
  });

  it("discards the connection when ROLLBACK itself fails", async () => {
    const { client } = fakeClient("ROLLBACK");
    await expect(
      withTransaction(async () => {
        throw new Error("work failed");
      })
    ).rejects.toThrow("work failed");
    expect(client.release).toHaveBeenCalledWith(true);
  });
});
