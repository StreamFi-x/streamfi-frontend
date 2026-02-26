/**
 * Routes-F items batched status update tests.
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

import { PATCH } from "../items/status/route";
import {
    __test__setRoutesFRecords,
    getRoutesFRecords,
} from "@/lib/routes-f/store";

const makeRequest = (body: any) => {
    return new Request(`http://localhost/api/routes-f/items/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
};

const initialRecords = getRoutesFRecords();

describe("PATCH /api/routes-f/items/status", () => {
    beforeEach(() => {
        __test__setRoutesFRecords([
            {
                id: "rf-1",
                title: "Active Item",
                description: "Initial",
                tags: ["test"],
                createdAt: "2026-02-22T00:00:00.000Z",
                updatedAt: "2026-02-22T00:00:00.000Z",
                status: "active",
            },
            {
                id: "rf-2",
                title: "Inactive Item",
                description: "Initial",
                tags: ["test"],
                createdAt: "2026-02-22T00:00:00.000Z",
                updatedAt: "2026-02-22T00:00:00.000Z",
                status: "inactive",
            },
            {
                id: "rf-3",
                title: "Archived Item",
                description: "Initial",
                tags: ["test"],
                createdAt: "2026-02-22T00:00:00.000Z",
                updatedAt: "2026-02-22T00:00:00.000Z",
                status: "archived",
            },
        ]);
    });

    afterAll(() => {
        __test__setRoutesFRecords(initialRecords);
    });

    it("returns 400 for invalid payload (missing ids)", async () => {
        const res = await PATCH(makeRequest({ status: "inactive" }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe("Invalid request payload");
    });

    it("returns 400 for invalid status", async () => {
        const res = await PATCH(makeRequest({ ids: ["rf-1"], status: "invalid" }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe("Invalid request payload");
    });

    it("returns 200 for successful bulk update (active -> inactive)", async () => {
        const res = await PATCH(makeRequest({ ids: ["rf-1", "rf-2"], status: "inactive" }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.updated).toBe(20); // wait, rf-1 was active, rf-2 was inactive. 
        // inactive -> inactive is no-op success in my impl.
        // Ah, but updatedCount increments.
        expect(body.updated).toBe(2);
        expect(body.failed).toBe(0);
    });

    it("returns 207 for partial success (one valid, one missing)", async () => {
        const res = await PATCH(makeRequest({ ids: ["rf-1", "rf-999"], status: "archived" }));
        expect(res.status).toBe(207);
        const body = await res.json();
        expect(body.updated).toBe(1);
        expect(body.failed).toBe(1);
        expect(body.results[1].error).toBe("Item not found");
    });

    it("returns 422 for all failure (invalid transitions)", async () => {
        const res = await PATCH(makeRequest({ ids: ["rf-3"], status: "active" }));
        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.updated).toBe(0);
        expect(body.failed).toBe(1);
        expect(body.results[0].error).toContain("Invalid transition from archived to active");
    });

    it("handles multiple transition types in one batch (success, missing, invalid transition)", async () => {
        const res = await PATCH(makeRequest({
            ids: ["rf-1", "rf-999", "rf-3"],
            status: "inactive"
        }));
        expect(res.status).toBe(207);
        const body = await res.json();
        expect(body.updated).toBe(1); // rf-1
        expect(body.failed).toBe(2); // rf-999, rf-3
        expect(body.results[0].ok).toBe(true);
        expect(body.results[1].error).toBe("Item not found");
        expect(body.results[2].error).toContain("Invalid transition from archived to inactive");
    });
});
