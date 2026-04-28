import { POST } from "../route";
import { NextRequest } from "next/server";

describe("Similarity endpoint", () => {
    it("computes all algorithms", async () => {
        const req = new NextRequest("http://localhost", {
            method: "POST",
            body: JSON.stringify({ a: "martha", b: "marhta" })
        });
        const res = await POST(req);
        const data = await res.json();
        expect(data.results.levenshtein.score).toBeGreaterThan(0);
        expect(data.results.jaro.score).toBeGreaterThan(0);
        expect(data.results.jaro_winkler.score).toBeGreaterThan(0);
        expect(data.results.dice.score).toBeGreaterThan(0);
    });
});
