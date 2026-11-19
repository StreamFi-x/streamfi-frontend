# Architecture & Specifications: Bug Triage, Stream Metadata Screening, Leaderboards, and Co-Streaming

Issues: #1436, #1437, #1443, #1448

## 1. Bug-Report Triage & SLA Tracking (#1448)
- **Classification**: Heuristic routing that classifies security and financial routes as `critical` (2h SLA), video outages as `high` (8h SLA), and UI bugs as `medium`/`low`.
- **Duplicate Detection**: Jaccard token similarity across report titles, routes, and error stack traces.

## 2. Stream Metadata Pre-Publish Screening (#1437)
- **Phased Validation**: Deterministic regex for severe violations combined with Unicode homoglyph normalization and heuristics for crypto-doubling scams and unverified giveaways.
- **Enforcement**: Hard-blocks critical violations while flagging promotional edge cases for expedited human review without delaying stream start.

## 3. Leaderboard Engine with Anti-Gaming (#1436)
- **Aggregation**: Periodic scheduled computation of top tippers and streamers across weekly, monthly, and all-time windows.
- **Anti-Collusion**: Analyzes directional tip cycles ($A \to B \to A$) and self-tipping wallet clusters to exclude wash-trading from public leaderboards.

## 4. Co-Streamer Squad Invites & Compositing (#1443)
- **Architecture Choice**: Employs client-side multi-feed grid compositing with synchronized layout states, keeping latency low and avoiding heavy server-side video re-encoding costs.
- **State Management**: Dynamic 4-member squad capacity management handling mid-stream joins and departures.
