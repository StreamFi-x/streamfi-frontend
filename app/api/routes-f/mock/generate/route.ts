import { NextResponse } from "next/server";
import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { withPayloadGuard } from "@/lib/routes-f/payload-guard";
import { generateMockData } from "@/lib/routes-f/mock-generator";
import { jsonResponse } from "@/lib/routes-f/version";

const MAX_COUNT = 500;
const MIN_COUNT = 1;
const DEFAULT_COUNT = 10;
const MAX_PAYLOAD_BYTES = 50 * 1024; // 50KB

export async function POST(req: Request) {
    return withPayloadGuard(
        req,
        async (requestWithGuard) => {
            return withRoutesFLogging(requestWithGuard, async reqWithId => {
                let body: any = {};

                try {
                    // Read body if present. It might be empty, which is fine since defaults exist.
                    const text = await reqWithId.text();
                    if (text) {
                        body = JSON.parse(text);
                    }
                } catch {
                    return jsonResponse(
                        { error: "Invalid JSON payload" },
                        { status: 400 }
                    );
                }

                let seed = body.seed;
                if (seed === undefined || seed === null) {
                    // Generate a random seed if none provided. 
                    // The generated data will still be deterministic for *this* generated seed.
                    seed = Math.random().toString(36).substring(2, 10);
                }

                let count = body.count !== undefined ? Number(body.count) : DEFAULT_COUNT;

                if (isNaN(count) || !Number.isInteger(count)) {
                    return jsonResponse(
                        { error: "count must be an integer" },
                        { status: 400 }
                    );
                }

                if (count < MIN_COUNT || count > MAX_COUNT) {
                    return jsonResponse(
                        { error: `count must be between ${MIN_COUNT} and ${MAX_COUNT}` },
                        { status: 400 }
                    );
                }

                const profileType = body.profileType !== undefined ? String(body.profileType) : "default";

                const data = generateMockData(seed, count, profileType);

                return jsonResponse({
                    metadata: {
                        seed,
                        count,
                        profileType,
                        generatedAt: new Date().toISOString(),
                    },
                    data
                }, { status: 200 });
            });
        },
        { maxBytes: MAX_PAYLOAD_BYTES } // Apply guard directly on this route
    );
}
