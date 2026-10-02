import { z } from "zod";
import { VALID_SECTIONS } from "./sections";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const getQuerySchema = z.object({
  viewer_id: z.string().min(1, "viewer_id is required"),
});

export const putBodySchema = z.object({
  viewer_id: z.string().min(1, "viewer_id is required"),
  enabled: z.boolean().optional(),
  day_of_week: z.enum(DAYS).optional(),
  sections: z
    .array(z.enum(VALID_SECTIONS as [string, ...string[]]))
    .optional(),
});
