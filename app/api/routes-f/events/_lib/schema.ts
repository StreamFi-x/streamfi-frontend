import { z } from "zod";
import { AnalyticsEvent, EventSubmission } from "./types";

export const AnalyticsEventSchema: z.ZodType<AnalyticsEvent> = z.object({
  name: z.string().min(1, "Event name is required"),
  timestamp: z.number().int().positive("Timestamp must be a positive integer"),
  properties: z.record(z.any()).optional(),
});

export const EventSubmissionSchema: z.ZodType<EventSubmission> = z.object({
  event: AnalyticsEventSchema.optional(),
  events: z.array(AnalyticsEventSchema).optional(),
}).refine(
  (data) => data.event || data.events,
  {
    message: "Either 'event' or 'events' must be provided",
    path: [],
  }
).refine(
  (data) => !(data.event && data.events),
  {
    message: "Cannot provide both 'event' and 'events'",
    path: [],
  }
).refine(
  (data) => !data.events || data.events.length <= 100,
  {
    message: "Batch size cannot exceed 100 events",
    path: ["events"],
  }
);

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
