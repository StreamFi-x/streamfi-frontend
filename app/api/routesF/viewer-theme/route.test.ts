import { NextRequest } from "next/server";
import { GET, PUT, __resetThemeStore } from "./route";

function makeGet(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/routesF/viewer-theme");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

function makePut(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/viewer-theme", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Viewer Theme API", () => {
  beforeEach(() => {
    __resetThemeStore();
  });

  it("returns the default theme for a viewer with no saved choice", async () => {
    const res = await GET(makeGet({ viewer_id: "v001" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.theme).toBe("light");
    expect(data.updated_at).toBeNull();
  });

  it("sets and retrieves a theme", async () => {
    const putRes = await PUT(makePut({ viewer_id: "v001", theme: "dark" }));
    const putData = await putRes.json();

    expect(putRes.status).toBe(200);
    expect(putData.theme).toBe("dark");
    expect(typeof putData.updated_at).toBe("string");

    const getRes = await GET(makeGet({ viewer_id: "v001" }));
    const getData = await getRes.json();

    expect(getData.theme).toBe("dark");
    expect(getData.updated_at).toBe(putData.updated_at);
  });

  it("supports the high-contrast theme", async () => {
    await PUT(makePut({ viewer_id: "v002", theme: "high-contrast" }));
    const data = await (await GET(makeGet({ viewer_id: "v002" }))).json();
    expect(data.theme).toBe("high-contrast");
  });

  it("keeps preferences per viewer", async () => {
    await PUT(makePut({ viewer_id: "v001", theme: "dark" }));
    await PUT(makePut({ viewer_id: "v002", theme: "high-contrast" }));

    expect((await (await GET(makeGet({ viewer_id: "v001" }))).json()).theme).toBe("dark");
    expect((await (await GET(makeGet({ viewer_id: "v002" }))).json()).theme).toBe(
      "high-contrast"
    );
  });

  it("rejects a theme outside the bundled list with 400", async () => {
    const res = await PUT(makePut({ viewer_id: "v001", theme: "solarized" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid theme");

    // The invalid write must not have replaced the default
    const getData = await (await GET(makeGet({ viewer_id: "v001" }))).json();
    expect(getData.theme).toBe("light");
  });

  it("rejects a missing viewer_id on GET with 400", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
  });

  it("rejects a missing viewer_id on PUT with 400", async () => {
    const res = await PUT(makePut({ theme: "dark" }));
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON with 400", async () => {
    const req = new NextRequest("http://localhost/api/routesF/viewer-theme", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{broken",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
