import { NextResponse } from "next/server";

interface IdempotentResponse {
    body: string;
    status: number;
    headers: [string, string][];
    expiresAt: number;
}

const idempotencyStore = new Map<string, IdempotentResponse>();
const DEFAULT_IDEMPOTENCY_TTL_MS = 60 * 1000; // 60 seconds

const IDEMPOTENCY_HEADER = "idempotency-key";
const IDEMPOTENCY_HIT_HEADER = "x-idempotency-hit";

export async function withIdempotency(
    req: Request,
    handler: (request: Request) => Promise<Response>
): Promise<Response> {
    const key = req.headers.get(IDEMPOTENCY_HEADER);

    if (!key) {
        return handler(req);
    }

    const now = Date.now();
    const cached = idempotencyStore.get(key);

    if (cached) {
        if (now < cached.expiresAt) {
            const headers = new Headers(cached.headers);
            headers.set(IDEMPOTENCY_HIT_HEADER, "true");
            return new Response(cached.body, {
                status: cached.status,
                headers,
            });
        } else {
            idempotencyStore.delete(key);
        }
    }

    // Clone request to avoid "body already used" if the handler reads it
    // and we also need it for caching (though we mainly cache the response)
    const response = await handler(req);

    // Consider only caching successful or client-error responses?
    // Usually, we cache all except 5xx errors to be safe.
    if (response.status < 500) {
        const responseClone = response.clone();
        const body = await responseClone.text();
        const headers: [string, string][] = [];
        responseClone.headers.forEach((value, name) => {
            // Don't cache transient headers if any
            headers.push([name, value]);
        });

        idempotencyStore.set(key, {
            body,
            status: response.status,
            headers,
            expiresAt: now + DEFAULT_IDEMPOTENCY_TTL_MS,
        });
    }

    const finalHeaders = new Headers(response.headers);
    finalHeaders.set(IDEMPOTENCY_HIT_HEADER, "false");

    // We can't re-use the original response because we consumed its body with text() in the clone path
    // Wait, no, we used responseClone.text(). So response is still usable?
    // Actually, it's safer to reconstruct if we already have the body.
    // But wait, if we didn't cache (>= 500), we just return response.

    if (response.status >= 500) {
        return response;
    }

    // To ensure headers are updated with IDEMPOTENCY_HIT_HEADER
    const cachedData = idempotencyStore.get(key);
    if (cachedData) {
        const hs = new Headers(cachedData.headers);
        hs.set(IDEMPOTENCY_HIT_HEADER, "false");
        return new Response(cachedData.body, {
            status: cachedData.status,
            headers: hs,
        });
    }

    return response;
}

export function __test__clearIdempotencyStore() {
    idempotencyStore.clear();
}
