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

import { GET, PATCH } from "../items/[id]/route";
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

    afterAll(() => {
        __test__setRoutesFRecords(initialRecords);
    });
});
