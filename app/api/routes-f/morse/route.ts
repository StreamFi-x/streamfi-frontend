import { NextRequest, NextResponse } from "next/server";
import { encodeMorse, decodeMorse } from "./_lib/utils";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { input, mode, dot = ".", dash = "-" } = body;

        if (!input || typeof input !== "string") {
            return NextResponse.json(
                { error: "Invalid or missing 'input'" },
                { status: 400 }
            );
        }

        if (mode !== "encode" && mode !== "decode") {
            return NextResponse.json(
                { error: "Invalid 'mode'. Use 'encode' or 'decode'" },
                { status: 400 }
            );
        }

        let output = "";
        if (mode === "encode") {
            output = encodeMorse(input, dot, dash);
        } else {
            output = decodeMorse(input, dot, dash);
        }

        return NextResponse.json({ output });
    } catch (error) {
        console.error("Morse API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
