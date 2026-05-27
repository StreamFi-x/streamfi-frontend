import { z } from "zod";

export const userSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must not exceed 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers, and underscores"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Must be a valid email address"),
  display_name: z
    .string()
    .min(1, "Display name is required")
    .max(50, "Display name must not exceed 50 characters"),
  bio: z.string().max(300, "Bio must not exceed 300 characters").optional(),
  website_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

export type UserInput = z.infer<typeof userSchema>;

export const userRules = {
  username: {
    min: 3,
    max: 30,
    pattern: "^[a-zA-Z0-9_]+$",
    description: "Letters, numbers, and underscores only",
  },
  email: {
    format: "email",
    required: true,
  },
  display_name: {
    min: 1,
    max: 50,
    required: true,
  },
  bio: {
    max: 300,
    required: false,
  },
  website_url: {
    format: "url",
    required: false,
  },
};
