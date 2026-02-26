/**
 * Payload guard utility tests
 */
jest.mock("next/server", () => ({
    NextResponse: {
        json: (body: unknown, init?: ResponseInit) =>
            new Response(JSON.stringify(body), {
                ...init,
                headers: { "Content-Type": "application/json", ...init?.headers },
            }),
    },
}));

import { withPayloadGuard, getPayloadLimitBytes } from "@/lib/routes-f/payload-guard";

describe("payload-guard getPayloadLimitBytes", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it("returns default 50KB when no env and no options", () => {
        expect(getPayloadLimitBytes()).toBe(50 * 1024);
    });

    it("respects ROUTES_F_MAX_PAYLOAD_BYTES env var", () => {
        process.env.ROUTES_F_MAX_PAYLOAD_BYTES = "1024";
        expect(getPayloadLimitBytes()).toBe(1024);
    });

    it("falls back to default if env var is invalid", () => {
        process.env.ROUTES_F_MAX_PAYLOAD_BYTES = "abc";
        expect(getPayloadLimitBytes()).toBe(50 * 1024);

        process.env.ROUTES_F_MAX_PAYLOAD_BYTES = "-10";
        expect(getPayloadLimitBytes()).toBe(50 * 1024);
    });

    it("overrides env var when maxBytes option is provided", () => {
        process.env.ROUTES_F_MAX_PAYLOAD_BYTES = "1024";
        expect(getPayloadLimitBytes({ maxBytes: 2048 })).toBe(2048);
    });
});

describe("withPayloadGuard middleware", () => {
    const mockHandler = jest.fn().mockImplementation((req) => new Response("OK", { status: 200 }));

    beforeEach(() => {
        mockHandler.mockClear();
    });

    it("allows requests under the limit", async () => {
        const req = new Request("http://localhost/api", {
            method: "POST",
            headers: { "content-length": "100" },
            body: "test",
        });

        const res = await withPayloadGuard(req, mockHandler, { maxBytes: 200 });
        expect(res.status).toBe(200);
        expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it("rejects requests exactly equal to limit", async () => {
        // Actually, it usually allows exact limits (`> limitBytes`), so let's verify that.
        const req = new Request("http://localhost/api", {
            method: "POST",
            headers: { "content-length": "200" },
            body: "test",
        });

        const res = await withPayloadGuard(req, mockHandler, { maxBytes: 200 });
        expect(res.status).toBe(200);
        expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it("rejects requests strictly over the limit with 413", async () => {
        const req = new Request("http://localhost/api", {
            method: "POST",
            headers: { "content-length": "201" },
            body: "test test test test test",
        });

        const res = await withPayloadGuard(req, mockHandler, { maxBytes: 200 });
        expect(res.status).toBe(413);

        const data = await res.json();
        expect(data.error).toBe("Payload too large");
        expect(mockHandler).not.toHaveBeenCalled();
    });

    it("allows requests missing content-length header", async () => {
        const req = new Request("http://localhost/api", {
            method: "GET", // GET usually has no content-length
        });

        const res = await withPayloadGuard(req, mockHandler, { maxBytes: 200 });
        expect(res.status).toBe(200);
        expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it("allows requests with unparsable content-length header", async () => {
        const req = new Request("http://localhost/api", {
            method: "POST",
            headers: { "content-length": "chunked" },
            body: "test",
        });

        const res = await withPayloadGuard(req, mockHandler, { maxBytes: 200 });
        expect(res.status).toBe(200);
        expect(mockHandler).toHaveBeenCalledTimes(1);
    });
});
