// Shared in-memory state for the automod-presets routesF folder (scope
// constraint: no imports from lib/, so this is duplicated here rather than
// reused from any shared app module).

export type PresetSlug = "family_safe" | "strict" | "permissive";

export interface AutoModPreset {
  slug: PresetSlug;
  label: string;
  description: string;
  rules: {
    block_profanity: boolean;
    block_links: boolean;
    slow_mode_seconds: number;
    require_follow_age_days: number;
  };
}

export const PRESET_PACKS: AutoModPreset[] = [
  {
    slug: "family_safe",
    label: "Family Safe",
    description: "Maximum moderation for a family-friendly chat.",
    rules: {
      block_profanity: true,
      block_links: true,
      slow_mode_seconds: 10,
      require_follow_age_days: 7,
    },
  },
  {
    slug: "strict",
    label: "Strict",
    description: "Blocks profanity and links, moderate slow mode.",
    rules: {
      block_profanity: true,
      block_links: true,
      slow_mode_seconds: 5,
      require_follow_age_days: 1,
    },
  },
  {
    slug: "permissive",
    label: "Permissive",
    description: "Minimal moderation, light-touch chat rules.",
    rules: {
      block_profanity: false,
      block_links: false,
      slow_mode_seconds: 0,
      require_follow_age_days: 0,
    },
  },
];

export function findPreset(slug: string): AutoModPreset | undefined {
  return PRESET_PACKS.find((p) => p.slug === slug);
}

// In-memory store: key = creator_id, value = applied preset slug.
export const creatorPresetStore = new Map<string, PresetSlug>();
