import { GET } from "../route";
import { uuidV4, uuidV7, isValidUuid } from "../_lib/generators";
import { NextRequest } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeGet(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/uuid${query}`);
}

describe("UUID v4 generation", () => {
  it("produces a valid UUID format", () => {
    const id = uuidV4();
    expect(UUID_RE.test(id)).toBe(true);
  });

  it("version nibble is '4'", () => {
    const id = uuidV4();
    expect(id[14]).toBe("4");
  });

  it("variant bits are correct (8, 9, a, or b)", () => {
    const id = uuidV4();
    expect(["8", "9", "a", "b"]).toContain(id[19]);
  });

  it("generates unique values", () => {
    const ids = new Set(Array.from({ length: 1000 }, uuidV4));
    expect(ids.size).toBe(1000);
  });
});

describe("UUID v7 generation", () => {
  it("produces a valid UUID format", () => {
    const id = uuidV7();
    expect(UUID_RE.test(id)).toBe(true);
  });

  it("version nibble is '7'", () => {
    const id = uuidV7();
    expect(id[14]).toBe("7");
  });

  it("generates unique values", () => {
    const ids = new Set(Array.from({ length: 1000 }, uuidV7));
    expect(ids.size).toBe(1000);
  });

  it("is time-ordered (each successive UUID is >= previous)", () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      ids.push(uuidV7());
    }
    for (let i = 1; i < ids.length; i++) {
      // Compare first 13 chars (timestamp + version segment)
      expect(ids[i].replace(/-/g, "").slice(0, 12) >= ids[i - 1].replace(/-/g, "").slice(0, 12)).toBe(true);
    }
  });
});

describe("isValidUuid helper", () => {
  it("accepts valid v4", () => expect(isValidUuid(uuidV4())).toBe(true));
  it("accepts valid v7", () => expect(isValidUuid(uuidV7())).toBe(true));
  it("rejects empty string", () => expect(isValidUuid("")).toBe(false));
  it("rejects short string", () => expect(isValidUuid("abc")).toBe(false));
  it("rejects wrong format", () => expect(isValidUuid("not-a-uuid")).toBe(false));
});

describe("GET /api/routes-f/uuid", () => {
  it("defaults to v4 with count=1", async () => {
    const res = await GET(makeGet(""));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.version).toBe("v4");
    expect(data.uuids).toHaveLength(1);
    expect(UUID_RE.test(data.uuids[0])).toBe(true);
  });

  it("generates requested count of v4 UUIDs", async () => {
    const res = await GET(makeGet("?version=v4&count=5"));
    const data = await res.json();
    expect(data.uuids).toHaveLength(5);
    data.uuids.forEach((id: string) => expect(UUID_RE.test(id)).toBe(true));
  });

  it("generates v7 UUIDs", async () => {
    const res = await GET(makeGet("?version=v7&count=3"));
    const data = await res.json();
    expect(data.version).toBe("v7");
    expect(data.uuids).toHaveLength(3);
    data.uuids.forEach((id: string) => expect(id[14]).toBe("7"));
  });

  it("rejects invalid version", async () => {
    const res = await GET(makeGet("?version=v3"));
    expect(res.status).toBe(400);
  });

  it("rejects count > 100", async () => {
    const res = await GET(makeGet("?count=101"));
    expect(res.status).toBe(400);
  });

  it("rejects count = 0", async () => {
    const res = await GET(makeGet("?count=0"));
    expect(res.status).toBe(400);
  });

  it("rejects non-numeric count", async () => {
    const res = await GET(makeGet("?count=abc"));
    expect(res.status).toBe(400);
  });

  it("generates exactly 100 UUIDs at max count", async () => {
    const res = await GET(makeGet("?count=100"));
    const data = await res.json();
    expect(data.uuids).toHaveLength(100);
  });
});
