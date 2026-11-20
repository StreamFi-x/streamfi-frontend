import assert from "node:assert/strict";
import { test } from "node:test";
import { measureStream } from "./load-stream.mjs";

test("posts chat and viewer updates and cleans up every simulated viewer", async () => {
  const methods = [];
  const result = await measureStream({
    base: "http://localhost",
    playbackId: "fixture",
    cookie: "fixture=session",
    concurrency: 3,
    request: async (url, init) => {
      methods.push(init.method);
      if (init.method === "GET")
        return Response.json({ sessionId: "fixture", token: "viewer" });
      if (url.pathname.endsWith("/chat"))
        assert.equal(init.headers.get("cookie"), "fixture=session");
      else assert.equal(init.headers.has("cookie"), false);
      return new Response(null, { status: 200 });
    },
  });
  assert.equal(result.chat.count, 3);
  assert.equal(result.heartbeat.count, 3);
  assert.equal(methods.filter(method => method === "DELETE").length, 3);
});

test("stops scheduling batches after an unsuccessful response", async () => {
  const result = await measureStream({
    base: "http://localhost",
    playbackId: "fixture",
    concurrency: 2,
    batches: 4,
    request: async () => new Response(null, { status: 429 }),
  });
  assert.deepEqual(result.session.statuses, { 429: 2 });
  assert.equal(result.chat, undefined);
});
