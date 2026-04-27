import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/isbn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/isbn", () => {
  // Valid ISBN-10
  it("validates a known valid ISBN-10", async () => {
    const res = await POST(makeRequest({ isbn: "0-306-40615-2" }));
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.type).toBe("isbn-10");
    expect(data.normalized).toBe("0306406152");
    expect(data.convertible_to_13).toBe("9780306406157");
  });

  it("validates ISBN-10 ending in X", async () => {
    const res = await POST(makeRequest({ isbn: "0-19-853453-1" }));
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.type).toBe("isbn-10");
  });

  it("validates ISBN-10 with X check digit", async () => {
    const res = await POST(makeRequest({ isbn: "0-8044-2957-X" }));
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.type).toBe("isbn-10");
    expect(data.normalized).toBe("080442957X");
  });

  // Valid ISBN-13
  it("validates a known valid ISBN-13", async () => {
    const res = await POST(makeRequest({ isbn: "978-3-16-148410-0" }));
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.type).toBe("isbn-13");
    expect(data.normalized).toBe("9783161484100");
  });

  it("validates ISBN-13 without hyphens", async () => {
    const res = await POST(makeRequest({ isbn: "9780306406157" }));
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.type).toBe("isbn-13");
  });

  // Invalid ISBNs
  it("rejects invalid ISBN-10 (bad checksum)", async () => {
    const res = await POST(makeRequest({ isbn: "0306406153" }));
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.type).toBeNull();
  });

  it("rejects invalid ISBN-13 (bad checksum)", async () => {
    const res = await POST(makeRequest({ isbn: "9783161484101" }));
    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it("rejects random string", async () => {
    const res = await POST(makeRequest({ isbn: "not-an-isbn" }));
    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it("returns 400 when isbn is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  // ISBN-10 to ISBN-13 conversion
  it("converts valid ISBN-10 to ISBN-13", async () => {
    const res = await POST(makeRequest({ isbn: "0306406152" }));
    const data = await res.json();
    expect(data.convertible_to_13).toBe("9780306406157");
  });
});
