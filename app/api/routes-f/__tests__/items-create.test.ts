/**
 * Routes-F items create endpoint tests.
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

import { POST } from "../items/route";
import { __test__setRoutesFRecords, getRoutesFRecords } from "@/lib/routes-f/store";

const makeRequest = (body: any) => {
    return new Request("http://localhost/api/routes-f/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : null,
    });
};

const initialRecords = getRoutesFRecords();

describe("POST /api/routes-f/items", () => {
    beforeEach(() => {
        __test__setRoutesFRecords([]);
    });

    afterAll(() => {
        __test__setRoutesFRecords(initialRecords);
    });

    it("returns 422 when title is missing", async () => {
        const res = await POST(makeRequest({ description: "No title" }));
        expect(res.status).toBe(422);
        const data = await res.json();
        expect(data.error).toBe("Unprocessable Entity");
    });

    it("returns 422 when description is missing", async () => {
        const res = await POST(makeRequest({ title: "No desc" }));
        expect(res.status).toBe(422);
    });

    it("returns 400 when body is invalid JSON", async () => {
        const req = new Request("http://localhost/api/routes-f/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "not json",
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it("creates item and returns 201 with Location header", async () => {
        const payload = {
            title: "New Item",
            description: "A description",
            tags: ["test"],
        };

        const res = await POST(makeRequest(payload));
        expect(res.status).toBe(201);

        const location = res.headers.get("Location");
        expect(location).toMatch(/http:\/\/localhost\/api\/routes-f\/items\/rf-[a-z0-9]+/);

        const body = await res.json();
        expect(body.title).toBe(payload.title);
        expect(body.description).toBe(payload.description);
        expect(body.tags).toEqual(payload.tags);
        expect(body.id).toMatch(/^rf-/);

        // Verify it was added to the store properly
        const records = getRoutesFRecords();
        expect(records.length).toBe(1);
        expect(records[0].id).toBe(body.id);
    });
});
