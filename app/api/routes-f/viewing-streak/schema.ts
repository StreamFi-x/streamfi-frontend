import { z } from "zod";

export const querySchema = z.object({
  viewer_id: z.string().min(1, "viewer_id is required"),
  creator_id: z.string().min(1, "creator_id is required"),
});

export const checkInSchema = z.object({
  viewer_id: z.string().min(1, "viewer_id is required"),
  creator_id: z.string().min(1, "creator_id is required"),
  on_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "on_date must be in YYYY-MM-DD format")
    .optional(),
});
