# Chat Safety Controls Roadmap

This document expands the chat moderation architecture into four creator-safety controls that should share one enforcement model instead of becoming separate one-off features. The goal is to make per-channel blocklists, moderator accountability, safe-link handling, and raid protection work together in the chat message lifecycle while keeping latency low enough for live streams.

## Goals

- Give each creator configurable channel-level safety settings without weakening the platform-level moderation baseline.
- Keep chat enforcement server-side so blocked messages, unsafe links, and hostile raid patterns are handled before broadcast.
- Preserve a durable audit trail for privileged moderation actions so creators can review who acted, when, and why.
- Provide automatic raid mitigations that are temporary, visible, reversible, and tunable per channel.
- Avoid duplicating matching, logging, and rate-limit logic across unrelated modules.

## Shared pipeline

All incoming chat messages should pass through a single pre-insertion moderation pipeline before persistence or fan-out:

1. Load platform policy, channel policy, and viewer context for the target stream.
2. Normalize the message text for matching while preserving the original text for display and audit records.
3. Detect URLs and extract destination domains before evaluating word and phrase policies.
4. Evaluate global blocklists, channel blocklists, platform link blocks, channel link allowlists, channel link blocks, and rate-limit context.
5. Emit a structured moderation decision: `allow`, `warn`, `hold`, `block`, `timeout`, `lockdown`, or `escalate`.
6. Persist the message only when the decision allows it, and persist an audit event for any privileged or automatic enforcement action.
7. Broadcast the original message, a warning state, or a moderation notice depending on the decision.

The important implementation detail is that creator-owned controls should feed the same decision object as platform-owned controls. That gives the UI one status vocabulary and keeps future safety features from adding parallel, inconsistent moderation paths.

## Per-creator word and phrase blocklists

Creators need a channel-owned list of blocked words and phrases. Each entry should include the creator or moderator who created it, the normalized matcher value, the original label, the action to take, and whether the entry is enabled.

Recommended fields:

- `id`
- `channelId`
- `pattern`
- `normalizedPattern`
- `matchMode`: `exact`, `contains`, or `phrase`
- `action`: `block`, `hold`, or `timeout`
- `createdBy`
- `createdAt`
- `updatedAt`
- `enabled`

Normalization should happen both when saving a rule and when checking a message. The normalizer should case-fold text, collapse repeated whitespace, strip low-signal punctuation, and map common substitution characters where the risk of false positives is manageable. Exact word boundaries still matter: a blocked short word should not accidentally match inside unrelated words.

For larger channels, the enforcement path should compile enabled rules into a reusable matcher per channel and refresh that matcher when settings change. This avoids scanning every message against an arbitrary list with repeated allocations during busy chats.

The creator dashboard should include add, remove, disable, and preview actions. The preview action should let a creator type a sample message and see which rule would match before the rule is relied on during a stream.

## Safe-link restrictions and warnings

Chat should detect URLs before the message is persisted. Detection should handle protocol-less domains, standard `http` and `https` links, and obvious obfuscation patterns without rewriting the user's visible message in surprising ways.

Suggested policy order:

1. Platform blocklist always wins.
2. Channel blocklist applies next.
3. Channel allowlist bypasses the click-through warning for trusted domains.
4. Unknown domains are allowed only with a visible warning interstitial.

For each detected link, the server should store structured metadata with the message: raw URL, normalized host, policy result, and whether a warning is required. The client should render unknown but allowed links through a warning interstitial that shows the real destination host and makes clear the viewer is leaving StreamFi.

Blocked links should produce a moderation decision before broadcast. Depending on channel settings, the poster can receive a local explanation, a temporary timeout, or an escalation for moderators.

## Moderator accountability log

Every privileged moderation action should write an append-only audit event. This should cover manual actions by moderators and automatic actions from the safety pipeline.

Recommended event fields:

- `id`
- `channelId`
- `actorUserId`
- `actorRole`: `owner`, `moderator`, `system`, or `platform`
- `targetUserId`
- `targetMessageId`
- `actionType`
- `reason`
- `metadata`
- `createdAt`

Action types should include message deletion, timeout, ban, unban, slow-mode change, follower-only change, blocklist rule change, link policy change, and raid mitigation state change.

The dashboard API should be owner-scoped, paginated, and filterable by moderator, action type, target user, and date range. Moderators should not be able to tamper with or erase their own records. Message content in audit metadata should be minimized so the log remains useful without becoming a long-term content-retention problem.

## Raid and hate-raid protection

Raid detection should compare current channel activity to that channel's own recent baseline rather than relying on one global fixed threshold. A small channel and a large channel need different sensitivity.

Signals to track in rolling windows:

- Join velocity by channel.
- First-message velocity from new or low-trust accounts.
- Similarity of repeated messages across recently joined accounts.
- Account age or account trust tier when available.
- Recent link posting spikes.
- Existing rate-limit pressure.

The detector should produce a confidence score and a reason list. Low confidence can alert moderators only. Higher confidence can temporarily enable slow mode, follower-only mode, link restrictions, or emergency chat lockdown. Every automatic mitigation should be visible in the creator/mod UI, include a countdown or expiry, and offer manual override.

Raid responses should also write audit events. That lets creators review when the system acted, what signal triggered it, and whether the response was too aggressive or too soft.

## UI surfaces

The creator moderation area should group these controls into predictable sections:

- Blocked words and phrases, with add/remove/disable and test preview.
- Link rules, with channel allowlist, channel blocklist, and default unknown-link behavior.
- Moderator activity, with summary counts and a detailed log table.
- Raid protection, with current status, sensitivity, active mitigations, and recent triggered alerts.

The viewer chat surface should stay calm. It only needs to show clear local feedback when a message is blocked, held, or link-warning gated. The creator/mod surface should receive the richer reason and control states.

## Rollout plan

1. Introduce the shared moderation decision type and audit event vocabulary.
2. Add the server-side blocklist model and matching path before message persistence.
3. Add URL extraction and domain policy evaluation in the same pipeline.
4. Add append-only moderation audit logging around existing privileged actions.
5. Add dashboard views for blocklists, link rules, and moderator activity.
6. Add rolling activity counters for raid detection.
7. Wire temporary raid mitigations into existing chat mode and rate-limit controls.
8. Tune thresholds from observed channel data before enabling automatic lockdown by default.

## Acceptance checklist

- Per-channel blocklists are creator-managed and enforced before chat broadcast.
- Text normalization catches common evasion attempts while preserving reasonable word boundaries.
- Link policy supports platform blocks, channel allowlists, channel blocks, and unknown-link warnings.
- Moderator actions and automatic safety actions are written to an append-only audit log.
- Creator dashboard screens can inspect moderation activity and current safety controls.
- Raid detection uses rolling channel baselines and multiple correlated signals.
- Automatic raid mitigations are temporary, reversible, visible, and audited.