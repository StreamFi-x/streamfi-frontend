import { POST } from "../route";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/sentence-tokenize";

function req(body: object) {
  return new NextRequest(BASE, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /sentence-tokenize", () => {
  it("splits simple sentences", async () => {
    const res = await POST(req({ text: "Hello world. Foo bar. Baz." }));
    expect(res.status).toBe(200);
    const { sentences, count } = await res.json();
    expect(count).toBe(3);
    expect(sentences[0]).toBe("Hello world.");
    expect(sentences[1]).toBe("Foo bar.");
    expect(sentences[2]).toBe("Baz.");
  });

  it("does not split on Mr. abbreviation", async () => {
    const res = await POST(req({ text: "Mr. Smith went to the store. He bought milk." }));
    const { sentences } = await res.json();
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toBe("Mr. Smith went to the store.");
    expect(sentences[1]).toBe("He bought milk.");
  });

  it("does not split on Dr. abbreviation", async () => {
    const res = await POST(req({ text: "Dr. Jones is a great physician. She treats patients daily." }));
    const { sentences } = await res.json();
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toContain("Dr. Jones");
  });

  it("does not split on Inc. abbreviation", async () => {
    const res = await POST(req({ text: "Apple Inc. reported earnings. They were strong." }));
    const { sentences } = await res.json();
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toContain("Inc.");
  });

  it("does not split on decimal numbers", async () => {
    const res = await POST(req({ text: "Pi is 3.14. It is irrational." }));
    const { sentences } = await res.json();
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toBe("Pi is 3.14.");
    expect(sentences[1]).toBe("It is irrational.");
  });

  it("handles ellipses without splitting", async () => {
    const res = await POST(req({ text: "Wait... it actually worked. Great news." }));
    const { sentences } = await res.json();
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toContain("...");
  });

  it("handles exclamation and question marks", async () => {
    const res = await POST(req({ text: "Really? Yes! It works." }));
    const { sentences } = await res.json();
    expect(sentences).toHaveLength(3);
  });

  it("handles sentence ending with closing quote", async () => {
    const res = await POST(req({ text: 'He said "Hello." She replied.' }));
    const { sentences } = await res.json();
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toContain("Hello.");
  });

  it("handles empty string", async () => {
    const res = await POST(req({ text: "" }));
    const { sentences, count } = await res.json();
    expect(count).toBe(0);
    expect(sentences).toEqual([]);
  });

  it("returns 400 for missing text", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-string text", async () => {
    const res = await POST(req({ text: 42 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const r = new NextRequest(BASE, { method: "POST", body: "not-json" });
    const res = await POST(r);
    expect(res.status).toBe(400);
  });

  it("count equals sentences length", async () => {
    const res = await POST(req({ text: "One. Two. Three." }));
    const { sentences, count } = await res.json();
    expect(count).toBe(sentences.length);
  });
});
