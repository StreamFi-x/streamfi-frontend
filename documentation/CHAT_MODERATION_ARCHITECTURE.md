# Chat Moderation Architecture

This document defines the first implementation contract for StreamFi chat moderation. It covers appointed moderators, viewer reports, automated filtering, and time-boxed mutes so each feature can be implemented against one shared model rather than as separate one-off controls.

## Moderation Roles

The current moderation model should evolve from stream-owner-only actions into a channel-scoped role system.

Recommended data model:

| Entity | Purpose |
| --- | --- |
| `stream_moderators` | Stores channel or channel-group grants for appointed moderators. |
| `moderator_capabilities` | Stores the actions a moderator may perform, such as delete, timeout, report-review, or blocklist edits. |
| `moderation_audit_events` | Stores grant, revoke, timeout, report action, and content-filter decisions. |

Revocation must take effect on the server immediately. Client-side capability caches can improve UX, but every moderation mutation must re-check server-side authorization before it writes state.

## Message Reports

Viewer-initiated reports need message-level granularity. A stream-level report is too broad when one chat message is the problem.

Recommended report record fields:

- stream id and channel id;
- message id;
- preserved message body at report time;
- reported user id;
- reporter user id;
- reason category;
- optional free-text context;
- created timestamp;
- review status and reviewer id.

Duplicate reports from the same reporter for the same message should be collapsed. Reporter identity should be visible only to moderators and platform staff, never to the reported user.

## Automated Pre-Insertion Filtering

The pre-insertion filter should be fast, deterministic for common cases, and explicit about what it does with flagged messages.

Recommended stages:

1. Normalize message text for spacing, punctuation, and common evasion patterns.
2. Run profanity and link-pattern checks synchronously before insert.
3. Check per-user rolling windows for repeated-message flooding.
4. Route suspicious messages to hold-for-review when the confidence is high enough to stop public display but not high enough to delete automatically.
5. Record a moderation audit event for every held or rejected message.

The common path must remain low latency. A fast synchronous filter can be paired with an async second-pass classifier if deeper inspection is needed.

## Time-Boxed Mutes

Timeouts are stream-scoped and expire by timestamp, not by a permanent boolean flag.

Recommended mute record fields:

- stream id or channel id;
- muted user id;
- moderator user id;
- reason;
- `starts_at`;
- `expires_at`;
- optional `lifted_at` and `lifted_by`.

Message sending must check active mutes server-side. The client should also show immediate feedback with the remaining duration, but client-side checks are advisory only.

For overlapping mutes, use replace-if-longer semantics: a new mute extends the active mute only when its expiry is later than the current expiry. This avoids accidental shortening while keeping moderator behavior predictable.

## Permission Checks

All moderation-capable actions should go through one authorization helper:

| Action | Required capability |
| --- | --- |
| Delete message | `chat.message.delete` |
| Report review | `chat.report.review` |
| Issue timeout | `chat.user.timeout` |
| Lift timeout | `chat.user.timeout_lift` |
| Manage moderators | `chat.moderator.manage` |

The stream owner receives all capabilities. Appointed moderators receive only the capabilities granted to their role.

## Test Coverage Targets

Future implementation PRs should include tests for:

- cross-channel moderator grant scoping;
- revocation racing with an in-flight moderation action;
- duplicate message reports from the same reporter;
- report rate limiting;
- profanity evasion via spacing or character substitution;
- repeated-message spam in a rolling window;
- timeout expiry boundaries;
- manual early timeout lift;
- concurrent sends near mute expiry.