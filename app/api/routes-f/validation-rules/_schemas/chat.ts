import { z } from "zod";

// banned_words is server-side only — never exported in the API response
const BANNED_WORDS: string[] = [];

export const chatSchema = z
  .object({
    message: z
      .string()
      .min(1, "Message cannot be empty")
      .max(500, "Message must not exceed 500 characters"),
    emote_only: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    const lower = data.message.toLowerCase();
    for (const word of BANNED_WORDS) {
      if (lower.includes(word)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["message"],
          message: "Message contains prohibited content",
        });
        break;
      }
    }
  });

export type ChatInput = z.infer<typeof chatSchema>;

export const chatRules = {
  message: {
    min: 1,
    max: 500,
    required: true,
  },
  emote_only: {
    type: "boolean",
    default: false,
  },
};
