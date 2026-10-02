export type WarningSeverity = 'mild' | 'moderate' | 'severe';

export interface ContentWarningConfig {
  creator_id: string;
  warnings: string[];
  severity: WarningSeverity;
  created_at: number;
  updated_at: number;
}

export interface ContentWarningGetRequest {
  creator_id: string;
}

export interface ContentWarningGetResponse {
  warnings: string[];
  severity: WarningSeverity;
}

export interface ContentWarningSetRequest {
  creator_id: string;
  warnings: string[];
  severity: WarningSeverity;
}

export interface ContentWarningSetResponse {
  success: boolean;
  warnings: string[];
  severity: WarningSeverity;
  updated_at: number;
}

// Common warning options
export const COMMON_WARNINGS = {
  audio: {
    id: 'loud_audio',
    label: 'Loud Audio',
  },
  flashing: {
    id: 'flashing_lights',
    label: 'Flashing Lights',
  },
  violence: {
    id: 'violence',
    label: 'Violence',
  },
  mature: {
    id: 'mature_content',
    label: 'Mature Content',
  },
  gore: {
    id: 'gore',
    label: 'Gore',
  },
  profanity: {
    id: 'strong_profanity',
    label: 'Strong Profanity',
  },
  jumpscares: {
    id: 'jumpscares',
    label: 'Jumpscares',
  },
  sexual: {
    id: 'sexual_content',
    label: 'Sexual Content',
  },
};

export const COMMON_WARNING_IDS = Object.values(COMMON_WARNINGS).map((w) => w.id);
