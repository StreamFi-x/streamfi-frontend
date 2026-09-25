import { I18nManager } from '../lib/i18n/translator';
import { MobileBroadcasterSession } from '../lib/streaming/mobile-broadcaster';
import { generateTaxSummary, exportTaxSummaryToCsv } from '../lib/tax/tax-reporting-export';
import { evaluateCreatorTrust } from '../lib/reputation/trust-score-engine';

describe('Account 3: i18n, Mobile Broadcast, Tax Export, Trust Score', () => {
  test('i18n: translates keys with interpolation and pluralization across EN and ES', () => {
    const i18n = new I18nManager();
    expect(i18n.t('common.welcome')).toBe('Welcome to StreamFi');
    expect(i18n.t('common.viewers', { count: 5 })).toBe('5 viewers');

    i18n.setLocale('es');
    expect(i18n.t('common.welcome')).toBe('Bienvenido a StreamFi');
    expect(i18n.t('common.viewers', { count: 5 })).toBe('5 espectadores');
    expect(i18n.t('tipping.tipSuccess', { amount: '100', creator: 'StellarKing' })).toBe(
      '¡Se enviaron con éxito 100 XLM a StellarKing!'
    );
  });

  test('Mobile Broadcaster: generates valid portrait media constraints and handles pause', () => {
    const session = new MobileBroadcasterSession({ facingMode: 'user', orientation: 'portrait' });
    const constraints = session.getMediaConstraints();
    expect(constraints.audio).toBeDefined();
    expect((constraints.video as MediaTrackConstraints).facingMode).toBe('user');

    session.handleVisibilityChange(true);
    expect(session.getState()).toBe('idle');
  });

  test('Tax Export: calculates gross, fees, and net USD with CSV generation', () => {
    const earnings = [
      {
        id: 'tx_1',
        type: 'tip' as const,
        amountXlm: 100,
        xlmUsdRateAtReceipt: 0.12,
        grossAmountUsd: 12.0,
        platformFeeUsd: 0.6,
        netAmountUsd: 11.4,
        timestamp: '2026-04-10T12:00:00Z',
        txHash: 'abc123hash',
      },
    ];

    const summary = generateTaxSummary('creator_123', 2026, earnings);
    expect(summary.totalGrossEarningsUsd).toBe(12.0);
    expect(summary.totalNetEarningsUsd).toBe(11.4);

    const csv = exportTaxSummaryToCsv(summary);
    expect(csv).toContain('Transaction ID,Type,Timestamp');
    expect(csv).toContain('abc123hash');
  });

  test('Trust Score: flags accounts with high moderation strikes', () => {
    const profile = {
      creatorId: 'c1',
      accountAgeDays: 120,
      totalTipsCompleted: 50,
      totalTipsVolumeXlm: 2500,
      moderationStrikes: 3,
      disputedTipsCount: 1,
      isKycVerified: false,
    };
    const trust = evaluateCreatorTrust(profile);
    expect(trust.tier).toBe('Under Review');
    expect(trust.score).toBeLessThan(40);
  });
});
