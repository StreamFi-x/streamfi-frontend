/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../template-interpolation/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/template-interpolation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/template-interpolation", () => {
  it("interpolates nested values using dot paths", async () => {
    const res = await POST(
      makeReq({
        template: "Hello {{user.name}}, your city is {{user.location.city}}.",
        values: { user: { name: "Alice", location: { city: "Seattle" } } },
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      output: "Hello Alice, your city is Seattle.",
      missing_keys: [],
    });
  });

  it("replaces missing values with empty strings when on_missing is empty", async () => {
    const res = await POST(
      makeReq({
        template: "Hi {{user.name}}, {{user.age}} years old.",
        values: { user: { name: "Bob" } },
        on_missing: "empty",
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      output: "Hi Bob,  years old.",
      missing_keys: ["user.age"],
    });
  });

  it("keeps placeholders when on_missing is keep", async () => {
    const res = await POST(
      makeReq({
        template: "Hello {{user.name}} and {{user.nickname}}.",
        values: { user: { name: "Sam" } },
        on_missing: "keep",
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      output: "Hello Sam and {{user.nickname}}.",
      missing_keys: ["user.nickname"],
    });
  });

  it("returns error when on_missing is error and values are missing", async () => {
    const res = await POST(
      makeReq({
        template: "{{a}} {{b}}",
        values: { a: "1" },
        on_missing: "error",
      })
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Missing values for template placeholders.",
      missing_keys: ["b"],
    });
  });
});
