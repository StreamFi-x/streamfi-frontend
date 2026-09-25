export interface ReferralViewer {
  id: string;
  stream_id: string;
  referrer: string | null;
  source: 'direct' | 'social' | 'embed' | 'search' | 'other';
}

export const seedReferralViewers: ReferralViewer[] = [
  {
    id: 'viewer_1',
    stream_id: 'stream_001',
    referrer: null,
    source: 'direct',
  },
  {
    id: 'viewer_2',
    stream_id: 'stream_001',
    referrer: 'twitter.com',
    source: 'social',
  },
  {
    id: 'viewer_3',
    stream_id: 'stream_001',
    referrer: 'embed.streamfi.io',
    source: 'embed',
  },
  {
    id: 'viewer_4',
    stream_id: 'stream_001',
    referrer: 'google.com',
    source: 'search',
  },
  {
    id: 'viewer_5',
    stream_id: 'stream_001',
    referrer: null,
    source: 'direct',
  },
  {
    id: 'viewer_6',
    stream_id: 'stream_001',
    referrer: 'instagram.com',
    source: 'social',
  },
  {
    id: 'viewer_7',
    stream_id: 'stream_001',
    referrer: 'reddit.com',
    source: 'social',
  },
  {
    id: 'viewer_8',
    stream_id: 'stream_001',
    referrer: 'duckduckgo.com',
    source: 'search',
  },
  {
    id: 'viewer_9',
    stream_id: 'stream_001',
    referrer: 'discord.com',
    source: 'social',
  },
  {
    id: 'viewer_10',
    stream_id: 'stream_001',
    referrer: 'custom.embed.site',
    source: 'embed',
  },
];

export function classifySource(referrer: string | null): 'direct' | 'social' | 'embed' | 'search' | 'other' {
  if (!referrer) {return 'direct';}

  const referrerLower = referrer.toLowerCase();

  if (
    referrerLower.includes('facebook') ||
    referrerLower.includes('twitter') ||
    referrerLower.includes('instagram') ||
    referrerLower.includes('tiktok') ||
    referrerLower.includes('reddit') ||
    referrerLower.includes('linkedin') ||
    referrerLower.includes('discord') ||
    referrerLower.includes('telegram') ||
    referrerLower.includes('youtube')
  ) {
    return 'social';
  }

  if (
    referrerLower.includes('google') ||
    referrerLower.includes('bing') ||
    referrerLower.includes('duckduckgo') ||
    referrerLower.includes('yahoo') ||
    referrerLower.includes('baidu') ||
    referrerLower.includes('yandex')
  ) {
    return 'search';
  }

  if (referrerLower.includes('embed')) {
    return 'embed';
  }

  return 'other';
}
