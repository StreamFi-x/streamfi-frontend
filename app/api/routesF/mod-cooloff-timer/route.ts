/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { isActionAllowed, recordModAction } from './helpers';
import { ModAction, ModCooloffCheckRequest, ModCooloffCheckResponse, ModCooloffRecordRequest, ModCooloffRecordResponse } from './types';

const VALID_ACTIONS = new Set<ModAction>(['ban', 'timeout', 'warn', 'mute']);

function isValidModAction(action: unknown): action is ModAction {
  return VALID_ACTIONS.has(action as ModAction);
}

export async function POST(request: Request): Promise<
  NextResponse<ModCooloffCheckResponse | ModCooloffRecordResponse | { error: string }>
> {
  try {
    const body = await request.json();
    const { mod_id, action, endpoint } = body;

    if (!mod_id || typeof mod_id !== 'string' || mod_id.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid mod_id' }, { status: 400 });
    }

    if (!action || !isValidModAction(action)) {
      return NextResponse.json({ error: 'Missing or invalid action (must be: ban, timeout, warn, mute)' }, { status: 400 });
    }

    // Determine if this is a check or record request
    // Priority: explicit endpoint param, then infer from body keys
    const requestType = endpoint || (body.last_action_timestamp !== undefined ? 'record' : 'check');

    if (requestType === 'check') {
      const { allowed, secondsRemaining } = isActionAllowed(mod_id, action);
      const response: ModCooloffCheckResponse = { allowed };
      if (secondsRemaining > 0) {
        response.seconds_remaining = secondsRemaining;
      }
      return NextResponse.json(response);
    } else if (requestType === 'record') {
      const timestamp = recordModAction(mod_id, action);
      const response: ModCooloffRecordResponse = {
        success: true,
        timestamp,
      };
      return NextResponse.json(response);
    } else {
      return NextResponse.json({ error: 'Invalid endpoint parameter' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body or processing error' }, { status: 400 });
  }
}
