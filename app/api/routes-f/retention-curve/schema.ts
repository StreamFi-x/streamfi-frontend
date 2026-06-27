import { z } from "zod";

export const querySchema = z.object({
  stream_id: z.string().min(1, "stream_id is required"),
});
