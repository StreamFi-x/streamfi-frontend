#!/usr/bin/env node
/**
 * End-to-end chat-poll load test (#1410): N simulated viewers each poll
 * GET /api/streams/chat once a second, exactly like hooks/useChat.ts.
 *
 *   node scripts/load-test/chat-poll-http.mjs \
 *     --base-url https://<preview>.vercel.app --playback-id <live id> \
 *     --viewers 50,200,500 --seconds 60
 *
 * Point it at a preview or staging deployment with a live test stream. It
 * refuses the production domain unless --allow-production is passed, and
 * nobody should pass that without agreeing a window with the maintainers.
 *
 * Reports per step: request rate, status mix, latency percentiles, and the
 * share served by the edge (x-vercel-cache HIT/STALE), which is what keeps
 * database load flat as viewers grow.
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith("--")) {
      const next = all[i + 1];
      pairs.push([
        arg.slice(2),
        next && !next.startsWith("--") ? next : "true",
      ]);
    }
    return pairs;
  }, [])
);

const baseUrl = args["base-url"];
const playbackId = args["playback-id"];
const steps = (args.viewers ?? "10,50,100").split(",").map(Number);
const seconds = Number(args.seconds ?? 30);
const limit = Number(args.limit ?? 200);

if (!baseUrl || !playbackId) {
  console.error(
    "usage: --base-url <url> --playback-id <id> [--viewers 10,50] [--seconds 30]"
  );
  process.exit(2);
}
if (
  /(^|\.)streamfi\.media$/i.test(new URL(baseUrl).hostname) &&
  args["allow-production"] !== "true"
) {
  console.error(
    "Refusing to load-test production. Use a preview/staging deployment."
  );
  process.exit(2);
}

const url = `${baseUrl.replace(/\/$/, "")}/api/streams/chat?playbackId=${encodeURIComponent(playbackId)}&limit=${limit}`;

function percentile(sorted, p) {
  return sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
    : 0;
}

async function viewer(deadline, stats) {
  // Stagger start so viewers do not poll in lockstep.
  await new Promise(r => setTimeout(r, Math.random() * 1000));
  while (Date.now() < deadline) {
    const started = performance.now();
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "streamfi-chat-load-test" },
      });
      await res.arrayBuffer();
      stats.latencies.push(performance.now() - started);
      stats.status[res.status] = (stats.status[res.status] ?? 0) + 1;
      const cache = res.headers.get("x-vercel-cache") ?? "none";
      stats.cache[cache] = (stats.cache[cache] ?? 0) + 1;
    } catch {
      stats.status.network_error = (stats.status.network_error ?? 0) + 1;
    }
    // SWR refreshInterval starts after the previous request settles.
    await new Promise(r => setTimeout(r, 1000));
  }
}

console.log(`target ${url}`);
for (const viewers of steps) {
  const stats = { latencies: [], status: {}, cache: {} };
  const deadline = Date.now() + seconds * 1000;
  await Promise.all(
    Array.from({ length: viewers }, () => viewer(deadline, stats))
  );

  const sorted = stats.latencies.sort((a, b) => a - b);
  const total = Object.values(stats.status).reduce((a, b) => a + b, 0);
  const edge = (stats.cache.HIT ?? 0) + (stats.cache.STALE ?? 0);
  console.log(
    JSON.stringify({
      viewers,
      requests: total,
      rps: +(total / seconds).toFixed(1),
      status: stats.status,
      p50_ms: +percentile(sorted, 0.5).toFixed(1),
      p95_ms: +percentile(sorted, 0.95).toFixed(1),
      p99_ms: +percentile(sorted, 0.99).toFixed(1),
      edge_served: total ? +(edge / total).toFixed(3) : 0,
      cache: stats.cache,
    })
  );
}
