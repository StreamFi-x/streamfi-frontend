/**
 * Reaction system types
 */

export const REACTION_TYPES = {
  HEART: "heart",
  LAUGH: "laugh",
  WOW: "wow",
  FIRE: "fire",
  CLAP: "clap",
} as const;

export type ReactionType = typeof REACTION_TYPES[keyof typeof REACTION_TYPES];

export interface ClientReaction {
  type: ReactionType;
  timestamp: number;
  userId?: string;
}

export interface AggregatedReactionBroadcast {
  streamId: string;
  reactions: {
    [key in ReactionType]?: number;
  };
  timestamp: number;
}

/**
 * Metadata for reaction emoji/animation
 */
export interface ReactionMetadata {
  type: ReactionType;
  emoji: string;
  label: string;
  keyCode?: string; // Keyboard shortcut, e.g., 'h' for heart
  animationDuration: number; // ms
}

export const REACTION_METADATA: Record<ReactionType, ReactionMetadata> = {
  [REACTION_TYPES.HEART]: {
    type: REACTION_TYPES.HEART,
    emoji: "❤️",
    label: "Heart",
    keyCode: "h",
    animationDuration: 1500,
  },
  [REACTION_TYPES.LAUGH]: {
    type: REACTION_TYPES.LAUGH,
    emoji: "😂",
    label: "Laugh",
    keyCode: "l",
    animationDuration: 1500,
  },
  [REACTION_TYPES.WOW]: {
    type: REACTION_TYPES.WOW,
    emoji: "😮",
    label: "Wow",
    keyCode: "w",
    animationDuration: 1500,
  },
  [REACTION_TYPES.FIRE]: {
    type: REACTION_TYPES.FIRE,
    emoji: "🔥",
    label: "Fire",
    keyCode: "f",
    animationDuration: 1500,
  },
  [REACTION_TYPES.CLAP]: {
    type: REACTION_TYPES.CLAP,
    emoji: "👏",
    label: "Clap",
    keyCode: "c",
    animationDuration: 1500,
  },
};
