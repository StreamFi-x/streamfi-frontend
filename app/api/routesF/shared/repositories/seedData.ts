import type { 
  BirthdayConfig, 
  FollowRelationship, 
  VerificationRequest, 
  ColorBlindPreference 
} from '../../types';

// Generate viewer IDs
const VIEWER_IDS = [
  'vwr_gaming_fan_001',
  'vwr_music_lover_002', 
  'vwr_art_enthusiast_003',
  'vwr_sports_fanatic_004',
  'vwr_tech_geek_005',
  'vwr_foodie_006',
  'vwr_travel_bug_007',
  'vwr_fitness_buff_008',
  'vwr_book_worm_009',
  'vwr_movie_critic_010',
];

// Generate creator IDs
const CREATOR_IDS = [
  'crt_gaming_pro_101',
  'crt_music_maestro_102',
  'crt_art_legend_103',
  'crt_sports_star_104',
  'crt_tech_guru_105',
];

// Mock birthday configurations
export const seedBirthdayConfigs: BirthdayConfig[] = [
  {
    viewer_id: VIEWER_IDS[0],
    birthday_iso: '1995-03-15',
    share_with_creators: true,
    updated_at: '2024-01-15T10:30:00Z',
  },
  {
    viewer_id: VIEWER_IDS[1],
    birthday_iso: '1998-07-22',
    share_with_creators: false,
    updated_at: '2024-02-10T14:45:00Z',
  },
  {
    viewer_id: VIEWER_IDS[2],
    birthday_iso: '2000-11-05',
    share_with_creators: true,
    updated_at: '2024-03-05T09:20:00Z',
  },
  {
    viewer_id: VIEWER_IDS[3],
    birthday_iso: '1993-01-30',
    share_with_creators: true,
    updated_at: '2024-01-22T16:10:00Z',
  },
  {
    viewer_id: VIEWER_IDS[4],
    birthday_iso: null,
    share_with_creators: false,
    updated_at: '2024-02-28T11:55:00Z',
  },
];

// Mock follow relationships
export const seedFollowRelationships: FollowRelationship[] = [
  // Viewer 1 follows multiple creators
  {
    id: 'flw_001',
    viewer_id: VIEWER_IDS[0],
    creator_id: CREATOR_IDS[0],
    followed_at: '2023-01-15T10:30:00Z',
  },
  {
    id: 'flw_002',
    viewer_id: VIEWER_IDS[0],
    creator_id: CREATOR_IDS[1],
    followed_at: '2023-06-20T14:45:00Z',
  },
  {
    id: 'flw_003',
    viewer_id: VIEWER_IDS[0],
    creator_id: CREATOR_IDS[2],
    followed_at: '2024-01-10T09:20:00Z',
  },
  // Viewer 2 follows creators
  {
    id: 'flw_004',
    viewer_id: VIEWER_IDS[1],
    creator_id: CREATOR_IDS[0],
    followed_at: '2023-03-22T16:10:00Z',
  },
  {
    id: 'flw_005',
    viewer_id: VIEWER_IDS[1],
    creator_id: CREATOR_IDS[3],
    followed_at: '2023-11-05T11:55:00Z',
  },
  // Viewer 3 follows one creator
  {
    id: 'flw_006',
    viewer_id: VIEWER_IDS[2],
    creator_id: CREATOR_IDS[4],
    followed_at: '2024-02-01T13:30:00Z',
  },
  // Viewer 4 follows multiple creators
  {
    id: 'flw_007',
    viewer_id: VIEWER_IDS[3],
    creator_id: CREATOR_IDS[0],
    followed_at: '2022-05-15T08:45:00Z',
  },
  {
    id: 'flw_008',
    viewer_id: VIEWER_IDS[3],
    creator_id: CREATOR_IDS[1],
    followed_at: '2023-02-28T15:20:00Z',
  },
  {
    id: 'flw_009',
    viewer_id: VIEWER_IDS[3],
    creator_id: CREATOR_IDS[2],
    followed_at: '2023-09-10T12:05:00Z',
  },
  {
    id: 'flw_010',
    viewer_id: VIEWER_IDS[3],
    creator_id: CREATOR_IDS[3],
    followed_at: '2024-01-05T10:50:00Z',
  },
];

// Mock verification requests
export const seedVerificationRequests: VerificationRequest[] = [
  {
    request_id: 'ver_001',
    creator_id: CREATOR_IDS[0],
    method: 'social',
    proof_links: [
      'https://twitter.com/gaming_pro',
      'https://instagram.com/gaming_pro',
    ],
    status: 'approved',
    submitted_at: '2024-01-10T10:30:00Z',
    reviewed_at: '2024-01-12T14:45:00Z',
  },
  {
    request_id: 'ver_002',
    creator_id: CREATOR_IDS[1],
    method: 'id',
    proof_links: [
      'https://drive.google.com/file/id_proof',
    ],
    status: 'pending',
    submitted_at: '2024-02-15T09:20:00Z',
  },
  {
    request_id: 'ver_003',
    creator_id: CREATOR_IDS[2],
    method: 'kyc',
    proof_links: [
      'https://secure.kycprovider.com/verification/12345',
    ],
    status: 'rejected',
    submitted_at: '2024-01-28T16:10:00Z',
    reviewed_at: '2024-01-30T11:55:00Z',
  },
  {
    request_id: 'ver_004',
    creator_id: CREATOR_IDS[3],
    method: 'social',
    proof_links: [
      'https://facebook.com/sports_star',
      'https://twitter.com/sports_star',
      'https://youtube.com/sports_star_channel',
    ],
    status: 'pending',
    submitted_at: '2024-03-01T13:30:00Z',
  },
];

// Mock color blind preferences
export const seedColorBlindPreferences: ColorBlindPreference[] = [
  {
    viewer_id: VIEWER_IDS[0],
    mode: 'protanopia',
    updated_at: '2024-01-20T10:30:00Z',
  },
  {
    viewer_id: VIEWER_IDS[1],
    mode: 'deuteranopia',
    updated_at: '2024-02-05T14:45:00Z',
  },
  {
    viewer_id: VIEWER_IDS[2],
    mode: 'none',
    updated_at: '2024-01-15T09:20:00Z',
  },
  {
    viewer_id: VIEWER_IDS[3],
    mode: 'tritanopia',
    updated_at: '2024-02-28T16:10:00Z',
  },
  {
    viewer_id: VIEWER_IDS[4],
    mode: 'none',
    updated_at: '2024-03-10T11:55:00Z',
  },
  {
    viewer_id: VIEWER_IDS[5],
    mode: 'protanopia',
    updated_at: '2024-02-15T13:30:00Z',
  },
];

/**
 * Initialize all repositories with seed data
 */
export function initializeRepositories(): void {
  // Import repositories
  const { birthdayRepository } = require('./birthdayRepository');
  const { followRepository } = require('./followRepository');
  const { verificationRepository } = require('./verificationRepository');
  const { colorBlindRepository } = require('./colorBlindRepository');

  // Clear existing data
  birthdayRepository.clear();
  followRepository.clear();
  verificationRepository.clear();
  colorBlindRepository.clear();

  // Seed with mock data
  birthdayRepository.seed(seedBirthdayConfigs);
  followRepository.seed(seedFollowRelationships);
  verificationRepository.seed(seedVerificationRequests);
  colorBlindRepository.seed(seedColorBlindPreferences);
}