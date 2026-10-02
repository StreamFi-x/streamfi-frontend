import { getCurrentTimestamp } from '../../helpers/dateUtilities';
import type { ColorBlindPreference } from '../../types';

// In-memory mock storage
let colorBlindPreferences: ColorBlindPreference[] = [];

/**
 * Color Blind Preference Repository
 */
export const colorBlindRepository = {
  /**
   * Find color blind preference by viewer ID
   */
  findByViewerId(viewerId: string): ColorBlindPreference | null {
    return colorBlindPreferences.find(pref => pref.viewer_id === viewerId) || null;
  },

  /**
   * Create or update color blind preference
   */
  save(preference: Omit<ColorBlindPreference, 'updated_at'>): ColorBlindPreference {
    const existingIndex = colorBlindPreferences.findIndex(p => p.viewer_id === preference.viewer_id);
    const updatedPreference: ColorBlindPreference = {
      ...preference,
      updated_at: getCurrentTimestamp(),
    };

    if (existingIndex >= 0) {
      colorBlindPreferences[existingIndex] = updatedPreference;
    } else {
      colorBlindPreferences.push(updatedPreference);
    }

    return updatedPreference;
  },

  /**
   * Delete color blind preference by viewer ID
   */
  deleteByViewerId(viewerId: string): boolean {
    const initialLength = colorBlindPreferences.length;
    colorBlindPreferences = colorBlindPreferences.filter(pref => pref.viewer_id !== viewerId);
    return colorBlindPreferences.length < initialLength;
  },

  /**
   * Get all color blind preferences (for debugging/testing)
   */
  getAll(): ColorBlindPreference[] {
    return [...colorBlindPreferences];
  },

  /**
   * Seed with mock data
   */
  seed(data: ColorBlindPreference[]): void {
    colorBlindPreferences = [...data];
  },

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    colorBlindPreferences = [];
  },
};