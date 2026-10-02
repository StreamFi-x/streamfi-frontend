import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(query: string) {
  return new NextRequest(
    `http://localhost/api/routesF/peer-benchmark-comparison${query}`
  );
}

describe("/api/routesF/peer-benchmark-comparison", () => {
  it("places the top creator at the top percentile", async () => {
    const res = await GET(makeReq("?creator_id=creator-top"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.creator.creator_id).toBe("creator-top");
    expect(data.percentile).toBe(100);
    expect(data.peer_avg.followers).toBeCloseTo(2150, 5);
  });

  it("places the median creator around the middle percentile", async () => {
    const res = await GET(makeReq("?creator_id=creator-mid"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.creator.creator_id).toBe("creator-mid");
    expect(data.percentile).toBe(50);
  });

  it("places the bottom creator at the lowest percentile", async () => {
    const res = await GET(makeReq("?creator_id=creator-bottom"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.creator.creator_id).toBe("creator-bottom");
    expect(data.percentile).toBe(0);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeReq(""));

    expect(res.status).toBe(400);
  });
});
