import { POST } from "../route";
import { NextRequest } from "next/server";

describe("Profanity endpoint", () => {
    it("handles leetspeak and repeated chars", async () => {
        const req = new NextRequest("http://localhost", {
            method: "POST",
            body: JSON.stringify({ text: "This is shhiii11tt and b@d" })
        });
        const res = await POST(req);
        const data = await res.json();
        expect(data.has_profanity).toBe(true);
        expect(data.cleaned).toContain("***");
    });
});
