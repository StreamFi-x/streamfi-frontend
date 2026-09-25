import { z } from "zod";

export const querySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
});

export const selectSchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  stinger_id: z.string().min(1, "stinger_id is required"),
});

export const addSchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  name: z.string().min(1, "name is required"),
  url: z.string().url("url must be a valid URL"),
});
