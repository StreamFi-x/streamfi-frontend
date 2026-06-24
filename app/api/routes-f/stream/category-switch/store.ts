import type { CategoryTimelineEntry } from "./types";

export const categoryTimelines = new Map<string, CategoryTimelineEntry[]>();

export function getCurrentCategory(streamId: string): string | undefined {
  const timeline = categoryTimelines.get(streamId);
  if (!timeline || timeline.length === 0) return undefined;
  return timeline[timeline.length - 1].category;
}

export function addCategorySwitch(
  streamId: string,
  category: string
): { previous_category: string; new_category: string; switched_at: string } {
  const previous = getCurrentCategory(streamId) ?? "none";
  const switched_at = new Date().toISOString();
  const entry: CategoryTimelineEntry = { category, switched_at };

  const timeline = categoryTimelines.get(streamId) ?? [];
  timeline.push(entry);
  categoryTimelines.set(streamId, timeline);

  return { previous_category: previous, new_category: category, switched_at };
}

export function getTimeline(streamId: string): CategoryTimelineEntry[] {
  return categoryTimelines.get(streamId) ?? [];
}
