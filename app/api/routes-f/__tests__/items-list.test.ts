/**
 * Routes-F items list endpoint tests.
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

import { GET } from "../items/route";
import { __test__setRoutesFRecords, getRoutesFRecords } from "@/lib/routes-f/store";

const makeRequest = (query = "") => {
    return new Request(`http://localhost/api/routes-f/items${query}`);
};

const initialRecords = getRoutesFRecords();

describe("GET /api/routes-f/items", () => {
    beforeEach(() => {
        // Stable data set
        __test__setRoutesFRecords([
            { id: "3", title: "Third", description: "", tags: [], status: "active", createdAt: "2026-02-03T00:00:00.000Z" },
            { id: "1", title: "First", description: "", tags: [], status: "active", createdAt: "2026-02-01T00:00:00.000Z" },
            { id: "4", title: "Fourth", description: "", tags: [], status: "inactive", createdAt: "2026-02-04T00:00:00.000Z" },
            { id: "2", title: "Second", description: "", tags: [], status: "active", createdAt: "2026-02-02T00:00:00.000Z" },
        ]);
    });

    afterAll(() => {
        __test__setRoutesFRecords(initialRecords);
    });

    it("returns paginated list sorted by createdAt descending", async () => {
        // Getting limit 2
        const res = await GET(makeRequest("?limit=2"));
        expect(res.status).toBe(200);
        const body = await res.json();

        // Sort order should be: 3, 2, 1 (since 4 is inactive and default status is active)
        expect(body.items).toHaveLength(2);
        expect(body.items[0].id).toBe("3");
        expect(body.items[1].id).toBe("2");
        expect(body.nextCursor).toBe("2");
        expect(body.total).toBe(3); // total active
    });

    it("handles cursor pagination correctly", async () => {
        // Start after cursor=2
        const res = await GET(makeRequest("?limit=2&cursor=2"));
        const body = await res.json();

        expect(body.items).toHaveLength(1);
        expect(body.items[0].id).toBe("1");
        expect(body.nextCursor).toBeNull();
    });

    it("supports status filtering", async () => {
        const res = await GET(makeRequest("?status=inactive"));
        const body = await res.json();

        expect(body.items).toHaveLength(1);
        expect(body.items[0].id).toBe("4");
        expect(body.total).toBe(1);
        expect(body.nextCursor).toBeNull();
    });

    it("uses default limit handling bounds smoothly", async () => {
        const res = await GET(makeRequest("?limit=-5"));
        const body = await res.json();

        expect(body.items).toHaveLength(3); // fetches default limit of 20, capping the 3 available
    });
});
