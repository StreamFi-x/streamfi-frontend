import { POST } from "../route";
import { NextRequest } from "next/server";

// Helper to create a mock NextRequest
function createMockRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/regex-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/regex-test", () => {
  describe("Simple matches", () => {
    it("matches simple pattern", async () => {
      const req = createMockRequest({ pattern: "hello", input: "hello world" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.matches).toHaveLength(1);
      expect(data.matches[0].match).toBe("hello");
      expect(data.matches[0].index).toBe(0);
      expect(data.total).toBe(1);
    });

    it("matches with global flag", async () => {
      const req = createMockRequest({
        pattern: "a",
        flags: "g",
        input: "banana",
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.matches).toHaveLength(3);
      expect(data.total).toBe(3);
    });

    it("no matches", async () => {
      const req = createMockRequest({ pattern: "xyz", input: "hello world" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.matches).toHaveLength(0);
      expect(data.total).toBe(0);
    });
  });

  describe("Capture groups", () => {
    it("captures groups", async () => {
      const req = createMockRequest({
        pattern: "(\\w+) (\\w+)",
        input: "hello world",
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.matches).toHaveLength(1);
      expect(data.matches[0].groups).toEqual(["hello", "world"]);
      expect(data.total).toBe(1);
    });
  });

  describe("Named groups", () => {
    it("captures named groups", async () => {
      const req = createMockRequest({
        pattern: "(?<first>\\w+) (?<last>\\w+)",
        input: "John Doe",
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.matches).toHaveLength(1);
      expect(data.matches[0].named_groups).toEqual({
        first: "John",
        last: "Doe",
      });
      expect(data.total).toBe(1);
    });
  });

  describe("Invalid pattern", () => {
    it("invalid regex pattern", async () => {
      const req = createMockRequest({ pattern: "[a-z", input: "test" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.valid).toBe(false);
      expect(data.matches).toHaveLength(0);
      expect(data.total).toBe(0);
    });
  });

  describe("Input validation", () => {
    it("rejects missing pattern", async () => {
      const req = createMockRequest({ input: "test" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("pattern and input must be strings");
    });

    it("rejects input over 100KB", async () => {
      const largeInput = "a".repeat(101 * 1024);
      const req = createMockRequest({ pattern: "a", input: largeInput });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("exceeds 100KB limit");
    });

    it("rejects invalid flags", async () => {
      const req = createMockRequest({ pattern: "a", flags: "x", input: "a" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("invalid flag");
    });
  });
});
