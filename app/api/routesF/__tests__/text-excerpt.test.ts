/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../text-excerpt/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/text-excerpt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/text-excerpt", () => {
  const sampleText = "The quick brown fox jumps over the lazy dog. This is a sample text for testing purposes.";

  it("extracts excerpt around keyword in middle of text", async () => {
    const res = await POST(makeReq({
      text: sampleText,
      keyword: "fox",
      radius: 10
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.excerpt).toBe("brown fox jumps ov");
    expect(data.match_index).toBe(16);
    expect(data.highlighted).toBeUndefined();
  });

  it("extracts excerpt with highlighting", async () => {
    const res = await POST(makeReq({
      text: sampleText,
      keyword: "fox",
      radius: 10,
      highlight: true
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.excerpt).toBe("brown fox jumps ov");
    expect(data.highlighted).toBe("brown <mark>fox</mark> jumps ov");
    expect(data.match_index).toBe(16);
  });

  it("handles keyword at start of text", async () => {
    const res = await POST(makeReq({
      text: sampleText,
      keyword: "The",
      radius: 15
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.excerpt).toBe("The quick brown f");
    expect(data.match_index).toBe(0);
  });

  it("handles keyword at end of text", async () => {
    const res = await POST(makeReq({
      text: sampleText,
      keyword: "purposes",
      radius: 20
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.excerpt).toBe("for testing purposes.");
    expect(data.match_index).toBe(75);
  });

  it("uses default radius of 50", async () => {
    const res = await POST(makeReq({
      text: sampleText,
      keyword: "fox"
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.excerpt).toBe("The quick brown fox jumps over the lazy dog. This is a sample text for testing purposes.");
    expect(data.match_index).toBe(16);
  });

  it("handles case-insensitive matching", async () => {
    const res = await POST(makeReq({
      text: sampleText,
      keyword: "QUICK",
      radius: 10
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.excerpt).toBe("The quick brown f");
    expect(data.match_index).toBe(4);
  });

  it("preserves original case in excerpt", async () => {
    const res = await POST(makeReq({
      text: "Hello WORLD this is a Test",
      keyword: "world",
      radius: 10,
      highlight: true
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.excerpt).toBe("Hello WORLD this i");
    expect(data.highlighted).toBe("Hello <mark>WORLD</mark> this i");
  });

  it("returns 404 when keyword not found", async () => {
    const res = await POST(makeReq({
      text: sampleText,
      keyword: "elephant"
    }));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Keyword not found in text");
  });

  it("handles empty keyword", async () => {
    const res = await POST(makeReq({
      text: sampleText,
      keyword: ""
    }));

    expect(res.status).toBe(400);
  });

  it("handles missing text field", async () => {
    const res = await POST(makeReq({
      keyword: "test"
    }));

    expect(res.status).toBe(400);
  });

  it("handles invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routesF/text-excerpt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "invalid json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("handles radius of 0", async () => {
    const res = await POST(makeReq({
      text: sampleText,
      keyword: "fox",
      radius: 0
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.excerpt).toBe("fox");
    expect(data.match_index).toBe(16);
  });

  it("handles very large radius", async () => {
    const res = await POST(makeReq({
      text: "Short text with keyword here",
      keyword: "keyword",
      radius: 1000
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.excerpt).toBe("Short text with keyword here");
    expect(data.match_index).toBe(16);
  });

  it("finds first occurrence when keyword appears multiple times", async () => {
    const text = "The cat and the dog and the cat again";
    const res = await POST(makeReq({
      text,
      keyword: "cat",
      radius: 5
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.match_index).toBe(4); // First occurrence
    expect(data.excerpt).toBe("The cat and t");
  });
});