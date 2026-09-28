jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/security/ip-geolocation", () => ({ locateIp: jest.fn() }));
jest.mock("@/lib/notifications", () => ({ writeNotification: jest.fn().mockResolvedValue(undefined) }));

import { sql } from "@vercel/postgres";
import { locateIp } from "@/lib/security/ip-geolocation";
import { writeNotification } from "@/lib/notifications";
import { recordLoginAndCheckTravel } from "@/lib/security/login-anomaly";

const sqlMock = sql as unknown as jest.Mock;
const locateMock = locateIp as jest.Mock;

describe("login anomaly integration", () => {
  beforeEach(() => jest.clearAllMocks());

  it("records a new login and passively notifies on synthetic impossible travel", async () => {
    locateMock.mockResolvedValue({ countryCode: "US", city: "New York", latitude: 40.7128, longitude: -74.006 });
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "previous", created_at: new Date(Date.now() - 60 * 60_000), latitude: 51.5072, longitude: -0.1276 }] })
      .mockResolvedValueOnce({ rows: [{ id: "current", created_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(recordLoginAndCheckTravel("user-1", "203.0.113.1")).resolves.toBe(true);
    expect(sqlMock).toHaveBeenCalledTimes(5);
    expect(writeNotification).toHaveBeenCalledWith("user-1", "security", expect.any(String), expect.stringContaining("If this was not you"));
  });

  it("records nearby travel without creating an alert", async () => {
    locateMock.mockResolvedValue({ countryCode: "US", city: "New York", latitude: 40.72, longitude: -74.01 });
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "previous", created_at: new Date(Date.now() - 60 * 60_000), latitude: 40.71, longitude: -74.0 }] })
      .mockResolvedValueOnce({ rows: [{ id: "current", created_at: new Date() }] });

    await expect(recordLoginAndCheckTravel("user-1", "203.0.113.2")).resolves.toBe(false);
    expect(sqlMock).toHaveBeenCalledTimes(4);
    expect(writeNotification).not.toHaveBeenCalled();
  });
});