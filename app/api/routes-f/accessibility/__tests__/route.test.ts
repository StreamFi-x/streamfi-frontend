jest.mock("next/server", () => ({
    NextResponse: {
        json: (body: unknown, init?: ResponseInit) => {
            const resp = new Response(JSON.stringify(body), {
                ...init,
                headers: {
                    "Content-Type": "application/json",
                    ...(init?.headers || {})
                },
            });
            // Mock headers.set behavior if needed, 
            // but standard Response headers work for simple tests
            return resp;
        },
    },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
    verifySession: jest.fn(),
}));

jest.mock("@/app/api/routes-f/_lib/schema", () => ({
    ensureRoutesFSchema: jest.fn().mockResolvedValue(undefined),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, PATCH } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

function makeRequest(method: string, path: string, body?: object) {
    return new Request(`http://localhost${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    }) as any;
}

describe("routes-f accessibility", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("returns 401 for unauthenticated requests", async () => {
        verifySessionMock.mockResolvedValue({
            ok: false,
            response: new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
            }),
        });

        const res = await GET(makeRequest("GET", "/api/routes-f/accessibility"));
        expect(res.status).toBe(401);
    });

    it("returns default settings when none exist in DB", async () => {
        verifySessionMock.mockResolvedValue({
            ok: true,
            userId: "user-123",
        });

        sqlMock.mockResolvedValueOnce({ rows: [] });

        const res = await GET(makeRequest("GET", "/api/routes-f/accessibility"));
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.captions_enabled).toBe(true);
        expect(res.headers.get("X-Accessibility-Captions")).toBe("on");
        expect(res.headers.get("X-Accessibility-Font-Size")).toBe("medium");
    });

    it("returns stored settings from DB", async () => {
        verifySessionMock.mockResolvedValue({
            ok: true,
            userId: "user-123",
        });

        sqlMock.mockResolvedValueOnce({
            rows: [
                {
                    captions_enabled: false,
                    caption_font_size: "large",
                    high_contrast: true,
                    reduce_motion: true,
                    screen_reader_hints: false,
                    autoplay: true,
                },
            ],
        });

        const res = await GET(makeRequest("GET", "/api/routes-f/accessibility"));
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.captions_enabled).toBe(false);
        expect(json.caption_font_size).toBe("large");
        expect(res.headers.get("X-Accessibility-Captions")).toBe("off");
        expect(res.headers.get("X-Accessibility-Font-Size")).toBe("large");
        expect(res.headers.get("X-Accessibility-High-Contrast")).toBe("on");
    });

    it("updates settings via PATCH", async () => {
        verifySessionMock.mockResolvedValue({
            ok: true,
            userId: "user-123",
        });

        // Mock initial fetch for merge
        sqlMock.mockResolvedValueOnce({ rows: [] });
        // Mock insert/update
        sqlMock.mockResolvedValueOnce({
            rows: [
                {
                    captions_enabled: false,
                    caption_font_size: "medium",
                    high_contrast: false,
                    reduce_motion: false,
                    screen_reader_hints: true,
                    autoplay: false,
                },
            ],
        });

        const res = await PATCH(
            makeRequest("PATCH", "/api/routes-f/accessibility", {
                captions_enabled: false,
            })
        );
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.captions_enabled).toBe(false);
        expect(res.headers.get("X-Accessibility-Captions")).toBe("off");
    });

    it("validates caption_font_size in PATCH", async () => {
        verifySessionMock.mockResolvedValue({
            ok: true,
            userId: "user-123",
        });

        const res = await PATCH(
            makeRequest("PATCH", "/api/routes-f/accessibility", {
                caption_font_size: "huge",
            })
        );

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe("Validation failed");
    });
});
