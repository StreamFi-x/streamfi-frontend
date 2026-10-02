/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { POST as CREATE } from "../create/route";
import { POST as SYNC } from "../sync/route";
import { POST as JOIN } from "../join/route";
import { __resetStore, getPartyByJoinCode } from "../store";

function jsonReq(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function getReq(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/watch-party${query}`);
}

async function createParty(host_id = "host_1", vod_id = "vod_1") {
  const res = await CREATE(
    jsonReq("/api/routes-f/watch-party/create", { host_id, vod_id })
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  __resetStore();
});

describe("POST create", () => {
  it("creates a party and returns party_id + join_code", async () => {
    const { res, body } = await createParty();
    expect(res.status).toBe(201);
    expect(typeof body.party_id).toBe("string");
    expect(typeof body.join_code).toBe("string");
    expect(body.join_code.length).toBe(6);
  });

  it("indexes the party by its join_code", async () => {
    const { body } = await createParty();
    const party = getPartyByJoinCode(body.join_code);
    expect(party?.party_id).toBe(body.party_id);
  });

  it("requires host_id", async () => {
    const res = await CREATE(
      jsonReq("/api/routes-f/watch-party/create", { vod_id: "vod_1" })
    );
    expect(res.status).toBe(400);
  });

  it("requires vod_id", async () => {
    const res = await CREATE(
      jsonReq("/api/routes-f/watch-party/create", { host_id: "host_1" })
    );
    expect(res.status).toBe(400);
  });

  it("starts paused at position 0 with the host as the only member", async () => {
    const { body } = await createParty();
    const state = await (await GET(getReq(`?party_id=${body.party_id}`))).json();
    expect(state.paused).toBe(true);
    expect(state.position_seconds).toBe(0);
    expect(state.members).toEqual(["host_1"]);
  });
});

describe("GET state", () => {
  it("requires party_id", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(400);
  });

  it("404s for an unknown party", async () => {
    const res = await GET(getReq("?party_id=nope"));
    expect(res.status).toBe(404);
  });
});

describe("POST join", () => {
  it("adds a viewer to the party", async () => {
    const { body } = await createParty();
    const res = await JOIN(
      jsonReq("/api/routes-f/watch-party/join", {
        party_id: body.party_id,
        viewer_id: "v2",
      })
    );
    expect(res.status).toBe(200);
    const state = await res.json();
    expect(state.members).toContain("v2");
  });

  it("is idempotent", async () => {
    const { body } = await createParty();
    await JOIN(
      jsonReq("/api/routes-f/watch-party/join", {
        party_id: body.party_id,
        viewer_id: "v2",
      })
    );
    const res = await JOIN(
      jsonReq("/api/routes-f/watch-party/join", {
        party_id: body.party_id,
        viewer_id: "v2",
      })
    );
    const state = await res.json();
    expect(state.members.filter((m: string) => m === "v2")).toHaveLength(1);
  });

  it("404s for an unknown party", async () => {
    const res = await JOIN(
      jsonReq("/api/routes-f/watch-party/join", {
        party_id: "nope",
        viewer_id: "v2",
      })
    );
    expect(res.status).toBe(404);
  });

  it("requires viewer_id", async () => {
    const { body } = await createParty();
    const res = await JOIN(
      jsonReq("/api/routes-f/watch-party/join", { party_id: body.party_id })
    );
    expect(res.status).toBe(400);
  });
});

describe("POST sync", () => {
  it("updates position and paused state", async () => {
    const { body } = await createParty();
    const res = await SYNC(
      jsonReq("/api/routes-f/watch-party/sync", {
        party_id: body.party_id,
        position_seconds: 120,
        paused: false,
      })
    );
    expect(res.status).toBe(200);
    const state = await res.json();
    expect(state.position_seconds).toBe(120);
    expect(state.paused).toBe(false);
  });

  it("rejects a negative position", async () => {
    const { body } = await createParty();
    const res = await SYNC(
      jsonReq("/api/routes-f/watch-party/sync", {
        party_id: body.party_id,
        position_seconds: -5,
        paused: false,
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects a non-boolean paused", async () => {
    const { body } = await createParty();
    const res = await SYNC(
      jsonReq("/api/routes-f/watch-party/sync", {
        party_id: body.party_id,
        position_seconds: 10,
        paused: "yes",
      })
    );
    expect(res.status).toBe(400);
  });

  it("404s for an unknown party", async () => {
    const res = await SYNC(
      jsonReq("/api/routes-f/watch-party/sync", {
        party_id: "nope",
        position_seconds: 10,
        paused: false,
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("create -> join -> sync flow", () => {
  it("coordinates state across viewers", async () => {
    const { body: created } = await createParty("host_1", "vod_42");

    // A viewer joins.
    await JOIN(
      jsonReq("/api/routes-f/watch-party/join", {
        party_id: created.party_id,
        viewer_id: "v2",
      })
    );

    // The host syncs playback forward and unpauses.
    await SYNC(
      jsonReq("/api/routes-f/watch-party/sync", {
        party_id: created.party_id,
        position_seconds: 300,
        paused: false,
      })
    );

    // The viewer polls the latest state and sees the synced position.
    const state = await (
      await GET(getReq(`?party_id=${created.party_id}`))
    ).json();
    expect(state.members).toEqual(["host_1", "v2"]);
    expect(state.position_seconds).toBe(300);
    expect(state.paused).toBe(false);
    expect(state.vod_id).toBe("vod_42");
  });
});
