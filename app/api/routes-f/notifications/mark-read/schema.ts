import { z } from "zod";

export const markReadSchema = z
  .object({
    viewer_id: z.string().min(1, "viewer_id is required"),
    ids: z.array(z.string().min(1)).optional(),
    all: z.boolean().optional(),
  })
  .refine(
    (data) => data.all === true || (Array.isArray(data.ids) && data.ids.length > 0),
    { message: "Provide ids (non-empty array) or all=true" }
  );
