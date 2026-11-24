# Chat and viewer load checks

Use a disposable live stream and test account on a staging deployment.
Set `LOAD_STAGING_ORIGIN`, `LOAD_PLAYBACK_ID`, and `LOAD_CHAT_COOKIE` in the
runner environment. Run `node scripts/load-stream.mjs`. The runner mints
viewer sessions, joins, posts labeled fixture chat messages, sends viewer
heartbeats, and attempts to leave. Remove fixture messages after the run.

Start with `LOAD_CONCURRENCY=2` and `LOAD_BATCHES=1`. The runner supports
up to 20 concurrent sessions and five batches and stops scheduling new
batches on errors or throttling. Record the deployment revision, concurrency,
per-operation p95 latency and status counts. Increase concurrency in separate
runs until latency exceeds your agreed target or requests are rejected.
A 429 identifies a configured limit, while 5xx or timeouts warrant checking
application and database capacity.

A staging baseline requires a live test stream and session. The local test
only verifies the runner's request sequence and error reporting.
