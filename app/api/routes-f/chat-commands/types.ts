export interface ChatCommand {
  id: string;
  trigger: string; // e.g. "!discord"
  response_template: string; // e.g. "Join our Discord at {{url}}"
  cooldown_seconds: number;
  enabled: boolean;
}

export interface ExecuteCommandRequest {
  creator_id: string;
  trigger: string;
  context?: Record<string, string>; // template variable values
}

export interface ExecuteCommandResponse {
  response: string;
  trigger: string;
  cooldown_seconds: number;
}
