import { POST } from "../route";
import { NextRequest } from "next/server";

describe("Text diff endpoint", () => {
    it("diffs lines", async () => {
        const req = new NextRequest("http://localhost", {
            method: "POST",
            body: JSON.stringify({ a: "a\nb", b: "a\nc", mode: "line" })
        });
        const res = await POST(req);
        const data = await res.json();
        expect(data.stats.added).toBe(1);
        expect(data.stats.removed).toBe(1);
        expect(data.stats.unchanged).toBe(1);
    });
});
