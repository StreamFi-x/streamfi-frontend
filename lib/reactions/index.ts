/**
 * Reactions system exports
 */

export { ReactionRateLimiter, getReactionLimiter, type RateLimiterConfig } from "./rate-limiter";
export {
  ReactionAggregator,
  ReactionHandler,
  recordReactionMetric,
  type ReactionEvent,
  type AggregatedReaction,
} from "./aggregator";
export {
  REACTION_TYPES,
  REACTION_METADATA,
  type ReactionType,
  type ClientReaction,
  type AggregatedReactionBroadcast,
} from "./types";
