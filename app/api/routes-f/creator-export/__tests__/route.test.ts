/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { getExport, resetStore, setCompletionDelayMs } from "../store";

function getReq(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/creator-export${query}`
  );
}

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/creator-export", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetStore();
  jest.useRealTimers();
});

describe("POST /api/routes-f/creator-export", () => {
  it("requires creator_id", async () => {
    const res = await POST(postReq({ sections: ["streams"] }));
    expect(res.status).toBe(400);
  });

  it("requires valid sections", async () => {
    const res = await POST(
      postReq({ creator_id: "creator_a", sections: ["bad"] })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("invalid section");
  });

  it("enqueues an export with queued status", async () => {
    const res = await POST(
      postReq({
        creator_id: "creator_a",
        sections: ["streams", "tips"],
      })
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe("queued");
    expect(typeof body.export_id).toBe("string");
    expect(getExport(body.export_id)?.status).toBe("queued");
  });
});

describe("GET /api/routes-f/creator-export", () => {
  it("requires export_id", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(400);
  });

  it("404s for an unknown export", async () => {
    const res = await GET(getReq("?export_id=exp_missing"));
    expect(res.status).toBe(404);
  });
});

describe("export lifecycle (queued -> ready)", () => {
  it("transitions to ready after the synthetic delay", async () => {
    jest.useFakeTimers();
    setCompletionDelayMs(100);

    const create = await POST(
      postReq({
        creator_id: "creator_a",
        sections: ["followers", "subscribers"],
      })
    );
    const { export_id } = await create.json();

    const queued = await GET(getReq(`?export_id=${export_id}`));
    expect((await queued.json()).status).toBe("queued");

    jest.advanceTimersByTime(100);

    const ready = await GET(getReq(`?export_id=${export_id}`));
    const readyBody = await ready.json();
    expect(readyBody.status).toBe("ready");
    expect(readyBody.download_url).toContain(export_id);
  });
});
