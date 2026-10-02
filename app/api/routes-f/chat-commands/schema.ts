import { z } from "zod";

export const querySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
});

export const addCommandSchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  trigger: z
    .string()
    .min(2, "trigger must be at least 2 chars")
    .regex(/^![\w-]+$/, "trigger must start with ! and contain only word chars"),
  response_template: z.string().min(1, "response_template is required"),
  cooldown_seconds: z.number().int().min(0).default(5),
  enabled: z.boolean().default(true),
});

export const executeCommandSchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  trigger: z.string().min(1, "trigger is required"),
  context: z.record(z.string()).optional(),
});

export const toggleCommandSchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  command_id: z.string().min(1, "command_id is required"),
  enabled: z.boolean(),
});
