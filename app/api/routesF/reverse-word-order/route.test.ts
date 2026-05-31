import { POST } from "./route";

describe("Reverse Word Order API", () => {
  it("should return 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/routesF/reverse-word-order", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when text is missing", async () => {
    const req = new Request("http://localhost/api/routesF/reverse-word-order", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when text is not a string", async () => {
    const req = new Request("http://localhost/api/routesF/reverse-word-order", {
      method: "POST",
      body: JSON.stringify({ text: 42 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("reverses words in a simple sentence", async () => {
    const req = new Request("http://localhost/api/routesF/reverse-word-order", {
      method: "POST",
      body: JSON.stringify({ text: "hello world" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe("world hello");
  });

  it("collapses multiple internal spaces to a single space", async () => {
    const req = new Request("http://localhost/api/routesF/reverse-word-order", {
      method: "POST",
      body: JSON.stringify({ text: "hello   world   foo" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe("foo world hello");
  });

  it("trims leading and trailing whitespace", async () => {
    const req = new Request("http://localhost/api/routesF/reverse-word-order", {
      method: "POST",
      body: JSON.stringify({ text: "  hello world  " }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe("world hello");
  });

  it("handles a single word", async () => {
    const req = new Request("http://localhost/api/routesF/reverse-word-order", {
      method: "POST",
      body: JSON.stringify({ text: "hello" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe("hello");
  });

  it("handles an empty string", async () => {
    const req = new Request("http://localhost/api/routesF/reverse-word-order", {
      method: "POST",
      body: JSON.stringify({ text: "" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe("");
  });

  it("handles a string with only whitespace", async () => {
    const req = new Request("http://localhost/api/routesF/reverse-word-order", {
      method: "POST",
      body: JSON.stringify({ text: "   " }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe("");
  });

  it("handles mixed tabs and spaces", async () => {
    const req = new Request("http://localhost/api/routesF/reverse-word-order", {
      method: "POST",
      body: JSON.stringify({ text: "foo\t\tbar  baz" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe("baz bar foo");
  });

  it("reverses a multi-word sentence correctly", async () => {
    const req = new Request("http://localhost/api/routesF/reverse-word-order", {
      method: "POST",
      body: JSON.stringify({ text: "the quick brown fox" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe("fox brown quick the");
  });
});
