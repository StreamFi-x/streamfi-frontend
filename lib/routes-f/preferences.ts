export const ROUTES_F_PREFERENCES_DEFAULTS = {
  showExperimental: false,
  enableNotifications: true,
  autoValidate: true,
  compactMode: false,
} as const;

export type RoutesFPreferences = {
  showExperimental: boolean;
  enableNotifications: boolean;
  autoValidate: boolean;
  compactMode: boolean;
};

const PREFERENCE_KEYS = new Set(Object.keys(ROUTES_F_PREFERENCES_DEFAULTS));

export function validatePreferences(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { isValid: false, error: "Preferences payload must be an object" };
  }

  const entries = Object.entries(payload as Record<string, unknown>);
  for (const [key, value] of entries) {
    if (!PREFERENCE_KEYS.has(key)) {
      return { isValid: false, error: `Unsupported preference key: ${key}` };
    }
    if (typeof value !== "boolean") {
      return {
        isValid: false,
        error: `Preference '${key}' must be a boolean`,
      };
    }
  }

  return { isValid: true, error: null } as const;
}

export function mergePreferences(update: Partial<RoutesFPreferences>) {
  return {
    ...ROUTES_F_PREFERENCES_DEFAULTS,
    ...update,
  } satisfies RoutesFPreferences;
}
