import assert from "node:assert/strict";
import { test } from "node:test";
import { scrubErrorEvent } from "../lib/error-monitoring/scrub-event.ts";

test("retains source-map frame coordinates while dropping wallet and session data", () => {
  const wallet = "G" + "A".repeat(55);
  const secret = "fixture-session";
  const event = scrubErrorEvent({
    user: { id: wallet },
    request: { headers: { cookie: secret } },
    breadcrumbs: [{ message: secret }],
    extras: { wallet },
    exception: {
      values: [
        {
          value: `${wallet} ${secret}`,
          stacktrace: {
            frames: [
              { filename: `app.js?cookie=${secret}`, lineno: 3, colno: 7 },
            ],
          },
        },
      ],
    },
  });
  const result = JSON.stringify(event);
  assert.equal(result.includes(wallet), false);
  assert.equal(result.includes(secret), false);
  assert.deepEqual(
    event.exception.values[0].stacktrace.frames[0].filename,
    "app.js"
  );
  assert.equal(event.exception.values[0].stacktrace.frames[0].lineno, 3);
});
