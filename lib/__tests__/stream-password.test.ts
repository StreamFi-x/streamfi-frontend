jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

import { sql } from "@vercel/postgres";
import { backoffSeconds, hashAttemptIp, hashStreamPassword, streamPasswordLocked, verifyStreamPassword } from "@/lib/stream-password";

const sqlMock = sql as unknown as jest.Mock;

describe("stream password protection", () => {
  beforeEach(() => jest.clearAllMocks());

  it("allows a handful of typos before escalating the lockout", () => {
    expect(backoffSeconds(1)).toBe(0);
    expect(backoffSeconds(4)).toBe(0);
    expect(backoffSeconds(5)).toBe(30);
    expect(backoffSeconds(6)).toBe(60);
    expect(backoffSeconds(20)).toBe(900);
  });

  it("hashes passwords and verifies only the matching password", async () => {
    const hash = await hashStreamPassword("valid-private-stream-password");
    await expect(verifyStreamPassword("valid-private-stream-password", hash)).resolves.toBe(true);
    await expect(verifyStreamPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("isolates failed attempts by IP and stream session", async () => {
    const ipHash = hashAttemptIp("203.0.113.5");
    expect(ipHash).not.toContain("203.0.113.5");
    sqlMock.mockResolvedValue({ rows: [{ locked: false }] });
    await expect(streamPasswordLocked("session-a", ipHash)).resolves.toBe(false);
    expect(sqlMock.mock.calls[0][0].join("")).toContain("stream_session_id");
    expect(sqlMock.mock.calls[0][1]).toContain("session-a");
    expect(sqlMock.mock.calls[0][1]).toContain(ipHash);
  });

  it("blocks an IP/session pair after its cooldown is active", async () => {
    sqlMock.mockResolvedValue({ rows: [{ locked: true }] });
    await expect(streamPasswordLocked("session-a", hashAttemptIp("203.0.113.8"))).resolves.toBe(true);
  });
});