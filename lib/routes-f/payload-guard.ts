import { NextResponse } from "next/server";

const DEFAULT_MAX_PAYLOAD_BYTES = 50 * 1024; // 50KB default

export interface PayloadGuardOptions {
    maxBytes?: number;
}

export function getPayloadLimitBytes(options?: PayloadGuardOptions): number {
    if (options?.maxBytes !== undefined) {
        return options.maxBytes;
    }

    const envValue = process.env.ROUTES_F_MAX_PAYLOAD_BYTES;
    if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (!isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }

    return DEFAULT_MAX_PAYLOAD_BYTES;
}

export async function withPayloadGuard(
    req: Request,
    handler: (request: Request) => Promise<Response>,
    options?: PayloadGuardOptions
): Promise<Response> {
    const limitBytes = getPayloadLimitBytes(options);
    const contentLengthAttr = req.headers.get("content-length");

    if (contentLengthAttr) {
        const contentLength = parseInt(contentLengthAttr, 10);

        // If we can parse it and it explicitly exceeds
        if (!isNaN(contentLength) && contentLength > limitBytes) {
            return NextResponse.json(
                {
                    error: "Payload too large",
                    details: `Request body must not exceed ${limitBytes} bytes`
                },
                { status: 413 }
            );
        }
    }

    // If content-length is missing, we could technically still get a large payload.
    // We'd have to read a stream and fail if it goes over, but returning 413 statically 
    // via content-length is the requirement. Real body limits are often handled by Next.js configs.
    // Next.js body parser has its own limits, but this enforces our strict custom guard.

    return handler(req);
}
