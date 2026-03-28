jest.mock("next/server", () => ({
    NextResponse: {
        json: (body: unknown, init?: ResponseInit) =>
            new Response(JSON.stringify(body), {
                ...init,
                headers: { "Content-Type": "application/json" },
            }),
    },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
    verifySession: jest.fn(),
}));

jest.mock("../_lib/db", () => ({
    ensureCollabSchema: jest.fn().mockResolvedValue(undefined),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureCollabSchema } from "../_lib/db";
import { GET, POST } from "../route";
import { PATCH, DELETE } from "../[id]/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

function makeRequest(method: string, path: string, body?: object) {
    return new Request(`http://localhost${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    }) as unknown as import("next/server").NextRequest;
}

describe("Creator Collaboration Requests API", () => {
    const SENDER_ID = "sender-uuid";
    const RECEIVER_ID = "receiver-uuid";

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("GET /api/routes-f/collab", () => {
        it("returns 401 for unauthenticated", async () => {
            verifySessionMock.mockResolvedValueOnce({ ok: false, response: new Response(null, { status: 401 }) });
            const res = await GET(makeRequest("GET", "/api/routes-f/collab"));
            expect(res.status).toBe(401);
        });

        it("lists incoming and outgoing requests", async () => {
            verifySessionMock.mockResolvedValueOnce({ ok: true, userId: SENDER_ID });
            sqlMock.mockResolvedValueOnce({ rows: [{ id: "req-1", direction: "outgoing" }] });

            const res = await GET(makeRequest("GET", "/api/routes-f/collab"));
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.requests).toHaveLength(1);
        });
    });

    describe("POST /api/routes-f/collab", () => {
        const payload = { target_username: "bob", message: "Let's collab!" };

        it("sends a request successfully", async () => {
            verifySessionMock.mockResolvedValueOnce({ ok: true, userId: SENDER_ID });

            // 1. Resolve receiver
            sqlMock.mockResolvedValueOnce({ rows: [{ id: RECEIVER_ID }] });
            // 2. Block check
            sqlMock.mockResolvedValueOnce({ rows: [] });
            // 3. Max pending check
            sqlMock.mockResolvedValueOnce({ rows: [{ count: 2 }] });
            // 4. Existing check
            sqlMock.mockResolvedValueOnce({ rows: [] });
            // 5. Insert
            sqlMock.mockResolvedValueOnce({ rows: [{ id: "new-req-id" }] });

            const res = await POST(makeRequest("POST", "/api/routes-f/collab", payload));
            expect(res.status).toBe(201);
        });

        it("returns 404 if target user not found", async () => {
            verifySessionMock.mockResolvedValueOnce({ ok: true, userId: SENDER_ID });
            sqlMock.mockResolvedValueOnce({ rows: [] });

            const res = await POST(makeRequest("POST", "/api/routes-f/collab", payload));
            expect(res.status).toBe(404);
        });

        it("returns 403 if blocked by receiver", async () => {
            verifySessionMock.mockResolvedValueOnce({ ok: true, userId: SENDER_ID });
            sqlMock.mockResolvedValueOnce({ rows: [{ id: RECEIVER_ID }] }); // resolve
            sqlMock.mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // block exists

            const res = await POST(makeRequest("POST", "/api/routes-f/collab", payload));
            expect(res.status).toBe(403);
        });

        it("returns 429 if goal of 5 pending requests reached", async () => {
            verifySessionMock.mockResolvedValueOnce({ ok: true, userId: SENDER_ID });
            sqlMock.mockResolvedValueOnce({ rows: [{ id: RECEIVER_ID }] }); // resolve
            sqlMock.mockResolvedValueOnce({ rows: [] }); // block check
            sqlMock.mockResolvedValueOnce({ rows: [{ count: 5 }] }); // count check

            const res = await POST(makeRequest("POST", "/api/routes-f/collab", payload));
            expect(res.status).toBe(429);
            expect(await res.json()).toEqual({ error: "Maximum of 5 pending requests reached" });
        });

        it("returns 400 for past proposed_date", async () => {
            verifySessionMock.mockResolvedValueOnce({ ok: true, userId: SENDER_ID });
            sqlMock.mockResolvedValueOnce({ rows: [{ id: RECEIVER_ID }] }); // resolve

            const yesterday = new Date(Date.now() - 86400000).toISOString();
            const res = await POST(makeRequest("POST", "/api/routes-f/collab", { ...payload, proposed_date: yesterday }));

            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "proposed_date must be in the future" });
        });
    });

    describe("PATCH /api/routes-f/collab/[id]", () => {
        it("accepts a request successfully", async () => {
            verifySessionMock.mockResolvedValueOnce({ ok: true, userId: RECEIVER_ID });
            sqlMock.mockResolvedValueOnce({ rows: [{ sender_id: SENDER_ID, receiver_id: RECEIVER_ID, status: "pending" }] });
            sqlMock.mockResolvedValueOnce({ rows: [{ id: "req-id", status: "accepted" }] });

            const res = await PATCH(makeRequest("PATCH", "/api/routes-f/collab/req-id", { status: "accepted" }), { params: { id: "req-id" } } as any);
            expect(res.status).toBe(200);
            expect((await res.json()).status).toBe("accepted");
        });

        it("returns 403 if sender tries to accept their own request", async () => {
            verifySessionMock.mockResolvedValueOnce({ ok: true, userId: SENDER_ID });
            sqlMock.mockResolvedValueOnce({ rows: [{ sender_id: SENDER_ID, receiver_id: RECEIVER_ID, status: "pending" }] });

            const res = await PATCH(makeRequest("PATCH", "/api/routes-f/collab/req-id", { status: "accepted" }), { params: { id: "req-id" } } as any);
            expect(res.status).toBe(403);
        });
    });

    describe("DELETE /api/routes-f/collab/[id]", () => {
        it("cancels a pending request successfully", async () => {
            verifySessionMock.mockResolvedValueOnce({ ok: true, userId: SENDER_ID });
            sqlMock.mockResolvedValueOnce({ rows: [{ sender_id: SENDER_ID, status: "pending" }] });
            sqlMock.mockResolvedValueOnce({ rows: [] });

            const res = await DELETE(makeRequest("DELETE", "/api/routes-f/collab/req-id"), { params: { id: "req-id" } } as any);
            expect(res.status).toBe(200);
        });

        it("returns 400 if trying to cancel an already accepted request", async () => {
            verifySessionMock.mockResolvedValueOnce({ ok: true, userId: SENDER_ID });
            sqlMock.mockResolvedValueOnce({ rows: [{ sender_id: SENDER_ID, status: "accepted" }] });

            const res = await DELETE(makeRequest("DELETE", "/api/routes-f/collab/req-id"), { params: { id: "req-id" } } as any);
            expect(res.status).toBe(400);
        });
    });
});
