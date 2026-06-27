import { sql } from "@vercel/postgres";
import { insertActivityEvent } from "../_lib/insert";

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

const sqlMock = sql as unknown as jest.Mock;

describe("insertActivityEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates table and inserts an event", async () => {
    sqlMock.mockResolvedValueOnce({});
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "evt-new" }] });

    const result = await insertActivityEvent({
      userId: "user-creator",
      type: "new_follower",
      actorId: "user-follower",
      metadata: { source: "routes-f/follows" },
    });

    expect(result).toEqual({ id: "evt-new" });
    expect(sqlMock).toHaveBeenCalledTimes(2);
    expect(sqlMock).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.stringContaining("INSERT INTO activity_events")]),
      "user-creator",
      "new_follower",
      "user-follower",
      expect.any(String),
      expect.any(String)
    );
  });

  it("inserts paired tip events for sender and receiver", async () => {
    sqlMock.mockResolvedValueOnce({});
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "tip-recv" }] });
    sqlMock.mockResolvedValueOnce({});
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "tip-sent" }] });

    await insertActivityEvent({
      userId: "creator-1",
      type: "tip_received",
      actorId: "viewer-1",
      metadata: { amount: "25", currency: "XLM", tx_hash: "abc123" },
    });

    await insertActivityEvent({
      userId: "viewer-1",
      type: "tip_sent",
      actorId: "creator-1",
      metadata: { amount: "25", currency: "XLM", tx_hash: "abc123" },
    });

    expect(sqlMock).toHaveBeenCalledTimes(4);
  });
});
