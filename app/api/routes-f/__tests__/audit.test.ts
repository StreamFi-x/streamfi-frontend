/**
 * Routes-F audit endpoint tests.
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

import { GET } from "../audit/route";
import { __test__setAuditEvents } from "@/lib/routes-f/store";
import { __test__resetRateLimit } from "@/lib/routes-f/rate-limit";
import { AuditEvent } from "@/lib/routes-f/types";

const mockEvents: AuditEvent[] = [
    { id: "e3", actor: "u1", action: "A", target: "T", timestamp: "2026-02-24T12:00:00Z" },
    { id: "e2", actor: "u2", action: "B", target: "T", timestamp: "2026-02-24T11:00:00Z" },
    { id: "e1", actor: "u1", action: "C", target: "T", timestamp: "2026-02-24T10:00:00Z" },
];

const makeRequest = (search = "") =>
    new Request(`http://localhost/api/routes-f/audit${search}`);

describe("GET /api/routes-f/audit", () => {
    beforeEach(() => {
        __test__setAuditEvents(mockEvents);
        __test__resetRateLimit();
    });

    it("returns latest events first", async () => {
        const res = await GET(makeRequest("?limit=2"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(2);
        expect(body.items[0].id).toBe("e3");
        expect(body.items[1].id).toBe("e2");
        expect(body.nextCursor).toBe("e2");
    });

    it("uses cursor for pagination", async () => {
        const res = await GET(makeRequest("?limit=1&cursor=e3"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(1);
        expect(body.items[0].id).toBe("e2");
        expect(body.nextCursor).toBe("e2");
    });

    it("returns null nextCursor on last page", async () => {
        const res = await GET(makeRequest("?limit=5&cursor=e2"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(1);
        expect(body.items[0].id).toBe("e1");
        expect(body.nextCursor).toBeNull();
    });

    it("handles null cursor correctly (initial page)", async () => {
        const res = await GET(makeRequest("?limit=1"));
        const body = await res.json();
        expect(body.items[0].id).toBe("e3");
    });

    it("limits results to max 100", async () => {
        const res = await GET(makeRequest("?limit=200"));
        const body = await res.json();
        // In this test we only have 3, so it will return all 3
        expect(body.items).toHaveLength(3);
    });
});
