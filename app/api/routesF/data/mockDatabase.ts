import { seedGoals } from './seedGoals';
import { seedBans } from './seedBans';
import { seedModerationLogs } from './seedModerationLogs';
import { goalHistoryRepository, banRecordsRepository, moderationLogsRepository } from '../helpers/repositories';

export function initializeMockDatabase(): void {
  // Clear existing data
  goalHistoryRepository.clear();
  banRecordsRepository.clear();
  moderationLogsRepository.clear();

  // Seed with mock data
  goalHistoryRepository.seed(seedGoals);
  banRecordsRepository.seed(seedBans);
  moderationLogsRepository.seed(seedModerationLogs);
}

// Initialize on module load
initializeMockDatabase();