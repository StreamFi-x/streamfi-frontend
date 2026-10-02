import type { ReactionRecord, ReactionAggregate } from "./types";

export const reactionStore: ReactionRecord[] = [];

/**
 * Check if a string is a single grapheme cluster (emoji or character)
 * Uses Array.from which properly handles emoji with zero-width joiners, skin tone modifiers, etc.
 */
export function isSingleGraphemeCluster(input: string): boolean {
  if (typeof input !== "string" || input.length === 0) {
    return false;
  }

  // Use Array.from to split by grapheme clusters
  const graphemes = Array.from(input);
  return graphemes.length === 1;
}

/**
 * Check if a string is a valid emoji
 * An emoji is a grapheme cluster that is not a regular ASCII letter/number
 */
export function isValidEmoji(input: string): boolean {
  if (!isSingleGraphemeCluster(input)) {
    return false;
  }

  // Reject common ASCII letters, numbers, and symbols that aren't emoji
  const codePoint = input.codePointAt(0) || 0;

  // Allow emoji ranges and common Unicode symbols
  // This includes: emoji, emoticons, symbols, pictographs, etc.
  // Reject: ASCII control chars, basic ASCII letters/numbers
  if (codePoint < 127) {
    // Only allow basic ASCII if it's not a letter or digit
    return !/[a-zA-Z0-9]/.test(input);
  }

  return true;
}

export function getReactionsForMessage(
  messageId: string,
  currentUserId?: string
): ReactionAggregate[] {
  // Find all reactions for this message
  const messageReactions = reactionStore.filter(
    r => r.message_id === messageId
  );

  if (messageReactions.length === 0) {
    return [];
  }

  // Aggregate by emoji
  const aggregated = new Map<string, { count: number; userIds: Set<string> }>();

  for (const reaction of messageReactions) {
    const existing = aggregated.get(reaction.emoji) || {
      count: 0,
      userIds: new Set(),
    };
    existing.count += 1;
    existing.userIds.add(reaction.user_id);
    aggregated.set(reaction.emoji, existing);
  }

  // Convert to response format
  const result: ReactionAggregate[] = Array.from(aggregated.entries()).map(
    ([emoji, data]) => ({
      emoji,
      count: data.count,
      reacted_by_me: currentUserId ? data.userIds.has(currentUserId) : false,
    })
  );

  return result;
}

export function toggleReaction(
  messageId: string,
  emoji: string,
  userId: string
): boolean {
  // Check if this user already reacted with this emoji
  const existingIndex = reactionStore.findIndex(
    r => r.message_id === messageId && r.emoji === emoji && r.user_id === userId
  );

  if (existingIndex !== -1) {
    // Remove the reaction (toggle off)
    reactionStore.splice(existingIndex, 1);
    return false; // Toggled off
  } else {
    // Add the reaction (toggle on)
    reactionStore.push({
      message_id: messageId,
      emoji,
      user_id: userId,
    });
    return true; // Toggled on
  }
}

export function validateReactionInput(
  messageId: unknown,
  emoji: unknown,
  userId: unknown
): { valid: boolean; error?: string } {
  if (typeof messageId !== "string" || messageId.trim().length === 0) {
    return { valid: false, error: "message_id must be a non-empty string" };
  }

  if (typeof emoji !== "string" || emoji.length === 0) {
    return { valid: false, error: "emoji must be a non-empty string" };
  }

  if (!isValidEmoji(emoji)) {
    return {
      valid: false,
      error: "emoji must be a single grapheme cluster (emoji or character)",
    };
  }

  if (typeof userId !== "string" || userId.trim().length === 0) {
    return { valid: false, error: "user_id must be a non-empty string" };
  }

  return { valid: true };
}
