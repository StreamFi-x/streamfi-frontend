import type { GoalHistory, BanRecord, ModerationLog } from '../types';
import { generateId } from './utils';

const MAX_MODERATION_LOGS_PER_CREATOR = 5000;

// In-memory mock database
let goalHistory: GoalHistory[] = [];
let banRecords: BanRecord[] = [];
let moderationLogs: ModerationLog[] = [];

// Goal History Repository
export const goalHistoryRepository = {
  getAll(): GoalHistory[] {
    return [...goalHistory];
  },

  getByCreatorId(creatorId: string): GoalHistory[] {
    return goalHistory.filter(goal => goal.creator_id === creatorId);
  },

  seed(data: GoalHistory[]): void {
    goalHistory = [...data];
  },

  clear(): void {
    goalHistory = [];
  },
};

// Ban Records Repository
export const banRecordsRepository = {
  getAll(): BanRecord[] {
    return [...banRecords];
  },

  getByCreatorId(creatorId: string): BanRecord[] {
    return banRecords.filter(ban => ban.creator_id === creatorId);
  },

  add(creatorId: string, viewerId: string, reason: string): BanRecord {
    const now = new Date().toISOString();
    const newBan: BanRecord = {
      id: generateId('ban'),
      creator_id: creatorId,
      viewer_id: viewerId,
      reason,
      banned_at: now,
    };

    banRecords.push(newBan);
    return newBan;
  },

  addMany(bans: Omit<BanRecord, 'id' | 'banned_at'>[]): BanRecord[] {
    const now = new Date().toISOString();
    const newBans: BanRecord[] = bans.map(ban => ({
      id: generateId('ban'),
      creator_id: ban.creator_id,
      viewer_id: ban.viewer_id,
      reason: ban.reason,
      banned_at: now,
    }));

    banRecords.push(...newBans);
    return newBans;
  },

  seed(data: BanRecord[]): void {
    banRecords = [...data];
  },

  clear(): void {
    banRecords = [];
  },
};

// Moderation Logs Repository
export const moderationLogsRepository = {
  getAll(): ModerationLog[] {
    return [...moderationLogs];
  },

  getByCreatorId(creatorId: string): ModerationLog[] {
    return moderationLogs.filter(log => log.creator_id === creatorId);
  },

  getByCreatorIdAndModId(creatorId: string, modId?: string): ModerationLog[] {
    let logs = moderationLogs.filter(log => log.creator_id === creatorId);
    
    if (modId) {
      logs = logs.filter(log => log.mod_id === modId);
    }

    return logs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  add(log: Omit<ModerationLog, 'id' | 'timestamp'>): ModerationLog {
    const now = new Date().toISOString();
    const newLog: ModerationLog = {
      id: generateId('log'),
      ...log,
      timestamp: now,
    };

    // Enforce FIFO cap for this creator
    const creatorLogs = moderationLogs.filter(l => l.creator_id === log.creator_id);
    
    if (creatorLogs.length >= MAX_MODERATION_LOGS_PER_CREATOR) {
      // Remove oldest log for this creator
      const oldestLogIndex = moderationLogs.findIndex(l => 
        l.creator_id === log.creator_id
      );
      if (oldestLogIndex !== -1) {
        moderationLogs.splice(oldestLogIndex, 1);
      }
    }

    moderationLogs.push(newLog);
    return newLog;
  },

  seed(data: ModerationLog[]): void {
    moderationLogs = [...data];
  },

  clear(): void {
    moderationLogs = [];
  },
};