/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

import { sql } from "@vercel/postgres";
import { writeNotification } from "@/lib/notifications";

const sqlMock = sql as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("writeNotification", () => {
  it("inserts one row into the notifications table for an existing user", async () => {
    sqlMock.mockResolvedValue({ rowCount: 1 });

    await writeNotification(
      "u-1",
      "follow",
      "New follower",
      "alice followed you"
    );

    const [strings, ...values] = sqlMock.mock.calls[0];
    const text = (strings as string[]).join("?");
    expect(text).toContain("INSERT INTO notifications");
    expect(text).toContain("FROM users");
    expect(values).toEqual([
      "follow",
      "New follower",
      "alice followed you",
      "u-1",
    ]);
  });

  it("logs, without throwing, when the recipient does not exist", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    sqlMock.mockResolvedValue({ rowCount: 0 });

    await expect(
      writeNotification("ghost", "live", "t", "x")
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ghost"));
  });

  it("writes through the given transaction executor", async () => {
    const txSql = jest.fn().mockResolvedValue({ rowCount: 1 });

    await writeNotification("u-1", "live", "t", "x", {
      sql: txSql,
    } as never);

    expect(txSql).toHaveBeenCalledTimes(1);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("propagates database errors", async () => {
    sqlMock.mockRejectedValue(new Error("db down"));

    await expect(writeNotification("u-1", "live", "t", "x")).rejects.toThrow(
      "db down"
    );
  });
});
