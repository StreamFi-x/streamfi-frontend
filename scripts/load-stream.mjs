import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

export async function measureStream({
  base,
  playbackId,
  cookie,
  concurrency,
  batches = 1,
  request = fetch,
}) {
  const url = new URL(base);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "Use an HTTP(S) staging origin without credentials in the URL"
    );
  }
  if (
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 20 ||
    !Number.isInteger(batches) ||
    batches < 1 ||
    batches > 5
  ) {
    throw new Error("Concurrency must be 1–20 and batches must be 1–5");
  }
  const results = [];
  async function send(path, method, body, operation) {
    const start = performance.now();
    let status = 0;
    try {
      const headers = new Headers();
      if (body) headers.set("content-type", "application/json");
      if (cookie && operation === "chat") headers.set("cookie", cookie);
      const response = await request(new URL(path, url), {
        method,
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        body: body ? JSON.stringify(body) : undefined,
      });
      status = response.status;
      if (operation === "session" && response.ok) return await response.json();
      await response.body?.cancel();
      return response.ok;
    } catch {
      status = 0;
      return false;
    } finally {
      results.push({ operation, status, ms: performance.now() - start });
    }
  }

  for (let batch = 0; batch < batches; batch += 1) {
    const offset = results.length;
    await Promise.all(
      Array.from({ length: concurrency }, async (_, index) => {
        const session = await send(
          `/api/streams/viewers?playbackId=${encodeURIComponent(playbackId)}`,
          "GET",
          undefined,
          "session"
        );
        if (!session?.sessionId || !session?.token) return;
        const viewer = {
          playbackId,
          sessionId: session.sessionId,
          token: session.token,
        };
        try {
          if (!(await send("/api/streams/viewers", "POST", viewer, "join")))
            return;
          if (
            !(await send(
              "/api/streams/chat",
              "POST",
              {
                playbackId,
                content: `Staging load fixture ${batch + 1}.${index + 1}`,
              },
              "chat"
            ))
          )
            return;
          await send("/api/streams/viewers", "PATCH", viewer, "heartbeat");
        } finally {
          await send("/api/streams/viewers", "DELETE", viewer, "leave");
        }
      })
    );
    if (
      results
        .slice(offset)
        .some(sample => sample.status < 200 || sample.status >= 300)
    )
      break;
  }

  return Object.fromEntries(
    [...new Set(results.map(sample => sample.operation))].map(operation => {
      const samples = results.filter(sample => sample.operation === operation);
      const durations = samples.map(sample => sample.ms).sort((a, b) => a - b);
      const statuses = {};
      for (const { status } of samples)
        statuses[status] = (statuses[status] ?? 0) + 1;
      return [
        operation,
        {
          count: samples.length,
          statuses,
          p95Ms: Math.round(durations[Math.ceil(durations.length * 0.95) - 1]),
        },
      ];
    })
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { LOAD_STAGING_ORIGIN, LOAD_PLAYBACK_ID, LOAD_CHAT_COOKIE } =
    process.env;
  if (!LOAD_STAGING_ORIGIN || !LOAD_PLAYBACK_ID || !LOAD_CHAT_COOKIE) {
    console.error(
      "Supply the staging origin, disposable playback ID, and a test-account session cookie."
    );
    process.exitCode = 1;
  } else {
    try {
      const result = await measureStream({
        base: LOAD_STAGING_ORIGIN,
        playbackId: LOAD_PLAYBACK_ID,
        cookie: LOAD_CHAT_COOKIE,
        concurrency: Number(process.env.LOAD_CONCURRENCY ?? 2),
        batches: Number(process.env.LOAD_BATCHES ?? 1),
      });
      console.log(JSON.stringify(result, null, 2));
      if (
        Object.values(result).some(({ statuses }) =>
          Object.keys(statuses).some(
            status => Number(status) < 200 || Number(status) >= 300
          )
        )
      )
        process.exitCode = 1;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
