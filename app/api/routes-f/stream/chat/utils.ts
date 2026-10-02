export interface ChatRestrictionData {
  enabled: boolean;
  min_follow_minutes: number;
}

export const chatRestrictionStore = new Map<string, ChatRestrictionData>();

export function getChatRestriction(streamId: string): ChatRestrictionData | undefined {
  return chatRestrictionStore.get(streamId);
}

export function setChatRestriction(streamId: string, minFollowMinutes: number = 10): ChatRestrictionData {
  const data: ChatRestrictionData = {
    enabled: true,
    min_follow_minutes: minFollowMinutes
  };
  chatRestrictionStore.set(streamId, data);
  return data;
}

export function disableChatRestriction(streamId: string): void {
  chatRestrictionStore.delete(streamId);
}

export function validateMinFollowMinutes(minutes: number): { valid: boolean; error?: string } {
  if (typeof minutes !== 'number' || isNaN(minutes)) {
    return { valid: false, error: 'min_follow_minutes must be a number' };
  }
  
  if (minutes < 1) {
    return { valid: false, error: 'min_follow_minutes must be at least 1 minute' };
  }
  
  if (minutes > 10080) { // 1 week in minutes
    return { valid: false, error: 'min_follow_minutes must be at most 10080 minutes (1 week)' };
  }
  
  if (!Number.isInteger(minutes)) {
    return { valid: false, error: 'min_follow_minutes must be an integer' };
  }
  
  return { valid: true };
}
