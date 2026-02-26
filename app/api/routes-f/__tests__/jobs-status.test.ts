/**
 * Routes-F job status endpoint tests.
 */
jest.mock("next/server", () => ({
    NextResponse: {
        json: (body: unknown, init?: ResponseInit) =>
            new Response(JSON.stringify(body), {
                ...init,
                headers: { "Content-Type": "application/json" },
            }),
    },
}));

import { GET } from "../jobs/[id]/route";
import { __test__setRoutesFJobs } from "@/lib/routes-f/store";

const makeRequest = () => {
    return new Request("http://localhost/api/routes-f/jobs/1");
};

const makeContext = (id: string) => ({
    params: { id },
});

describe("GET /api/routes-f/jobs/[id]", () => {
    beforeEach(() => {
        // Setup stable test jobs
        __test__setRoutesFJobs([
            { id: "test-queued", status: "queued", createdAt: "2026-02-24T00:00:00Z", updatedAt: "2026-02-24T00:00:00Z" },
            { id: "test-running", status: "running", createdAt: "2026-02-24T00:00:00Z", updatedAt: "2026-02-24T00:01:00Z" },
            { id: "test-complete", status: "complete", result: "data", createdAt: "2026-02-24T00:00:00Z", updatedAt: "2026-02-24T00:02:00Z" },
            { id: "test-failed", status: "failed", error: "OOM", createdAt: "2026-02-24T00:00:00Z", updatedAt: "2026-02-24T00:03:00Z" },
        ]);
    });

    afterAll(() => {
        __test__setRoutesFJobs([]);
    });

    it("returns 404 when job does not exist", async () => {
        const res = await GET(makeRequest(), makeContext("missing-id"));
        expect(res.status).toBe(404);
    });

    it("returns queued job status", async () => {
        const res = await GET(makeRequest(), makeContext("test-queued"));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.status).toBe("queued");
    });

    it("returns running job status", async () => {
        const res = await GET(makeRequest(), makeContext("test-running"));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.status).toBe("running");
    });

    it("returns complete job status with result", async () => {
        const res = await GET(makeRequest(), makeContext("test-complete"));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.status).toBe("complete");
        expect(data.result).toBe("data");
    });

    it("returns failed job status with error data", async () => {
        const res = await GET(makeRequest(), makeContext("test-failed"));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.status).toBe("failed");
        expect(data.error).toBe("OOM");
    });
});
