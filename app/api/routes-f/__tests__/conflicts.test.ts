/**
 * Routes-F conflict analysis endpoint tests.
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

import { POST } from "../conflicts/route";

const makeRequest = (body: any) => {
    return new Request(`http://localhost/api/routes-f/conflicts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
};

describe("POST /api/routes-f/conflicts", () => {
    it("returns 400 for invalid payload (missing base/incoming)", async () => {
        const res = await POST(makeRequest({ base: {} }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe("Invalid request payload");
    });

    it("returns empty conflicts for identical payloads", async () => {
        const payload = { name: "test", metadata: { v: 1 } };
        const res = await POST(makeRequest({ base: payload, incoming: payload }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.conflicts).toHaveLength(0);
    });

    it("detects simple field conflicts", async () => {
        const base = { name: "base", enabled: true };
        const incoming = { name: "incoming", enabled: false };
        const res = await POST(makeRequest({ base, incoming }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.conflicts).toEqual([
            { path: "enabled", base: true, incoming: false },
            { path: "name", base: "base", incoming: "incoming" },
        ]);
    });

    it("detects nested object conflicts in metadata", async () => {
        const base = {
            name: "test",
            metadata: {
                color: "red",
                settings: { theme: "light", notifications: true }
            }
        };
        const incoming = {
            name: "test",
            metadata: {
                color: "blue",
                settings: { theme: "dark", notifications: true }
            }
        };
        const res = await POST(makeRequest({ base, incoming }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.conflicts).toEqual([
            { path: "metadata.color", base: "red", incoming: "blue" },
            { path: "metadata.settings.theme", base: "light", incoming: "dark" },
        ]);
    });

    it("handles missing/added fields as conflicts", async () => {
        const base = { name: "test" };
        const incoming = { name: "test", tags: ["new"] };
        const res = await POST(makeRequest({ base, incoming }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.conflicts).toEqual([
            { path: "tags", base: undefined, incoming: ["new"] },
        ]);
    });

    it("ensures stable and ordered field diff output", async () => {
        // z, a, m keys
        const base = { z: 1, a: 1, m: 1 };
        const incoming = { z: 2, a: 2, m: 2 };
        const res = await POST(makeRequest({ base, incoming }));
        const body = await res.json();
        // Expect a, m, z order
        expect(body.conflicts.map((c: any) => c.path)).toEqual(["a", "m", "z"]);
    });
});
