/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT, viewerPrefsStore } from "./route";

function makeGetReq(query: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/closed-captions?${query}`
  );
}

function makePutReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/closed-captions", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/closed-captions", () => {
  beforeEach(() => {
    viewerPrefsStore.clear();
  });

  it("GET with playback_id returns tracks array", async () => {
    const req = makeGetReq("playback_id=playback-001");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.tracks)).toBe(true);
    expect(data.tracks.length).toBe(2);
    expect(data.tracks[0].lang).toBe("en");
    expect(data.tracks[1].lang).toBe("es");
  });

  it("GET with unknown playback_id returns empty tracks", async () => {
    const req = makeGetReq("playback_id=unknown-999");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.tracks).toEqual([]);
  });

  it("GET with viewer_id returns captions_enabled and preferred_lang", async () => {
    // No prior prefs → defaults
    const req = makeGetReq("viewer_id=viewer-42");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(typeof data.captions_enabled).toBe("boolean");
    expect(data.captions_enabled).toBe(false);
    expect(data.preferred_lang).toBeNull();
  });

  it("PUT updates viewer prefs and returns them", async () => {
    const req = makePutReq({
      viewer_id: "viewer-42",
      captions_enabled: true,
      preferred_lang: "es",
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.captions_enabled).toBe(true);
    expect(data.preferred_lang).toBe("es");
  });

  it("GET after PUT reflects the updated prefs", async () => {
    // PUT first
    const putReq = makePutReq({
      viewer_id: "viewer-42",
      captions_enabled: true,
      preferred_lang: "fr",
    });
    await PUT(putReq);

    // Now GET
    const getReq = makeGetReq("viewer_id=viewer-42");
    const res = await GET(getReq);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.captions_enabled).toBe(true);
    expect(data.preferred_lang).toBe("fr");
  });
});
