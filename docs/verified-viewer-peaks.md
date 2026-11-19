# Verified viewer counts and peaks

Apply `20261022090000_verified_viewer_peaks.sql` before deploying these writers.
Pause viewer mutations while applying the transactional migration. It records
duplicate counts without copying viewer PII, creates a unique stream/session key and an active-viewer
index, and preserves previous peaks in `legacy_peak_viewers`. Those historical
values cannot be verified retrospectively. Their public `peak_viewers` is NULL
until a new sample is available; `peak_viewers_verified` distinguishes this case
from a measured zero. Never backfill a verified peak from the old counter.

Join, heartbeat, leave, and the reconciliation job use one transaction on one
connection. They lock the creator followed by the live stream session. Counts
come from distinct server-issued session IDs with a heartbeat within 90 seconds,
never from incrementing `users.current_viewers`. Replayed joins do not add views;
replayed or unknown leaves do not subtract views. Expired records can resume on a
heartbeat; an explicit leave cannot be reopened with the same token. Missing
analytics tables now return a retryable 503 instead of recording invented counts.
Client-supplied user IDs are not accepted as authenticated viewer identities.

A peak counts only sessions at least 30 seconds old with a subsequent heartbeat.
The highest sample is retained in `stream_viewer_peak_samples`, including its
timestamp, active IP diversity, and the confirmation/freshness windows. Storage is
bounded to one sample per stream. Short connection bursts cannot set the peak.
This is a confirmed-session metric, not proof of human viewers: sustained bot
sessions, token minting across multiple IPs, and proxy misconfiguration need
additional abuse detection. IP diversity is evidence, not a cap that penalizes
legitimate viewers sharing a network.

If investigation establishes that a sample is fraudulent, preserve the evidence
in the incident record before deleting its sample and setting `peak_viewers` to
NULL and `peak_viewers_verified` to false in the same maintenance transaction.
Take the same creator/session locks as the writer. The next observation starts
a new verified high-water mark; it cannot reconstruct a lost historical peak.
Do not replace it with an estimated audience size.

Admin routes use `authorizeAdmin(request, route)`. It verifies a signed wallet or
Privy session inside the brute-force guard and reads the database role once.
Unsigned legacy wallet cookies do not grant admin access. Use its returned
`admin.userId` for audit actors and per-admin limits; `privyId` is optional metadata.
Existing route permissions and the refresh-total endpoint's any-admin-tier
exception remain explicit in the shared policy. Shared service-secret checks are
separate from user identity authorization.

Transak permits one active or opening widget. Other opens return false and call
`onError`. Closing or unmounting disposes the owner. SDK v4 removes all static
listeners on disposal, so the next widget registers handlers again. Close
notifications are idempotent and asynchronous loading cannot initialize after
unmounting.
