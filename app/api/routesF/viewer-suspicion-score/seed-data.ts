export interface ViewerSignals {
  viewer_id: string;
  account_age_days: number;
  chat_messages_count: number;
  caps_ratio: number;
  link_spam_count: number;
  duplicate_message_ratio: number;
  reports_count: number;
  prior_ban: boolean;
}

export const viewerSignals: Record<string, ViewerSignals> = {
  viewer_001: {
    viewer_id: 'viewer_001',
    account_age_days: 900,
    chat_messages_count: 4200,
    caps_ratio: 0.05,
    link_spam_count: 0,
    duplicate_message_ratio: 0.02,
    reports_count: 0,
    prior_ban: false,
  },
  viewer_002: {
    viewer_id: 'viewer_002',
    account_age_days: 1,
    chat_messages_count: 0,
    caps_ratio: 0,
    link_spam_count: 0,
    duplicate_message_ratio: 0,
    reports_count: 0,
    prior_ban: false,
  },
  viewer_003: {
    viewer_id: 'viewer_003',
    account_age_days: 2,
    chat_messages_count: 40,
    caps_ratio: 0.85,
    link_spam_count: 6,
    duplicate_message_ratio: 0.7,
    reports_count: 5,
    prior_ban: false,
  },
  viewer_004: {
    viewer_id: 'viewer_004',
    account_age_days: 365,
    chat_messages_count: 800,
    caps_ratio: 0.1,
    link_spam_count: 0,
    duplicate_message_ratio: 0.05,
    reports_count: 2,
    prior_ban: false,
  },
  viewer_005: {
    viewer_id: 'viewer_005',
    account_age_days: 40,
    chat_messages_count: 150,
    caps_ratio: 0.3,
    link_spam_count: 1,
    duplicate_message_ratio: 0.15,
    reports_count: 1,
    prior_ban: true,
  },
};
