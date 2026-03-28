jest.mock("next/server", () => ({
    NextResponse: {
        json: (body: unknown, init?: ResponseInit) =>
            new Response(JSON.stringify(body), {
                ...init,
                headers: {
                    "Content-Type": "application/json",
                    ...(init?.headers || {}),
                },
            }),
    },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
    verifySession: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

function makeRequest(path: string) {
    return new Request(`http://localhost${path}`) as unknown as import("next/server").NextRequest;
}

describe("Creator Dashboard Summary API", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("returns 401 for unauthenticated requests", async () => {
        verifySessionMock.mockResolvedValueOnce({
            ok: false,
            response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
        });

        const res = await GET(makeRequest("/api/routes-f/creator/dashboard"));
        expect(res.status).toBe(401);
    });

    it("returns aggregated dashboard metrics in parallel", async () => {
        verifySessionMock.mockResolvedValueOnce({ ok: true, userId: "creator-123" });

        // Mock the 5 parallel queries
        sqlMock
            .mockResolvedValueOnce({ rows: [{ count: 150 }] }) // followers
            .mockResolvedValueOnce({ rows: [{ total: "1250.50" }] }) // earnings
            .mockResolvedValueOnce({ rows: [{ count: 12 }] }) // streams this month
            .mockResolvedValueOnce({ rows: [{ avg: 45.678 }] }) // avg viewers
            .mockResolvedValueOnce({ rows: [{ count: 25 }] }); // subscribers

        const res = await GET(makeRequest("/api/routes-f/creator/dashboard"));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual({
            follower_count: 150,
            total_earnings: "1250.50",
            streams_this_month: 12,
            avg_viewer_count: 45.68,
            subscriber_count: 25,
            pending_payouts: "0.00",
            generated_at: expect.any(String),
        });

        expect(sqlMock).toHaveBeenCalledTimes(5);
        expect(res.headers.get("Cache-Control")).toContain("public");
        expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
    });

    it("handles missing data by returning defaults", async () => {
        verifySessionMock.mockResolvedValueOnce({ ok: true, userId: "creator-456" });

        sqlMock.mockResolvedValue({ rows: [] });

        const res = await GET(makeRequest("/api/routes-f/creator/dashboard"));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.follower_count).toBe(0);
        expect(data.total_earnings).toBe("0.00");
        expect(data.avg_viewer_count).toBe(0);
    });

    it("returns 500 on database error", async () => {
        verifySessionMock.mockResolvedValueOnce({ ok: true, userId: "creator-789" });
        sqlMock.mockRejectedValueOnce(new Error("DB Down"));

        const res = await GET(makeRequest("/api/routes-f/creator/dashboard"));
        expect(res.status).toBe(500);
    });
});
