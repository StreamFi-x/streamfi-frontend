/**
 * Routes-F validation metadata endpoint tests.
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

import { GET } from "../validation-rules/route";

describe("GET /api/routes-f/validation-rules", () => {
    it("returns 200 and correct schema shape", async () => {
        const res = await GET();
        expect(res.status).toBe(200);

        const body = await res.json();

        // Check core fields
        expect(body).toHaveProperty("name");
        expect(body).toHaveProperty("path");
        expect(body).toHaveProperty("method");
        expect(body).toHaveProperty("priority");
        expect(body).toHaveProperty("enabled");
        expect(body).toHaveProperty("tags");
        expect(body).toHaveProperty("metadata");

        // Verify specific constraints
        expect(body.name.constraints.maxLength).toBe(100);
        expect(body.path.constraints.pattern).toBe("^/");
        expect(body.method.type).toBe("enum");
        expect(body.method.constraints.enum).toContain("POST");
        expect(body.tags.constraints.maxItems).toBe(8);
    });

    it("returns stable response for all fields", async () => {
        const res = await GET();
        const body = await res.json();

        // Ensure type and required flags are present for all fields
        const fields = ["name", "path", "method", "priority", "enabled", "tags", "metadata"];
        fields.forEach(field => {
            expect(body[field]).toHaveProperty("type");
            expect(body[field]).toHaveProperty("required");
            expect(body[field]).toHaveProperty("constraints");
        });
    });
});
