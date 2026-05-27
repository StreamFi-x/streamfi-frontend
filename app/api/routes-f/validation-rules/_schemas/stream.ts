import { z } from "zod";

export const streamSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title must not exceed 120 characters"),
  description: z
    .string()
    .max(500, "Description must not exceed 500 characters")
    .optional(),
  category: z.string().min(1, "Category is required"),
  tags: z
    .array(z.string().max(30))
    .max(10, "You may add up to 10 tags")
    .optional(),
  is_mature: z.boolean().default(false),
});

export type StreamInput = z.infer<typeof streamSchema>;

export const streamRules = {
  title: {
    min: 3,
    max: 120,
    required: true,
  },
  description: {
    max: 500,
    required: false,
  },
  category: {
    required: true,
  },
  tags: {
    max_items: 10,
    item_max_length: 30,
    required: false,
  },
  is_mature: {
    type: "boolean",
    default: false,
  },
};
