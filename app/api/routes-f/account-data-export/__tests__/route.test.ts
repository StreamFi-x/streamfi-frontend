/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { getExport, resetStore, setCompletionDelayMs } from "../store";

function getReq(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/account-data-export${query}`
  );
}

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/account-data-export", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetStore();
  jest.useRealTimers();
});

describe("POST /api/routes-f/account-data-export", () => {
  it("requires account_id", async () => {
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/account-data-export",
      { method: "POST", body: "not-json" }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("enqueues an export with queued status", async () => {
    const res = await POST(postReq({ account_id: "account_a" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe("queued");
    expect(typeof body.export_id).toBe("string");
    expect(getExport(body.export_id)?.status).toBe("queued");
  });

  it("assigns distinct export ids to successive jobs", async () => {
    const first = await POST(postReq({ account_id: "account_a" }));
    const second = await POST(postReq({ account_id: "account_a" }));
    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.export_id).not.toBe(secondBody.export_id);
  });
});

describe("GET /api/routes-f/account-data-export", () => {
  it("requires export_id", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(400);
  });

  it("404s for an unknown export", async () => {
    const res = await GET(getReq("?export_id=acct_exp_missing"));
    expect(res.status).toBe(404);
  });
});

describe("export lifecycle (queued -> ready, emailed)", () => {
  it("transitions to ready and records when it was emailed", async () => {
    jest.useFakeTimers();
    setCompletionDelayMs(100);

    const create = await POST(postReq({ account_id: "account_a" }));
    const { export_id } = await create.json();

    const queued = await GET(getReq(`?export_id=${export_id}`));
    const queuedBody = await queued.json();
    expect(queuedBody.status).toBe("queued");
    expect(queuedBody.emailed_at).toBeUndefined();

    jest.advanceTimersByTime(100);

    const ready = await GET(getReq(`?export_id=${export_id}`));
    const readyBody = await ready.json();
    expect(readyBody.status).toBe("ready");
    expect(readyBody.download_url).toContain(export_id);
    expect(readyBody.emailed_at).toEqual(expect.any(String));
  });
});
