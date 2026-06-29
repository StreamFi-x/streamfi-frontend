import { z } from "zod";

export const querySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
});

export const setSchema = z
  .object({
    creator_id: z.string().min(1, "creator_id is required"),
    type: z.enum(["image", "clip", "vod", "none"]),
    source_url: z.string().url().optional(),
    vod_id: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.type === "image" || data.type === "clip") && !data.source_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "source_url is required for type image or clip",
        path: ["source_url"],
      });
    }
    if (data.type === "vod" && !data.vod_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "vod_id is required for type vod",
        path: ["vod_id"],
      });
    }
  });
