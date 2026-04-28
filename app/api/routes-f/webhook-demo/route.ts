import { NextResponse } from "next/server";
import crypto from "crypto";

const SECRET = "dev-secret-key-123";
const buffer: any[] = [];

export async function GET() {
    return NextResponse.json({ payloads: buffer.slice(-100) });
}

export async function POST(req: Request) {
    const signature = req.headers.get("X-Signature");
    if (!signature || !signature.startsWith("sha256=")) {
        return NextResponse.json({ error: "Missing or invalid signature header" }, { status: 401 });
    }

    const rawBody = await req.text();
    const expectedSig = crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");
    const providedSig = signature.slice(7);

    try {
        const expectedBuffer = Buffer.from(expectedSig);
        const providedBuffer = Buffer.from(providedSig);

        if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
            return NextResponse.json({ error: "Signature mismatch" }, { status: 401 });
        }
    } catch(e) {
        return NextResponse.json({ error: "Signature mismatch" }, { status: 401 });
    }

    let parsed = {};
    try {
        parsed = JSON.parse(rawBody);
    } catch(e) {
        parsed = { rawBody };
    }

    buffer.push(parsed);
    if (buffer.length > 100) {
        buffer.shift();
    }

    return NextResponse.json({ success: true });
}
