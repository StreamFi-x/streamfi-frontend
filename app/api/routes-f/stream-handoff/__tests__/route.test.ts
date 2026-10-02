/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { __resetHandoffStore, getStream, upsertStream } from "../store";

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/stream-handoff", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function getReq(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/stream-handoff${query}`
  );
}

function seedStream(
  stream_id = "stream_1",
  current_host_id = "host_a",
  hosts: string[] = ["host_a", "host_b"]
) {
  upsertStream({ stream_id, current_host_id, hosts });
}

beforeEach(() => {
  __resetHandoffStore();
});

describe("POST /api/routes-f/stream-handoff", () => {
  it("hands off control from the current host to a permitted host", async () => {
    seedStream();
    const res = await POST(
      postReq({
        stream_id: "stream_1",
        from_user_id: "host_a",
        to_user_id: "host_b",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.handed_off_at).toBe("string");
    expect(new Date(body.handed_off_at).toString()).not.toBe("Invalid Date");

    // current host is updated.
    expect(getStream("stream_1")?.current_host_id).toBe("host_b");
  });

  it("rejects a handoff initiated by a non-current host (unauthorized)", async () => {
    seedStream();
    const res = await POST(
      postReq({
        stream_id: "stream_1",
        from_user_id: "host_b",
        to_user_id: "host_a",
      })
    );
    expect(res.status).toBe(403);
  });

  it("rejects a handoff to a user not in the hosts list", async () => {
    seedStream();
    const res = await POST(
      postReq({
        stream_id: "stream_1",
        from_user_id: "host_a",
        to_user_id: "stranger",
      })
    );
    expect(res.status).toBe(400);
  });

  it("404s when the stream does not exist", async () => {
    const res = await POST(
      postReq({
        stream_id: "nope",
        from_user_id: "host_a",
        to_user_id: "host_b",
      })
    );
    expect(res.status).toBe(404);
  });

  it.each([
    [{ from_user_id: "host_a", to_user_id: "host_b" }, "missing stream_id"],
    [{ stream_id: "stream_1", to_user_id: "host_b" }, "missing from_user_id"],
    [{ stream_id: "stream_1", from_user_id: "host_a" }, "missing to_user_id"],
    [
      {
        stream_id: "stream_1",
        from_user_id: "host_a",
        to_user_id: "host_a",
      },
      "from equals to",
    ],
  ])("400s for invalid body (%s)", async (body) => {
    seedStream();
    const res = await POST(postReq(body));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/stream-handoff", {
      method: "POST",
      body: "{not json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("appends to the handoff log on each successful handoff", async () => {
    seedStream("stream_2", "host_a", ["host_a", "host_b", "host_c"]);

    await POST(
      postReq({
        stream_id: "stream_2",
        from_user_id: "host_a",
        to_user_id: "host_b",
      })
    );
    await POST(
      postReq({
        stream_id: "stream_2",
        from_user_id: "host_b",
        to_user_id: "host_c",
      })
    );

    const res = await GET(getReq("?stream_id=stream_2"));
    const body = await res.json();
    expect(body.log).toHaveLength(2);
    expect(body.log[0].from_user_id).toBe("host_a");
    expect(body.log[0].to_user_id).toBe("host_b");
    expect(body.log[1].from_user_id).toBe("host_b");
    expect(body.log[1].to_user_id).toBe("host_c");
  });
});

describe("GET /api/routes-f/stream-handoff", () => {
  it("requires stream_id", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(400);
  });

  it("404s for an unknown stream", async () => {
    const res = await GET(getReq("?stream_id=nope"));
    expect(res.status).toBe(404);
  });

  it("returns an empty log for a stream with no handoffs yet", async () => {
    seedStream();
    const res = await GET(getReq("?stream_id=stream_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stream_id).toBe("stream_1");
    expect(body.log).toEqual([]);
  });
});
