/**
 * @jest-environment node
 */
import { POST } from "../query-parse/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/query-parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/query-parse", () => {
  // --- Parse: basic query string ---
  it("parses basic query string", async () => {
    const res = await POST(
      makeReq({ mode: "parse", input: "foo=bar&baz=qux" })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.result.foo).toBe("bar");
    expect(d.result.baz).toBe("qux");
  });

  // --- Parse: leading ? is stripped ---
  it("strips leading ? in parse mode", async () => {
    const res = await POST(
      makeReq({ mode: "parse", input: "?foo=bar" })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.result.foo).toBe("bar");
  });

  // --- Parse: repeated keys become arrays ---
  it("parses repeated keys as arrays", async () => {
    const res = await POST(
      makeReq({ mode: "parse", input: "a=1&a=2&a=3" })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.result.a).toEqual(["1", "2", "3"]);
  });

  // --- Parse: nested objects via bracket notation ---
  it("parses nested objects via bracket notation", async () => {
    const res = await POST(
      makeReq({ mode: "parse", input: "user[name]=john&user[age]=30" })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.result.user).toEqual({ name: "john", age: "30" });
  });

  // --- Build: basic object to query string ---
  it("builds basic query string from object", async () => {
    const res = await POST(
      makeReq({ mode: "build", input: { foo: "bar", baz: "qux" } })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.result).toContain("foo=bar");
    expect(d.result).toContain("baz=qux");
  });

  // --- Build: array with repeat format (default) ---
  it("builds array with repeat format", async () => {
    const res = await POST(
      makeReq({
        mode: "build",
        input: { a: [1, 2, 3] },
        options: { array_format: "repeat" },
      })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.result).toBe("a=1&a=2&a=3");
  });

  // --- Build: array with bracket format ---
  it("builds array with bracket format", async () => {
    const res = await POST(
      makeReq({
        mode: "build",
        input: { a: [1, 2] },
        options: { array_format: "bracket" },
      })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.result).toContain("a[]=1");
    expect(d.result).toContain("a[]=2");
  });

  // --- Build: array with comma format ---
  it("builds array with comma format", async () => {
    const res = await POST(
      makeReq({
        mode: "build",
        input: { colors: ["red", "green", "blue"] },
        options: { array_format: "comma" },
      })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.result).toBe("colors=red,green,blue");
  });

  // --- Build: nested object ---
  it("builds nested object with bracket notation", async () => {
    const res = await POST(
      makeReq({
        mode: "build",
        input: { user: { name: "john", age: "30" } },
      })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.result).toContain("user[name]=john");
    expect(d.result).toContain("user[age]=30");
  });

  // --- Parse + Build round-trip ---
  it("round-trips parse then build", async () => {
    const original = "x=1&y=2&z=3";
    const parseRes = await POST(
      makeReq({ mode: "parse", input: original })
    );
    const parsed = await parseRes.json();

    const buildRes = await POST(
      makeReq({ mode: "build", input: parsed.result })
    );
    const built = await buildRes.json();

    // Parse the built string to compare semantically
    const reparseRes = await POST(
      makeReq({ mode: "parse", input: built.result })
    );
    const reparsed = await reparseRes.json();
    expect(reparsed.result).toEqual(parsed.result);
  });

  // --- Invalid mode ---
  it("rejects invalid mode", async () => {
    const res = await POST(makeReq({ mode: "invalid", input: "foo=bar" }));
    expect(res.status).toBe(400);
  });

  // --- Parse: input not a string ---
  it("rejects non-string input in parse mode", async () => {
    const res = await POST(makeReq({ mode: "parse", input: { foo: "bar" } }));
    expect(res.status).toBe(400);
  });

  // --- Build: input not an object ---
  it("rejects non-object input in build mode", async () => {
    const res = await POST(makeReq({ mode: "build", input: "foo=bar" }));
    expect(res.status).toBe(400);
  });

  // --- Invalid JSON body ---
  it("rejects invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/query-parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
