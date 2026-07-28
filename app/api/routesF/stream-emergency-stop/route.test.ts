import { NextRequest } from "next/server";
import { POST, __getEventLog, __resetEmergencyStopState } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/stream-emergency-stop", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID = { stream_id: "s501", reason: "safety", initiator_id: "mod_007" };

describe("Stream Emergency Stop API", () => {
  beforeEach(() => {
    __resetEmergencyStopState();
  });

  it("ends a live stream and logs the reason", async () => {
    const res = await POST(makeReq(VALID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(typeof data.ended_at).toBe("string");
    expect(data.already_ended).toBe(false);

    const log = __getEventLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      stream_id: "s501",
      reason: "safety",
      initiator_id: "mod_007",
      ended_at: data.ended_at,
    });
  });

  it("is idempotent — repeated calls return the same ended_at", async () => {
    const first = await (await POST(makeReq(VALID))).json();
    const second = await (
      await POST(makeReq({ ...VALID, initiator_id: "mod_008" }))
    ).json();

    expect(second.ended_at).toBe(first.ended_at);
    expect(second.already_ended).toBe(true);
    // The repeat is not logged as a second end event
    expect(__getEventLog()).toHaveLength(1);
  });

  it("tracks streams independently", async () => {
    const a = await (await POST(makeReq(VALID))).json();
    const b = await (
      await POST(makeReq({ ...VALID, stream_id: "s502", reason: "technical" }))
    ).json();

    expect(a.already_ended).toBe(false);
    expect(b.already_ended).toBe(false);
    expect(__getEventLog()).toHaveLength(2);
  });

  it("accepts every documented reason", async () => {
    for (const [i, reason] of ["technical", "safety", "compliance", "other"].entries()) {
      const streamId = ["s501", "s502", "s503", "s777"][i];
      const res = await POST(
        makeReq({ stream_id: streamId, reason, initiator_id: "mod_007" })
      );
      expect(res.status).toBe(200);
    }
  });

  it("rejects an unknown reason with 400", async () => {
    const res = await POST(makeReq({ ...VALID, reason: "boredom" }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing stream_id with 400", async () => {
    const res = await POST(
      makeReq({ reason: "safety", initiator_id: "mod_007" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects a missing initiator_id with 400", async () => {
    const res = await POST(makeReq({ stream_id: "s501", reason: "safety" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown stream", async () => {
    const res = await POST(makeReq({ ...VALID, stream_id: "s999" }));
    expect(res.status).toBe(404);
  });

  it("rejects malformed JSON with 400", async () => {
    const req = new NextRequest(
      "http://localhost/api/routesF/stream-emergency-stop",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "###",
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
