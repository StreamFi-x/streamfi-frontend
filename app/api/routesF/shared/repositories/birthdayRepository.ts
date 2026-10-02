import { getCurrentTimestamp } from '../../helpers/dateUtilities';
import type { BirthdayConfig } from '../../types';

// In-memory mock storage
let birthdayConfigs: BirthdayConfig[] = [];

/**
 * Birthday Configuration Repository
 */
export const birthdayRepository = {
  /**
   * Find birthday configuration by viewer ID
   */
  findByViewerId(viewerId: string): BirthdayConfig | null {
    return birthdayConfigs.find(config => config.viewer_id === viewerId) || null;
  },

  /**
   * Create or update birthday configuration
   */
  save(config: Omit<BirthdayConfig, 'updated_at'>): BirthdayConfig {
    const existingIndex = birthdayConfigs.findIndex(c => c.viewer_id === config.viewer_id);
    const updatedConfig: BirthdayConfig = {
      ...config,
      updated_at: getCurrentTimestamp(),
    };

    if (existingIndex >= 0) {
      birthdayConfigs[existingIndex] = updatedConfig;
    } else {
      birthdayConfigs.push(updatedConfig);
    }

    return updatedConfig;
  },

  /**
   * Delete birthday configuration by viewer ID
   */
  deleteByViewerId(viewerId: string): boolean {
    const initialLength = birthdayConfigs.length;
    birthdayConfigs = birthdayConfigs.filter(config => config.viewer_id !== viewerId);
    return birthdayConfigs.length < initialLength;
  },

  /**
   * Get all birthday configurations (for debugging/testing)
   */
  getAll(): BirthdayConfig[] {
    return [...birthdayConfigs];
  },

  /**
   * Seed with mock data
   */
  seed(data: BirthdayConfig[]): void {
    birthdayConfigs = [...data];
  },

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    birthdayConfigs = [];
  },
};