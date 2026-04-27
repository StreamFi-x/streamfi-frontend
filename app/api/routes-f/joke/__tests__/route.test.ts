import { GET } from "../route";
import { GET as GETRandom } from "../random/route";
import { NextRequest } from "next/server";

function makeReq(url: string) {
  return new NextRequest(url);
}

describe("GET /api/routes-f/joke", () => {
  it("returns a joke with default params", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/joke"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.joke).toBeDefined();
    expect(body.joke.id).toBeDefined();
    expect(body.joke.category).toBeDefined();
  });

  it("returns a joke filtered by category=programming", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/joke?category=programming"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.joke.category).toBe("programming");
  });

  it("returns 400 for invalid category", async () => {
    const res = await GET(makeReq("http://localhost/api/routes-f/joke?category=invalid"));
    expect(res.status).toBe(400);
  });

  it("excludes seen joke ids", async () => {
    // Exclude all but id=1
    const allIds = Array.from({ length: 50 }, (_, i) => i + 1)
      .filter((id) => id !== 1)
      .join(",");
    const res = await GET(
      makeReq(`http://localhost/api/routes-f/joke?seen=${allIds}`)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.joke.id).toBe(1);
  });

  it("returns 404 when all jokes are excluded", async () => {
    const allIds = Array.from({ length: 50 }, (_, i) => i + 1).join(",");
    const res = await GET(
      makeReq(`http://localhost/api/routes-f/joke?seen=${allIds}`)
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/routes-f/joke/random", () => {
  it("returns a random joke", async () => {
    const res = await GETRandom();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.joke).toBeDefined();
    expect(typeof body.joke.id).toBe("number");
  });

  it("joke has expected shape", async () => {
    const res = await GETRandom();
    const body = await res.json();
    expect(body.joke).toHaveProperty("id");
    expect(body.joke).toHaveProperty("setup");
    expect(body.joke).toHaveProperty("punchline");
    expect(body.joke).toHaveProperty("category");
  });
});
