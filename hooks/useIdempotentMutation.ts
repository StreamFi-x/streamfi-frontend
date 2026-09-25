"use client";

import { useCallback, useRef, useState } from "react";

const HEADER = "Idempotency-Key";
const STORAGE_PREFIX = "streamfi:idempotency:";

export interface IdempotentResult<T> {
  status: number;
  data: T;
  replayed: boolean;
}

/** Thrown when the request may not have completed; retry to reuse the key. */
export class RetryableRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "RetryableRequestError";
  }
}

function readStoredKey(operationId: string): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_PREFIX + operationId);
  } catch {
    return null;
  }
}

function storeKey(operationId: string, key: string | null): void {
  try {
    if (key) {
      window.sessionStorage.setItem(STORAGE_PREFIX + operationId, key);
    } else {
      window.sessionStorage.removeItem(STORAGE_PREFIX + operationId);
    }
  } catch {
    // Storage unavailable (private mode): the in-memory key still covers
    // retries within this page.
  }
}

/**
 * POSTs a payment-adjacent request with an `Idempotency-Key` (#1401).
 *
 * One key is generated per logical operation and reused for every retry of
 * it: network failures, 5xx, 429 and "still processing" (409) keep the key;
 * a final answer (2xx or other 4xx) discards it so the next submission is a
 * new operation. The key, and only the key, is kept in sessionStorage under
 * `operationId` so a reload mid-request still retries with the same key.
 */
export function useIdempotentMutation<TBody, TResult = unknown>(
  url: string,
  operationId: string
) {
  const keyRef = useRef<string | null>(null);
  const [pending, setPending] = useState(false);

  const currentKey = useCallback(() => {
    if (!keyRef.current) {
      keyRef.current = readStoredKey(operationId) ?? crypto.randomUUID();
      storeKey(operationId, keyRef.current);
    }
    return keyRef.current;
  }, [operationId]);

  const reset = useCallback(() => {
    keyRef.current = null;
    storeKey(operationId, null);
  }, [operationId]);

  const send = useCallback(
    async (body: TBody, key: string) => {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", [HEADER]: key },
          body: JSON.stringify(body),
        });
      } catch (error) {
        throw new RetryableRequestError(
          error instanceof Error ? error.message : "Network error"
        );
      }
      const data = await res.json().catch(() => null);
      return { res, data };
    },
    [url]
  );

  const mutate = useCallback(
    async (body: TBody): Promise<IdempotentResult<TResult>> => {
      setPending(true);
      try {
        let { res, data } = await send(body, currentKey());

        // The stored key belongs to a different request (e.g. the form
        // changed after a reload): this submission is a new operation.
        if (res.status === 422 && data?.error === "idempotency_key_reused") {
          reset();
          ({ res, data } = await send(body, currentKey()));
        }

        const inProgress =
          res.status === 409 &&
          data?.error === "idempotency_request_in_progress";
        if (res.status >= 500 || res.status === 429 || inProgress) {
          throw new RetryableRequestError(
            data?.error ?? `Request failed with status ${res.status}`,
            res.status
          );
        }

        reset();
        return {
          status: res.status,
          data: data as TResult,
          replayed: res.headers.get("Idempotency-Replayed") === "true",
        };
      } finally {
        setPending(false);
      }
    },
    [currentKey, reset, send]
  );

  return { mutate, reset, pending };
}
