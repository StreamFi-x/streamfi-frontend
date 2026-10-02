import { NextRequest } from "next/server";
import { GET, PUT } from "../route";
import {
  DEFAULT_POINTS_PER_MINUTE_WATCHED,
  DEFAULT_POINTS_PER_CHAT_MESSAGE,
} from "../store";

function makeGet(creatorId?: string): NextRequest {
  const url = creatorId
    ? `http://localhost/api/routes-f/channel-points-earn-rate-config?creator_id=${creatorId}`
    : "http://localhost/api/routes-f/channel-points-earn-rate-config";
  return new NextRequest(url);
}

function makePut(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/channel-points-earn-rate-config", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/routes-f/channel-points-earn-rate-config", () => {
  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
  });

  it("returns default rates for an unconfigured creator", async () => {
    const res = await GET(makeGet("creator_unconfigured"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.points_per_minute_watched).toBe(DEFAULT_POINTS_PER_MINUTE_WATCHED);
    expect(body.points_per_chat_message).toBe(DEFAULT_POINTS_PER_CHAT_MESSAGE);
  });
});

describe("PUT /api/routes-f/channel-points-earn-rate-config", () => {
  it("updates and persists the earn rate config", async () => {
    const putRes = await PUT(
      makePut({
        creator_id: "creator_config_test",
        points_per_minute_watched: 20,
        points_per_chat_message: 3,
      })
    );
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.points_per_minute_watched).toBe(20);
    expect(putBody.points_per_chat_message).toBe(3);

    const getRes = await GET(makeGet("creator_config_test"));
    const getBody = await getRes.json();
    expect(getBody.points_per_minute_watched).toBe(20);
    expect(getBody.points_per_chat_message).toBe(3);
  });

  it("allows partial updates that preserve the other field", async () => {
    await PUT(
      makePut({
        creator_id: "creator_partial",
        points_per_minute_watched: 15,
        points_per_chat_message: 2,
      })
    );

    const res = await PUT(
      makePut({ creator_id: "creator_partial", points_per_minute_watched: 25 })
    );
    const body = await res.json();
    expect(body.points_per_minute_watched).toBe(25);
    expect(body.points_per_chat_message).toBe(2);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await PUT(makePut({ points_per_minute_watched: 10 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when neither rate field is provided", async () => {
    const res = await PUT(makePut({ creator_id: "creator_x" }));
    expect(res.status).toBe(400);
  });

  it.each([-1, "10", null, true])(
    "returns 400 for an invalid points_per_minute_watched value: %p",
    async value => {
      const res = await PUT(
        makePut({ creator_id: "creator_x", points_per_minute_watched: value })
      );
      expect(res.status).toBe(400);
    }
  );

  it.each([-1, "10", null, true])(
    "returns 400 for an invalid points_per_chat_message value: %p",
    async value => {
      const res = await PUT(
        makePut({ creator_id: "creator_x", points_per_chat_message: value })
      );
      expect(res.status).toBe(400);
    }
  );

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/channel-points-earn-rate-config", {
      method: "PUT",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("accepts zero as a valid rate", async () => {
    const res = await PUT(
      makePut({
        creator_id: "creator_zero",
        points_per_minute_watched: 0,
        points_per_chat_message: 0,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.points_per_minute_watched).toBe(0);
    expect(body.points_per_chat_message).toBe(0);
  });
});
