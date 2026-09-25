import type { GoalRateRequest, CSVImportRequest, LogModerationRequest, GetModerationLogsRequest, BanExportRequest } from '../types';

export function validateGoalRateRequest(params: Record<string, string>): { 
  valid: boolean; 
  errors: Array<{ field: string; message: string }>; 
  data?: GoalRateRequest 
} {
  const errors: Array<{ field: string; message: string }> = [];
  const { creator_id, last_n_goals } = params;

  if (!creator_id?.trim()) {
    errors.push({ field: 'creator_id', message: 'creator_id is required' });
  }

  if (last_n_goals) {
    const parsed = parseInt(last_n_goals, 10);
    if (isNaN(parsed) || parsed < 1) {
      errors.push({ field: 'last_n_goals', message: 'last_n_goals must be a positive integer' });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      creator_id: creator_id!.trim(),
      last_n_goals: last_n_goals ? parseInt(last_n_goals, 10) : undefined,
    },
  };
}

export function validateCSVImportRequest(body: unknown): {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
  data?: CSVImportRequest;
} {
  const errors: Array<{ field: string; message: string }> = [];

  if (!body || typeof body !== 'object') {
    errors.push({ field: 'body', message: 'Request body is required' });
    return { valid: false, errors };
  }

  const { creator_id, csv } = body as Record<string, unknown>;

  if (!creator_id || typeof creator_id !== 'string' || !creator_id.trim()) {
    errors.push({ field: 'creator_id', message: 'creator_id is required' });
  }

  if (!csv || typeof csv !== 'string' || !csv.trim()) {
    errors.push({ field: 'csv', message: 'csv is required' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      creator_id: (creator_id as string).trim(),
      csv: (csv as string).trim(),
    },
  };
}

export function validateLogModerationRequest(body: unknown): {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
  data?: LogModerationRequest;
} {
  const errors: Array<{ field: string; message: string }> = [];

  if (!body || typeof body !== 'object') {
    errors.push({ field: 'body', message: 'Request body is required' });
    return { valid: false, errors };
  }

  const { creator_id, mod_id, action, target_id, reason } = body as Record<string, unknown>;
  const validActions = ['BAN', 'UNBAN', 'TIMEOUT', 'WARNING', 'DELETE_MESSAGE'];

  if (!creator_id || typeof creator_id !== 'string' || !creator_id.trim()) {
    errors.push({ field: 'creator_id', message: 'creator_id is required' });
  }

  if (!mod_id || typeof mod_id !== 'string' || !mod_id.trim()) {
    errors.push({ field: 'mod_id', message: 'mod_id is required' });
  }

  if (!action || typeof action !== 'string' || !validActions.includes(action)) {
    errors.push({ field: 'action', message: `action must be one of: ${validActions.join(', ')}` });
  }

  if (!target_id || typeof target_id !== 'string' || !target_id.trim()) {
    errors.push({ field: 'target_id', message: 'target_id is required' });
  }

  if (reason && typeof reason !== 'string') {
    errors.push({ field: 'reason', message: 'reason must be a string if provided' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      creator_id: (creator_id as string).trim(),
      mod_id: (mod_id as string).trim(),
      action: action as any,
      target_id: (target_id as string).trim(),
      reason: reason as string | undefined,
    },
  };
}

export function validateGetModerationLogsRequest(params: Record<string, string>): {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
  data?: GetModerationLogsRequest;
} {
  const errors: Array<{ field: string; message: string }> = [];
  const { creator_id, mod_id } = params;

  if (!creator_id?.trim()) {
    errors.push({ field: 'creator_id', message: 'creator_id is required' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      creator_id: creator_id!.trim(),
      mod_id: mod_id?.trim(),
    },
  };
}

export function validateBanExportRequest(params: Record<string, string>): {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
  data?: BanExportRequest;
} {
  const errors: Array<{ field: string; message: string }> = [];
  const { creator_id } = params;

  if (!creator_id?.trim()) {
    errors.push({ field: 'creator_id', message: 'creator_id is required' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      creator_id: creator_id!.trim(),
    },
  };
}