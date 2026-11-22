// lib/auth/email-reverification.ts
// Pure TypeScript implementation of the email re‑verification state machine.

/** State of the email verification process */
export type EmailVerificationState =
  | 'unverified'
  | 'verified'
  | 'pending_reverification'
  | 'change_failed';

/** Persistent status stored in the database */
export type EmailChangeStatus = 'none' | 'pending' | 'failed';

/** Snapshot of the relevant user columns */
export interface EmailAccountSnapshot {
  /** Current primary email (null when never verified) */
  email: string | null;
  /** Whether the primary email is verified */
  emailVerified: boolean;
  /** New email awaiting verification */
  pendingEmail?: string | null;
  /** When the pending email was requested */
  pendingEmailRequestedAt?: Date | null;
  /** Change status column */
  emailChangeStatus: EmailChangeStatus;
  /** Failure reason when status is 'failed' */
  emailChangeFailureReason?: string | null;
  /** The previously verified email, preserved across pending states */
  previousVerifiedEmail?: string | null;
}

/** Events that drive the state machine */
export type EmailChangeEvent =
  | { type: 'REQUEST_CHANGE'; newEmail: string }
  | { type: 'CONFIRM_NEW_EMAIL'; token: string; newEmail: string }
  | { type: 'DELIVERY_BOUNCED'; reason?: string }
  | { type: 'TOKEN_EXPIRED' }
  | { type: 'ROLLBACK_CHANGE' };

/** Result of a transition */
export interface EmailTransitionResult {
  /** New derived state after applying the event */
  newState: EmailVerificationState;
  /** Updated snapshot ready to be persisted */
  snapshot: EmailAccountSnapshot;
  /** Optional side‑effects for callers (e.g., token invalidation) */
  sideEffects?: { invalidateTokens?: boolean };
}

/** Derive the current state from a snapshot */
export function deriveEmailVerificationState(
  snapshot: EmailAccountSnapshot,
): EmailVerificationState {
  if (!snapshot.emailVerified) {
    return 'unverified';
  }
  switch (snapshot.emailChangeStatus) {
    case 'pending':
      return 'pending_reverification';
    case 'failed':
      return 'change_failed';
    case 'none':
    default:
      return 'verified';
  }
}

/** Determine whether a rollback is possible */
export function canRollbackEmailChange(snapshot: EmailAccountSnapshot): boolean {
  const state = deriveEmailVerificationState(snapshot);
  return state === 'pending_reverification' || state === 'change_failed';
}

/** Helper: case‑insensitive email equality */
export function emailsEqual(a: string | null, b: string): boolean {
  return a !== null && a.toLowerCase() === b.toLowerCase();
}

/** Perform a state transition */
export function transitionEmailVerification(
  snapshot: EmailAccountSnapshot,
  event: EmailChangeEvent,
): EmailTransitionResult {
  const currentState = deriveEmailVerificationState(snapshot);

  // Clone snapshot to avoid mutating caller's object
  const next: EmailAccountSnapshot = { ...snapshot };

  switch (event.type) {
    case 'REQUEST_CHANGE': {
        // Allow request from verified, pending_reverification, change_failed, and unverified states
        if (currentState === 'unverified') {
          // Unverified users can request a new email without altering emailVerified
          if (emailsEqual(snapshot.email, event.newEmail)) {
            throw new Error('New email is the same as the current email');
          }
          next.pendingEmail = event.newEmail;
          next.pendingEmailRequestedAt = new Date();
          next.emailChangeStatus = 'pending';
          next.emailChangeFailureReason = null;
          // Keep emailVerified false and do not modify email
          next.emailVerified = false;
          // Preserve previousVerifiedEmail as is (may be null)
          next.previousVerifiedEmail = snapshot.previousVerifiedEmail ?? null;
          return { newState: 'unverified', snapshot: next };
        }
        // For verified, pending_reverification, change_failed states
        const allowedStates = ['verified', 'pending_reverification', 'change_failed'];
        if (!allowedStates.includes(currentState)) {
          throw new Error('REQUEST_CHANGE not allowed from current state');
        }
        if (emailsEqual(snapshot.email, event.newEmail)) {
          throw new Error('New email is the same as the current verified email');
        }

        // Preserve previous verified email if exists, otherwise keep existing
        next.previousVerifiedEmail = snapshot.previousVerifiedEmail ?? snapshot.email ?? null;
        next.pendingEmail = event.newEmail;
        next.pendingEmailRequestedAt = new Date();
        next.emailChangeStatus = 'pending';
        next.emailChangeFailureReason = null;
        // Keep emailVerified true and retain current email
        next.emailVerified = true;
        return { newState: 'pending_reverification', snapshot: next };
    }

    case 'CONFIRM_NEW_EMAIL': {
        // Allow confirm from pending_reverification or unverified (if pendingEmail matches)
        if (currentState !== 'pending_reverification' && currentState !== 'unverified') {
          throw new Error('CONFIRM_NEW_EMAIL only allowed from pending_reverification state');
        }
        // Ensure pendingEmail matches
        if (!snapshot.pendingEmail || !emailsEqual(snapshot.pendingEmail, event.newEmail)) {
          throw new Error('Confirmed email does not match pending email');
        }
        // Promote pending email to primary
        next.email = event.newEmail;
        next.emailVerified = true;
        // Preserve previous verified email if exists (for rollback), else keep existing
        next.previousVerifiedEmail = snapshot.previousVerifiedEmail ?? snapshot.email ?? null;
        next.pendingEmail = null;
        next.pendingEmailRequestedAt = null;
        next.emailChangeStatus = 'none';
        next.emailChangeFailureReason = null;
        return { newState: 'verified', snapshot: next, sideEffects: { invalidateTokens: true } };
    }

    case 'DELIVERY_BOUNCED': {
      if (currentState !== 'pending_reverification') {
        throw new Error('DELIVERY_BOUNCED only allowed from pending_reverification state');
      }
      next.emailChangeStatus = 'failed';
      next.emailChangeFailureReason = event.reason ?? 'Email delivery failed';
      // Keep pending email (allows rollback) and keep verified email unchanged
      return { newState: 'change_failed', snapshot: next };
    }

    case 'TOKEN_EXPIRED': {
      if (currentState !== 'pending_reverification') {
        throw new Error('TOKEN_EXPIRED only allowed from pending_reverification state');
      }
      next.emailChangeStatus = 'failed';
      next.emailChangeFailureReason = 'Verification token expired';
      return { newState: 'change_failed', snapshot: next };
    }

    case 'ROLLBACK_CHANGE': {
      if (!canRollbackEmailChange(snapshot)) {
        throw new Error('Rollback not allowed in current state');
      }
      // Restore previous verified email if we have it, otherwise keep existing email
      if (snapshot.previousVerifiedEmail) {
        next.email = snapshot.previousVerifiedEmail;
      }
      next.emailVerified = true;
      // Clear pending fields and reset status
      next.pendingEmail = null;
      next.pendingEmailRequestedAt = null;
      next.emailChangeStatus = 'none';
      next.emailChangeFailureReason = null;
      next.previousVerifiedEmail = undefined;
      return { newState: 'verified', snapshot: next, sideEffects: { invalidateTokens: true } };
    }

    default: {
      // Exhaustiveness check – should never reach here
      const _exhaustiveCheck: never = event;
      throw new Error('Unhandled event type');
    }
  }
}
