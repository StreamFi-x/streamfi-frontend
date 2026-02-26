/**
 * Deterministic Mock Generator Tests
 */
import { generateMockData, DeterministicGenerator } from "@/lib/routes-f/mock-generator";
import { POST } from "../mock/generate/route";

// Mock Next.js Response
jest.mock("next/server", () => ({
    NextResponse: {
        json: (body: unknown, init?: ResponseInit) =>
            new Response(JSON.stringify(body), {
                ...init,
                headers: { "Content-Type": "application/json", ...init?.headers },
            }),
    },
}));

// Mock the logging wrapper as a pass-through
jest.mock("@/lib/routes-f/logging", () => ({
    withRoutesFLogging: jest.fn((req, handler) => handler(req)),
}));

function makePostRequest(body?: any): Request {
    return new Request("http://localhost/api/routes-f/mock/generate", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": body ? JSON.stringify(body).length.toString() : "0" },
        body: body ? JSON.stringify(body) : undefined,
    });
}

describe("DeterministicGenerator Utility", () => {
    it("generates the same sequence of numbers for the same string seed", () => {
        const g1 = new DeterministicGenerator("test-seed-123");
        const g2 = new DeterministicGenerator("test-seed-123");

        for (let i = 0; i < 100; i++) {
            expect(g1.random()).toBe(g2.random());
        }
    });

    it("generates different sequences for different seeds", () => {
        const g1 = new DeterministicGenerator("test-seed-123");
        const g2 = new DeterministicGenerator("test-seed-456");

        // They shouldn't match on the first draw
        expect(g1.random()).not.toBe(g2.random());
    });

    it("generates identical mock data arrays for the same seed", () => {
        const data1 = generateMockData("my-seed", 50, "financial");
        const data2 = generateMockData("my-seed", 50, "financial");

        expect(data1).toEqual(data2);
    });

    it("generates different arrays for different profiles even with same seed", () => {
        const data1 = generateMockData("my-seed", 50, "financial");
        const data2 = generateMockData("my-seed", 50, "social");

        expect(data1).not.toEqual(data2);
    });
});

describe("POST /api/routes-f/mock/generate", () => {
    it("returns 400 if count exceeds maximum", async () => {
        const res = await POST(makePostRequest({ count: 1000 }));
        expect(res.status).toBe(400);

        const data = await res.json();
        expect(data.error).toMatch(/count must be between/);
    });

    it("returns 400 if count is negative", async () => {
        const res = await POST(makePostRequest({ count: -5 }));
        expect(res.status).toBe(400);
    });

    it("returns 400 if count is not an integer", async () => {
        const res = await POST(makePostRequest({ count: 5.5 }));
        expect(res.status).toBe(400);
    });

    it("returns default 10 records if no body is provided", async () => {
        const res = await POST(new Request("http://localhost/api", { method: "POST" }));
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.metadata.count).toBe(10);
        expect(data.metadata.seed).toBeDefined();
        expect(data.data.length).toBe(10);
    });

    it("returns deterministic payloads when seeded", async () => {
        const seed = "fixed-seed-789";
        const count = 5;

        const res1 = await POST(makePostRequest({ seed, count }));
        const res2 = await POST(makePostRequest({ seed, count }));

        const data1 = await res1.json();
        const data2 = await res2.json();

        expect(data1.metadata.seed).toBe(seed);
        expect(data2.metadata.seed).toBe(seed);

        // We stringify and compare to ignore the generatedAt timestamp in metadata
        // Data arrays should be strictly identical
        expect(data1.data).toEqual(data2.data);
    });
});
