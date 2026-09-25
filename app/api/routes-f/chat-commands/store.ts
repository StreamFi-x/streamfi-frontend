import type { ChatCommand } from "./types";

// Store keyed by creator_id
export const commandStore: Record<string, ChatCommand[]> = {
  creator_alice: [
    {
      id: "cmd_1",
      trigger: "!discord",
      response_template: "Join our Discord at https://discord.gg/streamfi",
      cooldown_seconds: 30,
      enabled: true,
    },
    {
      id: "cmd_2",
      trigger: "!so",
      response_template: "Shoutout to {{user}}! Go check them out!",
      cooldown_seconds: 10,
      enabled: true,
    },
    {
      id: "cmd_3",
      trigger: "!tip",
      response_template: "Tip with XLM or USDC via StreamFi — every tip counts!",
      cooldown_seconds: 60,
      enabled: false,
    },
  ],
};

/**
 * Interpolate {{variable}} placeholders in a template string.
 */
export function interpolate(
  template: string,
  context: Record<string, string> = {}
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] ?? `{{${key}}}`);
}
