/**
 * Routes-F items endpoints tests.
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

import { GET, PATCH, DELETE } from "../items/[id]/route";
import {
    __test__setRoutesFRecords,
    getRoutesFRecords,
} from "@/lib/routes-f/store";

const makeRequest = (method: string, body?: any, headersInit?: HeadersInit) => {
    return new Request(`http://localhost/api/routes-f/items/rf-1`, {
        method,
        headers: headersInit,
        body: body ? JSON.stringify(body) : null,
    });
};

const makeContext = (id: string) => ({
    params: { id },
});

const initialRecords = getRoutesFRecords();

describe("PATCH /api/routes-f/items/[id]", () => {
    beforeEach(() => {
        __test__setRoutesFRecords([
            {
                id: "rf-1",
                title: "Test Record",
                description: "Initial",
                tags: ["test"],
                createdAt: "2026-02-22T00:00:00.000Z",
                updatedAt: "2026-02-22T00:00:00.000Z",
                etag: '"2026-02-22T00:00:00.000Z"'
            },
        ]);
    });

    it("returns 428 when If-Match header is missing", async () => {
        const res = await PATCH(makeRequest("PATCH", { title: "New" }), makeContext("rf-1"));
        expect(res.status).toBe(428);
        const body = await res.json();
        expect(body.error).toBe("Precondition Required");
    });

    it("returns 412 when ETag mismatches", async () => {
        const res = await PATCH(
            makeRequest("PATCH", { title: "New" }, { "if-match": '"wrong-etag"' }),
            makeContext("rf-1")
        );
        expect(res.status).toBe(412);
        const body = await res.json();
        expect(body.error).toBe("Precondition Failed");
    });

    it("returns 200 and updates record when ETag matches", async () => {
        const req = makeRequest(
            "PATCH",
            { title: "Updated Title" },
            { "if-match": '"2026-02-22T00:00:00.000Z"' }
        );
        const res = await PATCH(req, makeContext("rf-1"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.title).toBe("Updated Title");

        // Check if store actually updated
        const getRes = await GET(makeRequest("GET"), makeContext("rf-1"));
        const getBody = await getRes.json();
        expect(getBody.title).toBe("Updated Title");
        expect(getBody.etag).not.toBe('"2026-02-22T00:00:00.000Z"'); // new etag
    });

    it("handles missing record with 404", async () => {
        const req = makeRequest(
            "PATCH",
            { title: "New" },
            { "if-match": '"any"' }
        );
        const res = await PATCH(req, makeContext("rf-999"));
        expect(res.status).toBe(404);
    });

    describe("DELETE /api/routes-f/items/[id]", () => {
        beforeEach(() => {
            __test__setRoutesFRecords([
                {
                    id: "rf-1",
                    title: "Test Record",
                    description: "Initial",
                    tags: ["test"],
                    createdAt: "2026-02-22T00:00:00.000Z",
                    updatedAt: "2026-02-22T00:00:00.000Z",
                },
            ]);
        });

        it("returns 204 when record is deleted", async () => {
            const res = await DELETE(makeRequest("DELETE"), makeContext("rf-1"));
            expect(res.status).toBe(204);

            // Verify it's actually removed
            const getRes = await GET(makeRequest("GET"), makeContext("rf-1"));
            expect(getRes.status).toBe(404);
        });

        it("returns 404 when record is missing", async () => {
            const res = await DELETE(makeRequest("DELETE"), makeContext("rf-999"));
            expect(res.status).toBe(404);
        });

        it("returns 400 when ID format is invalid", async () => {
            const res = await DELETE(makeRequest("DELETE"), makeContext("invalid-id"));
            expect(res.status).toBe(400);
        });

        it("is idempotent-ish (second delete returns 404)", async () => {
            // First delete
            const res1 = await DELETE(makeRequest("DELETE"), makeContext("rf-1"));
            expect(res1.status).toBe(204);

            // Second delete
            const res2 = await DELETE(makeRequest("DELETE"), makeContext("rf-1"));
            expect(res2.status).toBe(404);
        });
    });

    afterAll(() => {
        __test__setRoutesFRecords(initialRecords);
    });
});
