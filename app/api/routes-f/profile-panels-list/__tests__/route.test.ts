/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("../_lib/db", () => ({
  ensureProfilePanelsSchema: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const CHANNEL_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe("routes-f profile-panels-list", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 400 when channel is missing or not a UUID", async () => {
    const res = await GET(makeRequest("/api/routes-f/profile-panels-list"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the channel does not exist", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest(`/api/routes-f/profile-panels-list?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(404);
  });

  it("returns the channel's panels in position order", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] }).mockResolvedValueOnce({
      rows: [
        {
          id: "panel-1",
          title: "About",
          body: "Welcome to my channel",
          image_url: null,
          position: 0,
        },
        {
          id: "panel-2",
          title: "Schedule",
          body: "Live every day at 6pm",
          image_url: "https://example.com/schedule.png",
          position: 1,
        },
      ],
    });

    const res = await GET(
      makeRequest(`/api/routes-f/profile-panels-list?channel=${CHANNEL_ID}`)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.channel).toBe(CHANNEL_ID);
    expect(body.panels).toHaveLength(2);
    expect(body.panels[0].position).toBe(0);
    expect(body.panels[1].position).toBe(1);
  });

  it("returns an empty array when the channel has no panels", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest(`/api/routes-f/profile-panels-list?channel=${CHANNEL_ID}`)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.panels).toEqual([]);
  });

  it("returns 500 when the database throws", async () => {
    sqlMock.mockRejectedValueOnce(new Error("db down"));

    const res = await GET(
      makeRequest(`/api/routes-f/profile-panels-list?channel=${CHANNEL_ID}`)
    );

    expect(res.status).toBe(500);
  });
});
