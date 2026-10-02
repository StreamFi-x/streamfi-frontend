export interface IntermissionData {
  active: boolean;
  message: string;
  ends_at?: string;
}

export const intermissionStore = new Map<string, IntermissionData>();

export function getIntermission(streamId: string): IntermissionData | undefined {
  return intermissionStore.get(streamId);
}

export function setIntermission(streamId: string, message: string, endsAt?: string): IntermissionData {
  const data: IntermissionData = {
    active: true,
    message,
    ends_at: endsAt
  };
  intermissionStore.set(streamId, data);
  return data;
}

export function clearIntermission(streamId: string): void {
  intermissionStore.delete(streamId);
}

export function getSecondsRemaining(endsAt: string): number {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const remaining = Math.ceil((end - now) / 1000);
  return Math.max(0, remaining);
}
