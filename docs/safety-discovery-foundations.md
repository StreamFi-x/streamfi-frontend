# Safety and discovery foundations

This note documents the shared helpers added for the next pass on search quality, chat storm protection, mature-content access, and ban appeals.

## Search ranking

`lib/search-ranking.ts` provides a tunable score that blends text relevance, follower count, live status, and recency. The text score gives the strongest weight to exact and prefix matches, then falls back to substring and trigram-style fuzzy matches. The helper returns the score and individual signals so API routes can expose or log why an item ranked where it did.

## Chat auto-throttle

`lib/chat-auto-throttle.ts` computes a channel baseline and a graduated throttle state. A channel becomes `elevated` at 2x baseline and `storm` at 4x baseline. The computed slow-mode value is combined with any manual slow mode by taking the stricter setting, so creator intent is preserved.

## Mature content gating

`lib/content-maturity.ts` defines a three-level taxonomy: `general`, `mature`, and `adult`. Discovery helpers default to hiding mature/adult content unless the viewer has opted in and declared adult eligibility. Adult content also requires authentication.

## Ban appeals

`lib/ban-appeal-workflow.ts` centralizes appeal submission rules and state transitions. It allows only one active appeal, applies a cooldown after resolved appeals, and returns user-facing notification copy that includes the original ban reason without exposing moderator-internal details.

## Follow-up integration points

- Search routes should call `rankSearchResults()` after candidate retrieval or translate the same weights into SQL.
- Chat message ingestion should feed per-channel samples into `rollingBaseline()` and display `viewerMessage` when throttling is active.
- Stream start/schedule flows should persist `MaturityRating`; browse/search/category pages should call `includeInDiscovery()`.
- Ban appeal submission/review routes should use `canSubmitBanAppeal()` and `nextAppealStatus()` to keep the workflow consistent.