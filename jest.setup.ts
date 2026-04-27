import "@testing-library/jest-dom";

// Polyfill TextEncoder / TextDecoder — required by @stellar/stellar-sdk and
// other crypto libs when running in Jest's jsdom environment.
import { TextEncoder, TextDecoder } from "util";
Object.assign(global, { TextEncoder, TextDecoder });

// jsdom 26 does not include the Fetch API (Request/Response/Headers/fetch).
// node-fetch v2 is used as a polyfill; it avoids the this.url= conflict that
// whatwg-fetch has with NextRequest's read-only url getter.
if (typeof global.Request === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { fetch: nodeFetch, Request, Response, Headers, FormData } = require("node-fetch");

  // node-fetch v2 lacks Response.json() static method (added in the Web API later).
  // NextResponse.json() delegates to Response.json(), so we need to add it.
  if (!("json" in Response)) {
    (Response as { json?: unknown }).json = function (
      data: unknown,
      init?: ResponseInit
    ): Response {
      const body = JSON.stringify(data);
      const headers = new Headers(init?.headers);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
      return new Response(body, { ...init, headers });
    };
  }

  Object.assign(global, { fetch: nodeFetch, Request, Response, Headers, FormData });
}
