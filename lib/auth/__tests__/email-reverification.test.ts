import { EmailVerificationState, EmailChangeStatus, EmailAccountSnapshot, EmailChangeEvent, deriveEmailVerificationState, canRollbackEmailChange, transitionEmailVerification } from '../../auth/email-reverification';

describe('Email Re‑verification State Machine', () => {
  const baseSnapshot: EmailAccountSnapshot = {
    email: 'old@example.com',
    emailVerified: true,
    pendingEmail: null,
    pendingEmailRequestedAt: null,
    emailChangeStatus: 'none',
    emailChangeFailureReason: null,
    previousVerifiedEmail: null,
  };

  test('derive state from snapshot', () => {
    expect(deriveEmailVerificationState({ ...baseSnapshot, emailVerified: false })).toBe('unverified');
    expect(deriveEmailVerificationState({ ...baseSnapshot, emailChangeStatus: 'none' })).toBe('verified');
    expect(
      deriveEmailVerificationState({ ...baseSnapshot, emailChangeStatus: 'pending' as EmailChangeStatus })
    ).toBe('pending_reverification');
    expect(
      deriveEmailVerificationState({ ...baseSnapshot, emailChangeStatus: 'failed' as EmailChangeStatus })
    ).toBe('change_failed');
  });

  test('valid transition: verified -> pending_reverification via REQUEST_CHANGE', () => {
    const event: EmailChangeEvent = { type: 'REQUEST_CHANGE', newEmail: 'new@example.com' };
    const result = transitionEmailVerification(baseSnapshot, event);
    expect(result.newState).toBe('pending_reverification');
    expect(result.snapshot.pendingEmail).toBe('new@example.com');
    expect(result.snapshot.emailChangeStatus).toBe('pending');
    expect(result.snapshot.previousVerifiedEmail).toBe('old@example.com');
    expect(result.snapshot.emailVerified).toBe(true);
    expect(canRollbackEmailChange(result.snapshot)).toBe(true);
  });

  test('reject REQUEST_CHANGE with same email', () => {
    const event: EmailChangeEvent = { type: 'REQUEST_CHANGE', newEmail: 'old@example.com' };
    expect(() => transitionEmailVerification(baseSnapshot, event)).toThrow(
      'New email is the same as the current verified email'
    );
  });

  test('valid transition: pending -> verified via CONFIRM_NEW_EMAIL', () => {
    const pendingSnapshot: EmailAccountSnapshot = {
      ...baseSnapshot,
      pendingEmail: 'new@example.com',
      pendingEmailRequestedAt: new Date(),
      emailChangeStatus: 'pending',
      previousVerifiedEmail: 'old@example.com',
    };
    const event: EmailChangeEvent = {
      type: 'CONFIRM_NEW_EMAIL',
      token: 'valid-token',
      newEmail: 'new@example.com',
    };
    const result = transitionEmailVerification(pendingSnapshot, event);
    expect(result.newState).toBe('verified');
    expect(result.snapshot.email).toBe('new@example.com');
    expect(result.snapshot.emailVerified).toBe(true);
    expect(result.snapshot.pendingEmail).toBeNull();
    expect(result.snapshot.emailChangeStatus).toBe('none');
    expect(result.snapshot.previousVerifiedEmail).toBe('old@example.com');
    expect(result.sideEffects?.invalidateTokens).toBe(true);
  });

  test('reject CONFIRM_NEW_EMAIL when not pending', () => {
    const event: EmailChangeEvent = {
      type: 'CONFIRM_NEW_EMAIL',
      token: 'token',
      newEmail: 'new@example.com',
    };
    expect(() => transitionEmailVerification(baseSnapshot, event)).toThrow(
      'CONFIRM_NEW_EMAIL only allowed from pending_reverification state'
    );
  });

  test('valid transition: pending -> change_failed via DELIVERY_BOUNCED', () => {
    const pendingSnapshot: EmailAccountSnapshot = {
      ...baseSnapshot,
      pendingEmail: 'new@example.com',
      emailChangeStatus: 'pending',
      previousVerifiedEmail: 'old@example.com',
    };
    const event: EmailChangeEvent = { type: 'DELIVERY_BOUNCED', reason: 'SMTP error' };
    const result = transitionEmailVerification(pendingSnapshot, event);
    expect(result.newState).toBe('change_failed');
    expect(result.snapshot.emailChangeStatus).toBe('failed');
    expect(result.snapshot.emailChangeFailureReason).toBe('SMTP error');
    // verified email stays unchanged
    expect(result.snapshot.email).toBe('old@example.com');
    expect(result.snapshot.emailVerified).toBe(true);
  });

  test('valid transition: pending -> change_failed via TOKEN_EXPIRED', () => {
    const pendingSnapshot: EmailAccountSnapshot = {
      ...baseSnapshot,
      pendingEmail: 'new@example.com',
      emailChangeStatus: 'pending',
      previousVerifiedEmail: 'old@example.com',
    };
    const event: EmailChangeEvent = { type: 'TOKEN_EXPIRED' };
    const result = transitionEmailVerification(pendingSnapshot, event);
    expect(result.newState).toBe('change_failed');
    expect(result.snapshot.emailChangeFailureReason).toBe('Verification token expired');
  });

  test('valid rollback from pending_reverification', () => {
    const pendingSnapshot: EmailAccountSnapshot = {
      ...baseSnapshot,
      pendingEmail: 'new@example.com',
      emailChangeStatus: 'pending',
      previousVerifiedEmail: 'old@example.com',
    };
    const event: EmailChangeEvent = { type: 'ROLLBACK_CHANGE' };
    const result = transitionEmailVerification(pendingSnapshot, event);
    expect(result.newState).toBe('verified');
    expect(result.snapshot.email).toBe('old@example.com');
    expect(result.snapshot.emailVerified).toBe(true);
    expect(result.snapshot.pendingEmail).toBeNull();
    expect(result.snapshot.emailChangeStatus).toBe('none');
    expect(canRollbackEmailChange(result.snapshot)).toBe(false);
  });

  test('valid rollback from change_failed', () => {
    const failedSnapshot: EmailAccountSnapshot = {
      ...baseSnapshot,
      pendingEmail: 'new@example.com',
      emailChangeStatus: 'failed',
      emailChangeFailureReason: 'Email delivery failed',
      previousVerifiedEmail: 'old@example.com',
    };
    const event: EmailChangeEvent = { type: 'ROLLBACK_CHANGE' };
    const result = transitionEmailVerification(failedSnapshot, event);
    expect(result.newState).toBe('verified');
    expect(result.snapshot.email).toBe('old@example.com');
    expect(result.snapshot.emailVerified).toBe(true);
    expect(result.snapshot.emailChangeStatus).toBe('none');
  });

  test('reject rollback when not allowed', () => {
    const unverifiedSnapshot: EmailAccountSnapshot = {
      email: null,
      emailVerified: false,
      pendingEmail: null,
      pendingEmailRequestedAt: null,
      emailChangeStatus: 'none',
      emailChangeFailureReason: null,
      previousVerifiedEmail: null,
    };
    const event: EmailChangeEvent = { type: 'ROLLBACK_CHANGE' };
    expect(() => transitionEmailVerification(unverifiedSnapshot, event)).toThrow(
      'Rollback not allowed in current state'
    );
  });
});
