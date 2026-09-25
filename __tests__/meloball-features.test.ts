import { triageBugReport, classifySeverity } from '../lib/triage/bug-report-triage';
import { screenStreamMetadata, normalizeText } from '../lib/moderation/stream-metadata-screening';
import { computeTopTippers, detectTipCollusion } from '../lib/leaderboards/leaderboard-engine';
import { CoStreamSquadManager } from '../lib/streaming/costream-squad';

describe('Account 2: Bug Triage, Metadata Screening, Leaderboards, Co-Streaming', () => {
  test('Triage: routes wallet and transaction bugs to critical with 2h SLA', () => {
    const report = {
      id: 'bug_1',
      title: 'Wallet payout failed with 500',
      description: 'Attempted to tip creator and funds were locked',
      route: '/api/wallet/payout',
      reportedAt: Date.now(),
    };
    const triage = triageBugReport(report);
    expect(triage.severity).toBe('critical');
    expect(triage.slaTargetHours).toBe(2);
    expect(triage.routedToTeam).toBe('on-call-security-payments');
  });

  test('Screening: detects crypto doubling scams and evasive Unicode', () => {
    const title = 'D0UBLE Y0UR XLM N0W! FREE AIRDR0P';
    const desc = 'Visit free-xlm-airdrop.xyz to claim free coins';
    const result = screenStreamMetadata(title, desc);
    expect(result.decision).toBe('flagged_for_review');
    expect(result.matchedPatterns.length).toBeGreaterThan(0);
  });

  test('Leaderboards: excludes wash-trading circular self-tipping', () => {
    const now = Date.now();
    const tips = [
      { id: '1', senderId: 'userA', recipientId: 'userB', amountXlm: 100, timestamp: now },
      { id: '2', senderId: 'userB', recipientId: 'userA', amountXlm: 95, timestamp: now },
      { id: '3', senderId: 'honestUser', recipientId: 'creatorX', amountXlm: 50, timestamp: now },
    ];
    const colluders = detectTipCollusion(tips);
    expect(colluders.has('userA')).toBe(true);
    expect(colluders.has('userB')).toBe(true);

    const board = computeTopTippers(tips, 86400000);
    expect(board.find((e) => e.userId === 'userA')).toBeUndefined();
    expect(board[0]?.userId).toBe('honestUser');
  });

  test('Co-Stream: manages squad members and enforces 4-streamer cap', () => {
    const squad = new CoStreamSquadManager('squad_1', 'host_1', 'HostChannel', 'play_1');
    squad.addMember({ userId: 'guest_1', channelName: 'Guest1', playbackId: 'play_2' });
    squad.addMember({ userId: 'guest_2', channelName: 'Guest2', playbackId: 'play_3' });
    squad.addMember({ userId: 'guest_3', channelName: 'Guest3', playbackId: 'play_4' });

    expect(squad.getSquadState().members.length).toBe(4);
    expect(() =>
      squad.addMember({ userId: 'guest_4', channelName: 'Guest4', playbackId: 'play_5' })
    ).toThrow('Squad capacity reached');
  });
});
