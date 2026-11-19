import { generateUserDataExport, executeAccountErasure } from '../lib/privacy/gdpr-compliance';
import { validateEmoteEntitlement, resolveChatBadge } from '../lib/subscriptions/subscriber-perks';
import { AccessibleChatAnnouncer } from '../lib/a11y/chat-announcer';
import { WebRtcWhipIngestClient } from '../lib/streaming/webrtc-ingest';

describe('Account 1: GDPR, Perks, A11y, WebRTC Features', () => {
  test('GDPR: exports complete user data when token is valid', async () => {
    const data = await generateUserDataExport('usr_123', 'valid_secure_token_12345');
    expect(data.userId).toBe('usr_123');
    expect(data.profile).toBeDefined();
    expect(data.transactions).toBeDefined();
  });

  test('GDPR: suspends account erasure if active dispute exists', async () => {
    const result = await executeAccountErasure('usr_123', 'valid_secure_token_12345', true);
    expect(result.status).toBe('hold_active_dispute');
  });

  test('Subscriber Perks: allows custom emotes only for active tier subscribers', () => {
    const tier = {
      tierId: 'tier_2',
      tierName: 'Gold',
      badgeUrl: '/badges/gold.svg',
      allowedEmoteCodes: [':sub_hype:', ':sub_gg:'],
      adFreeViewing: true,
      subscriberOnlyChat: true,
    };

    const activeSub = {
      userId: 'usr_1',
      channelId: 'creator_1',
      tierId: 'tier_2',
      status: 'active' as const,
      currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
    };

    const res = validateEmoteEntitlement(':sub_hype:', activeSub, tier);
    expect(res.allowed).toBe(true);

    const badge = resolveChatBadge(activeSub, tier);
    expect(badge?.badgeUrl).toBe('/badges/gold.svg');
  });

  test('A11y: Chat Announcer throttles fast chat storms politely', () => {
    const announcer = new AccessibleChatAnnouncer({ throttleIntervalMs: 100, stormThreshold: 3 });
    const now = Date.now();
    announcer.enqueueMessage({ id: '1', sender: 'Alice', text: 'hi', timestamp: now });
    announcer.enqueueMessage({ id: '2', sender: 'Bob', text: 'hey', timestamp: now });
    const out = announcer.enqueueMessage({ id: '3', sender: 'Charlie', text: 'yo', timestamp: now });
    expect(typeof out).toBe('string');
  });

  test('WebRTC: WHIP client creates valid SDP offer request', () => {
    const client = new WebRtcWhipIngestClient({
      endpointUrl: 'https://global-whip.mux.com/v1/whip/live-stream-id',
      streamKey: 'secret_key',
      enableIceRestart: true,
      maxReconnectAttempts: 3,
    });
    const req = client.createWhipSessionRequest('v=0\r\no=- 123 2 IN IP4 127.0.0.1...');
    expect(req.headers['Content-Type']).toBe('application/sdp');
    expect(client.getMetrics().estimatedLatencyMs).toBeLessThan(1000);
  });
});
