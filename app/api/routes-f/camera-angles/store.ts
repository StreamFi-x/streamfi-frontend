import type { ViewerAngleSelection } from "./types";

const selections = new Map<string, ViewerAngleSelection>();

function selectionKey(viewerId: string, streamId: string): string {
  return `${viewerId}:${streamId}`;
}

export function setViewerAngle(
  viewerId: string,
  streamId: string,
  angleId: string,
  now: number = Date.now()
): ViewerAngleSelection {
  const record: ViewerAngleSelection = {
    viewer_id: viewerId,
    stream_id: streamId,
    angle_id: angleId,
    selected_at: new Date(now).toISOString(),
  };
  selections.set(selectionKey(viewerId, streamId), record);
  return record;
}

export function getViewerAngle(
  viewerId: string,
  streamId: string
): ViewerAngleSelection | undefined {
  return selections.get(selectionKey(viewerId, streamId));
}

export function resetStore(): void {
  selections.clear();
}
