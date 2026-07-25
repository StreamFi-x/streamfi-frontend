import { ContentWarningConfig, WarningSeverity, COMMON_WARNING_IDS } from './types';

// In-memory store for content warning configs
// Key: creator_id, Value: ContentWarningConfig
const WARNING_CONFIG_STORE = new Map<string, ContentWarningConfig>();

export function getWarningConfig(creatorId: string): ContentWarningConfig | null {
  return WARNING_CONFIG_STORE.get(creatorId) || null;
}

export function setWarningConfig(
  creatorId: string,
  warnings: string[],
  severity: WarningSeverity
): { success: boolean; config: ContentWarningConfig; errors?: string[] } {
  const errors: string[] = [];

  // Validate warnings
  const validWarnings: string[] = [];
  for (const warning of warnings) {
    if (COMMON_WARNING_IDS.includes(warning)) {
      validWarnings.push(warning);
    } else {
      errors.push(`Unknown warning type: ${warning}`);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const config: ContentWarningConfig = {
    creator_id: creatorId,
    warnings: validWarnings,
    severity,
    created_at: WARNING_CONFIG_STORE.has(creatorId)
      ? (WARNING_CONFIG_STORE.get(creatorId)!.created_at)
      : now,
    updated_at: now,
  };

  WARNING_CONFIG_STORE.set(creatorId, config);

  return {
    success: errors.length === 0,
    config,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// For testing: clear all configs
export function clearAllConfigs(): void {
  WARNING_CONFIG_STORE.clear();
}

// For testing: get all configs
export function getAllConfigs(): Map<string, ContentWarningConfig> {
  return new Map(WARNING_CONFIG_STORE);
}
