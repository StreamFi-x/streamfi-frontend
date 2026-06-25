import type { RerunConfig } from "./types";

const reruns = new Map<string, RerunConfig>();

export function getRerun(creatorId: string): RerunConfig | undefined {
  return reruns.get(creatorId);
}

export function setRerun(
  creatorId: string,
  vodId: string,
  enabled: boolean
): RerunConfig {
  const config: RerunConfig = {
    creator_id: creatorId,
    vod_id: enabled ? vodId : null,
    rerun_active: enabled,
    started_at: enabled ? new Date().toISOString() : null,
  };
  reruns.set(creatorId, config);
  return config;
}

export function clearRerun(creatorId: string): boolean {
  reruns.delete(creatorId);
  return true;
}

export function clearAllReruns(): void {
  reruns.clear();
}
