import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(viewerId?: string) {
  const url = new URL("http://localhost/api/routesF/topic-cluster-feed");
  if (viewerId !== undefined) {url.searchParams.set("viewer_id", viewerId);}
  return new NextRequest(url);
}

describe("GET /api/routesF/topic-cluster-feed", () => {
  it("returns known clusters with their streams", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    const topics = data.clusters.map((c: { topic: string }) => c.topic);
    expect(topics).toEqual(expect.arrayContaining(["esports", "cooking", "chill music"]));
  });

  it("groups streams under the correct topic", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    const esports = data.clusters.find((c: { topic: string }) => c.topic === "esports");
    expect(esports.streams).toHaveLength(3);
    expect(esports.streams.map((s: { stream_id: string }) => s.stream_id).sort()).toEqual(
      ["stream-1", "stream-2", "stream-7"].sort(),
    );
  });

  it("sorts clusters by aggregate viewer count descending", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    // esports: 1420+980+2210=4610, chill music: 1105+730+355=2190, cooking: 640+420=1060
    const topics = data.clusters.map((c: { topic: string }) => c.topic);
    expect(topics).toEqual(["esports", "chill music", "cooking"]);
  });

  it("works with an optional viewer_id present", async () => {
    const res = await GET(makeReq("viewer-123"));
    expect(res.status).toBe(200);
  });

  it("stream objects do not leak the topic field (topic lives on the cluster)", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    const esports = data.clusters.find((c: { topic: string }) => c.topic === "esports");
    expect(esports.streams[0].topic).toBeUndefined();
  });
});
