/**
 * Routes-F idempotency tests.
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

import { POST as itemsPost } from "../items/route";
import { __test__clearIdempotencyStore } from "@/lib/routes-f/idempotency";
import { __test__setRoutesFRecords } from "@/lib/routes-f/store";

const makePostRequest = (body: any, headersInit?: HeadersInit) => {
    return new Request(`http://localhost/api/routes-f/items`, {
        method: "POST",
        headers: headersInit,
        body: JSON.stringify(body),
    });
};

describe("POST /api/routes-f/items (Idempotency)", () => {
    beforeEach(() => {
        __test__clearIdempotencyStore();
        __test__setRoutesFRecords([]);
    });

    it("executes handler normally without Idempotency-Key", async () => {
        const body = { title: "Test", description: "Desc" };
        const res = await itemsPost(makePostRequest(body));
        expect(res.status).toBe(201);
        expect(res.headers.get("x-idempotency-hit")).toBeNull();

        const res2 = await itemsPost(makePostRequest(body));
        expect(res2.status).toBe(201);
        expect(res2.headers.get("x-idempotency-hit")).toBeNull();
    });

    it("returns cached response for duplicate requests with same key", async () => {
        const body = { title: "Test", description: "Desc" };
        const key = "test-key-123";
        const headers = { "idempotency-key": key };

        const res1 = await itemsPost(makePostRequest(body, headers));
        expect(res1.status).toBe(201);
        expect(res1.headers.get("x-idempotency-hit")).toBe("false");
        const data1 = await res1.json();

        // Second request
        const res2 = await itemsPost(makePostRequest(body, headers));
        expect(res2.status).toBe(201);
        expect(res2.headers.get("x-idempotency-hit")).toBe("true");
        const data2 = await res2.json();

        expect(data1).toEqual(data2);
    });

    it("allows different keys to have different results", async () => {
        const body = { title: "Test", description: "Desc" };

        const res1 = await itemsPost(makePostRequest(body, { "idempotency-key": "key-1" }));
        expect(res1.headers.get("x-idempotency-hit")).toBe("false");

        const res2 = await itemsPost(makePostRequest(body, { "idempotency-key": "key-2" }));
        expect(res2.headers.get("x-idempotency-hit")).toBe("false");
    });

    it("handles key expiration", async () => {
        jest.useFakeTimers();
        const body = { title: "Test", description: "Desc" };
        const key = "expiring-key";
        const headers = { "idempotency-key": key };

        const res1 = await itemsPost(makePostRequest(body, headers));
        expect(res1.headers.get("x-idempotency-hit")).toBe("false");

        // Advance time by 61 seconds
        jest.advanceTimersByTime(61 * 1000);

        const res2 = await itemsPost(makePostRequest(body, headers));
        expect(res2.headers.get("x-idempotency-hit")).toBe("false");

        jest.useRealTimers();
    });
});
