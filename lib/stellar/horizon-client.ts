import { Horizon } from "@stellar/stellar-sdk";
import { getHorizonBreaker } from "@/lib/resilience/breakers";
import type { ExecuteOptions } from "@/lib/resilience/circuit-breaker";
import { getHorizonUrl, getStellarNetwork } from "./config";

/**
 * Server-side access to Horizon (#1418). Every call goes through the Horizon
 * circuit breaker and has a bounded timeout: the SDK's HTTP client gets the
 * breaker's timeout so a hung request is actually aborted, and the breaker's
 * own timer backs that up.
 *
 * Not for browser bundles (the breaker's shared state is in Redis).
 * Transaction submission is deliberately not routed through here: a timed-out
 * submit may still have been applied, so it must not be retried or counted
 * like a read.
 */

const servers = new Map<string, Horizon.Server>();

export function getHorizonServer(): Horizon.Server {
  const url = getHorizonUrl(getStellarNetwork());
  let server = servers.get(url);
  if (!server) {
    server = new Horizon.Server(url);
    server.httpClient.defaults.timeout = getHorizonBreaker().config.timeoutMs;
    servers.set(url, server);
  }
  return server;
}

export function callHorizon<T>(
  fn: (server: Horizon.Server, signal: AbortSignal) => Promise<T>,
  options?: ExecuteOptions
): Promise<T> {
  return getHorizonBreaker().execute(
    signal => fn(getHorizonServer(), signal),
    options
  );
}

/** Horizon's base URL. */
export function horizonBaseUrl(): string {
  return getHorizonUrl(getStellarNetwork());
}

export class HorizonHttpError extends Error {
  readonly response: { status: number };
  constructor(status: number, url: string) {
    super(`Horizon returned ${status} for ${url}`);
    this.name = "HorizonHttpError";
    this.response = { status };
  }
}

/**
 * GETs a Horizon URL (absolute, or a path under the base URL) through the
 * breaker. A non-2xx response is thrown as HorizonHttpError, so a 5xx counts
 * against Horizon's health while a 404 does not. HAL link templates such as
 * `{?cursor,limit,order}` are stripped.
 */
export function fetchHorizonJson<T>(urlOrPath: string): Promise<T> {
  const url = (
    urlOrPath.startsWith("http") ? urlOrPath : `${horizonBaseUrl()}${urlOrPath}`
  ).replace(/\{[^}]*\}$/, "");
  return getHorizonBreaker().execute(async signal => {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new HorizonHttpError(response.status, url);
    }
    return (await response.json()) as T;
  });
}

export function resetHorizonServersForTests(): void {
  servers.clear();
}
