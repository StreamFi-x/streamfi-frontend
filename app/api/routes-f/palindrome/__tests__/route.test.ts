import { POST } from "../route";
import { NextRequest } from "next/server";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/routes-f/palindrome", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/palindrome", () => {
  it("detects classic palindrome with defaults", async () => {
    const res = await POST(makeReq({ text: "A man, a plan, a canal: Panama" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_palindrome).toBe(true);
    expect(body.normalized).toBe("amanaplanacanalpanama");
  });

  it("detects simple palindrome", async () => {
    const res = await POST(makeReq({ text: "racecar" }));
    const body = await res.json();
    expect(body.is_palindrome).toBe(true);
  });

  it("detects non-palindrome", async () => {
    const res = await POST(makeReq({ text: "hello world" }));
    const body = await res.json();
    expect(body.is_palindrome).toBe(false);
  });

  it("respects ignore_case=false", async () => {
    const res = await POST(makeReq({ text: "Racecar", ignore_case: false }));
    const body = await res.json();
    expect(body.is_palindrome).toBe(false);
  });

  it("respects ignore_whitespace=false", async () => {
    const res = await POST(makeReq({ text: "race car", ignore_whitespace: false }));
    const body = await res.json();
    expect(body.is_palindrome).toBe(false);
  });

  it("returns 400 for missing text", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for text exceeding 10000 chars", async () => {
    const res = await POST(makeReq({ text: "a".repeat(10001) }));
    expect(res.status).toBe(400);
  });

  it("handles empty string", async () => {
    const res = await POST(makeReq({ text: "" }));
    const body = await res.json();
    expect(body.is_palindrome).toBe(true);
    expect(body.normalized).toBe("");
  });

  it("detects 'Was it a car or a cat I saw'", async () => {
    const res = await POST(makeReq({ text: "Was it a car or a cat I saw" }));
    const body = await res.json();
    expect(body.is_palindrome).toBe(true);
  });
});
