export interface TitleChangeEntry {
  title: string;
  updated_at: string;
}

export const titleHistoryStore = new Map<string, TitleChangeEntry[]>();

export function getTitleHistory(streamId: string): TitleChangeEntry[] {
  return titleHistoryStore.get(streamId) || [];
}

export function addTitleChange(streamId: string, title: string): TitleChangeEntry {
  const history = getTitleHistory(streamId);
  const entry: TitleChangeEntry = {
    title,
    updated_at: new Date().toISOString()
  };
  
  history.unshift(entry); // Add to beginning (append-only, newest first)
  
  // Keep only last 10
  if (history.length > 10) {
    history.pop();
  }
  
  titleHistoryStore.set(streamId, history);
  return entry;
}

export function validateTitle(title: string): { valid: boolean; error?: string } {
  if (typeof title !== 'string') {
    return { valid: false, error: 'Title must be a string' };
  }
  
  if (title.length < 1) {
    return { valid: false, error: 'Title must be at least 1 character' };
  }
  
  if (title.length > 100) {
    return { valid: false, error: 'Title must be at most 100 characters' };
  }
  
  return { valid: true };
}
