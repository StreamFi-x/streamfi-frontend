import { POST, GET } from "../route";
import { NextRequest } from "next/server";
import crypto from "crypto";

describe("Webhook endpoint", () => {
    it("valid signature", async () => {
        const body = JSON.stringify({ test: 1 });
        const sig = crypto.createHmac("sha256", "dev-secret-key-123").update(body).digest("hex");
        const req = new NextRequest("http://localhost", {
            method: "POST",
            body,
            headers: { "X-Signature": "sha256=" + sig }
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
    });

    it("invalid signature", async () => {
        const body = JSON.stringify({ test: 1 });
        const req = new NextRequest("http://localhost", {
            method: "POST",
            body,
            headers: { "X-Signature": "sha256=invalid" }
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });
    
    it("missing signature", async () => {
        const body = JSON.stringify({ test: 1 });
        const req = new NextRequest("http://localhost", {
            method: "POST",
            body
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });
});
