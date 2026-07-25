export interface Appeal {
  id: string;
  creator_id: string;
  viewer_id: string;
  status: 'pending' | 'resolved';
  created_at: string;
  appeal_reason: string;
}

export const seedAppeals: Appeal[] = [
  {
    id: 'appeal_1',
    creator_id: 'creator_001',
    viewer_id: 'viewer_101',
    status: 'pending',
    created_at: '2026-07-10T08:30:00Z',
    appeal_reason: 'I was banned in error, I did not violate any rules',
  },
  {
    id: 'appeal_2',
    creator_id: 'creator_001',
    viewer_id: 'viewer_102',
    status: 'pending',
    created_at: '2026-07-15T14:45:00Z',
    appeal_reason: 'The ban was unfair, I want to appeal it',
  },
  {
    id: 'appeal_3',
    creator_id: 'creator_001',
    viewer_id: 'viewer_103',
    status: 'resolved',
    created_at: '2026-07-01T10:00:00Z',
    appeal_reason: 'I apologize for my behavior',
  },
  {
    id: 'appeal_4',
    creator_id: 'creator_001',
    viewer_id: 'viewer_104',
    status: 'pending',
    created_at: '2026-07-20T12:15:00Z',
    appeal_reason: 'Can you reconsider my ban?',
  },
  {
    id: 'appeal_5',
    creator_id: 'creator_001',
    viewer_id: 'viewer_105',
    status: 'resolved',
    created_at: '2026-06-28T16:30:00Z',
    appeal_reason: 'I understand the rules now',
  },
  {
    id: 'appeal_6',
    creator_id: 'creator_001',
    viewer_id: 'viewer_106',
    status: 'pending',
    created_at: '2026-07-22T09:00:00Z',
    appeal_reason: 'Second chance request',
  },
  {
    id: 'appeal_7',
    creator_id: 'creator_001',
    viewer_id: 'viewer_107',
    status: 'resolved',
    created_at: '2026-07-05T11:20:00Z',
    appeal_reason: 'My account was compromised',
  },
  {
    id: 'appeal_8',
    creator_id: 'creator_001',
    viewer_id: 'viewer_108',
    status: 'pending',
    created_at: '2026-07-19T13:40:00Z',
    appeal_reason: 'I was temporarily upset, it will not happen again',
  },
  {
    id: 'appeal_9',
    creator_id: 'creator_002',
    viewer_id: 'viewer_201',
    status: 'pending',
    created_at: '2026-07-18T15:00:00Z',
    appeal_reason: 'Appeal my ban',
  },
  {
    id: 'appeal_10',
    creator_id: 'creator_002',
    viewer_id: 'viewer_202',
    status: 'resolved',
    created_at: '2026-07-12T10:30:00Z',
    appeal_reason: 'I want to be unbanned',
  },
];
