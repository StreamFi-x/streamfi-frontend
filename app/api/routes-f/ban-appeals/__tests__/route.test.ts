import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { POST as POSTResolve } from "../resolve/route";
import { __resetBanAppealsStore } from "../store";

const BASE = "http://localhost/api/routes-f/ban-appeals";
const RESOLVE = `${BASE}/resolve`;

function req(
  method: string,
  url: string,
  body?: object
): NextRequest {
  return new NextRequest(url, {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });
}

beforeEach(() => {
  __resetBanAppealsStore();
});

describe("Ban appeals lifecycle", () => {
  it("submits an appeal and lists it as pending", async () => {
    const createRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-1",
        viewer_id: "viewer-1",
        message: "I did not break any rules.",
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created).toEqual({
      appeal_id: expect.any(String),
      status: "pending",
    });

    const listRes = await GET(req("GET", `${BASE}?creator_id=creator-1`));
    expect(listRes.status).toBe(200);
    const listed = await listRes.json();
    expect(listed.appeals).toHaveLength(1);
    expect(listed.appeals[0]).toMatchObject({
      appeal_id: created.appeal_id,
      viewer_id: "viewer-1",
      message: "I did not break any rules.",
      status: "pending",
    });
  });

  it("resolves an appeal as accepted and removes it from pending list", async () => {
    const createRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-1",
        viewer_id: "viewer-2",
        message: "Please unban me.",
      })
    );
    const { appeal_id } = await createRes.json();

    const resolveRes = await POSTResolve(
      req("POST", RESOLVE, {
        appeal_id,
        decision: "accept",
        mod_note: "First offense, lifting ban.",
      })
    );
    expect(resolveRes.status).toBe(200);
    const resolved = await resolveRes.json();
    expect(resolved).toMatchObject({
      appeal_id,
      status: "accepted",
      mod_note: "First offense, lifting ban.",
    });
    expect(resolved.resolved_at).toBeTruthy();

    const listRes = await GET(req("GET", `${BASE}?creator_id=creator-1`));
    const listed = await listRes.json();
    expect(listed.appeals).toHaveLength(0);
  });

  it("resolves an appeal as rejected", async () => {
    const createRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-2",
        viewer_id: "viewer-3",
        message: "It was a joke.",
      })
    );
    const { appeal_id } = await createRes.json();

    const resolveRes = await POSTResolve(
      req("POST", RESOLVE, {
        appeal_id,
        decision: "reject",
      })
    );
    expect(resolveRes.status).toBe(200);
    expect((await resolveRes.json()).status).toBe("rejected");
  });

  it("returns 409 when resolving an already resolved appeal", async () => {
    const createRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-3",
        viewer_id: "viewer-4",
        message: "Appeal text.",
      })
    );
    const { appeal_id } = await createRes.json();

    await POSTResolve(
      req("POST", RESOLVE, { appeal_id, decision: "reject" })
    );

    const secondResolve = await POSTResolve(
      req("POST", RESOLVE, { appeal_id, decision: "accept" })
    );
    expect(secondResolve.status).toBe(409);
  });

  it("returns 409 for duplicate pending appeals from the same viewer", async () => {
    await POST(
      req("POST", BASE, {
        creator_id: "creator-4",
        viewer_id: "viewer-5",
        message: "First appeal.",
      })
    );

    const dupRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-4",
        viewer_id: "viewer-5",
        message: "Second appeal.",
      })
    );
    expect(dupRes.status).toBe(409);
  });

  it("returns 400 when creator_id is missing on GET", async () => {
    const res = await GET(req("GET", BASE));
    expect(res.status).toBe(400);
  });

  it("returns 404 when resolving unknown appeal_id", async () => {
    const res = await POSTResolve(
      req("POST", RESOLVE, {
        appeal_id: "00000000-0000-0000-0000-000000000099",
        decision: "accept",
      })
    );
    expect(res.status).toBe(404);
  });
});
