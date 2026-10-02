import { z } from "zod";

export const giftSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be greater than zero")
    .max(10_000, "Maximum gift amount is 10,000"),
  currency: z.enum(["STRFI", "USDC"], {
    errorMap: () => ({ message: "Currency must be STRFI or USDC" }),
  }),
  message: z
    .string()
    .max(200, "Gift message must not exceed 200 characters")
    .optional(),
  recipient_id: z.string().min(1, "Recipient is required"),
});

export type GiftInput = z.infer<typeof giftSchema>;

export const giftRules = {
  amount: {
    min: 0,
    exclusive_min: true,
    max: 10_000,
    required: true,
  },
  currency: {
    enum: ["STRFI", "USDC"],
    required: true,
  },
  message: {
    max: 200,
    required: false,
  },
  recipient_id: {
    required: true,
  },
};
