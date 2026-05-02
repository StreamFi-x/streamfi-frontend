import { POST } from "../route";
import { NextRequest } from "next/server";

function makeReq(body: object) {
  return new Request("http://localhost/api/routes-f/fizzbuzz", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }) as unknown as NextRequest;
}

describe("POST /api/routes-f/fizzbuzz", () => {
  it("returns classic FizzBuzz output with default rules", async () => {
    const res = await POST(makeReq({ start: 1, end: 15 }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.output).toEqual([
      "1",
      "2",
      "Fizz",
      "4",
      "Buzz",
      "Fizz",
      "7",
      "8",
      "Fizz",
      "Buzz",
      "11",
      "Fizz",
      "13",
      "14",
      "FizzBuzz",
    ]);
  });

  it("applies custom rules and concatenates multiple matches", async () => {
    const res = await POST(
      makeReq({
        start: 1,
        end: 6,
        rules: [
          { divisor: 2, replacement: "Foo" },
          { divisor: 3, replacement: "Bar" },
        ],
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.output).toEqual(["1", "Foo", "Bar", "Foo", "5", "FooBar"]);
  });

  it("returns 400 when start is greater than end", async () => {
    const res = await POST(makeReq({ start: 5, end: 1 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/start must be less than or equal to end/i);
  });

  it("returns 400 when range size exceeds 10000", async () => {
    const res = await POST(makeReq({ start: 1, end: 10002 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/range size must not exceed 10000/i);
  });

  it("returns 400 when a divisor is less than 1", async () => {
    const res = await POST(
      makeReq({
        start: 1,
        end: 3,
        rules: [{ divisor: 0, replacement: "Zero" }],
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/divisor must be greater than or equal to 1/i);
  });
});
