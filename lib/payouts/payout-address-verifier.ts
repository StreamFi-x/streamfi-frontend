import { logger } from '@/lib/tracing/logger';
import { getCurrentTraceContext } from '@/lib/tracing/trace-context';

/**
 * Payout address change request with time-locked verification
 */
export interface PayoutAddressChangeRequest {
  requestId: string;
  userId: string;
  currentAddress: string;
  proposedAddress: string;
  status: 'pending' | 'verified' | 'cancelled' | 'expired';
  createdAt: Date;
  verificationDeadline: Date; // Time-lock expiry
  verifiedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  testPaymentRequired: boolean;
  testPaymentVerified: boolean;
  testPaymentTxHash?: string;
}

/**
 * Configuration for payout address verification
 */
export interface PayoutVerificationConfig {
  cooldownDays: number; // How many days before change takes effect (e.g., 3)
  testPaymentAmount: number; // USDC or XLM amount to send as verification (e.g., 0.01)
  testPaymentAsset: 'USDC' | 'XLM';
  notificationChannel: 'email' | 'sms' | 'both'; // How to notify user
  maxChangeAttemptsPerDay: number; // Prevent spam
}

export const DEFAULT_VERIFICATION_CONFIG: PayoutVerificationConfig = {
  cooldownDays: 3,
  testPaymentAmount: 0.01,
  testPaymentAsset: 'USDC',
  notificationChannel: 'email',
  maxChangeAttemptsPerDay: 5,
};

/**
 * Payout address verification system
 * Implements time-locked changes with out-of-band verification
 */
export class PayoutAddressVerifier {
  private changeRequests: Map<string, PayoutAddressChangeRequest> = new Map();
  private userChangeAttempts: Map<string, Date[]> = new Map(); // Track attempts per user per day
  private notificationCallbacks: Array<(notification: PayoutChangeNotification) => Promise<void>> = [];

  constructor(private config: PayoutVerificationConfig = DEFAULT_VERIFICATION_CONFIG) {
    logger.info('PayoutAddressVerifier initialized', {
      operation: 'PayoutAddressVerifier.constructor',
      cooldownDays: config.cooldownDays,
      testPaymentRequired: config.testPaymentAmount > 0,
    });
  }

  /**
   * Initiate a payout address change request
   * Requires time-locked verification before change takes effect
   */
  async initiateAddressChange(
    userId: string,
    currentAddress: string,
    proposedAddress: string
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    logger.info('Payout address change initiated', {
      operation: 'initiateAddressChange',
      userId,
      currentAddress: currentAddress.substring(0, 8),
      proposedAddress: proposedAddress.substring(0, 8),
    });

    // Validate addresses
    if (!this.isValidStellarAddress(proposedAddress)) {
      logger.warn('Invalid proposed address', {
        userId,
        proposedAddress,
      });
      return { success: false, error: 'Invalid Stellar address' };
    }

    // Prevent same-address changes
    if (currentAddress === proposedAddress) {
      logger.warn('Attempted to change to same address', {
        userId,
      });
      return { success: false, error: 'New address must differ from current address' };
    }

    // Check rate limiting (max attempts per day)
    if (!this.checkRateLimit(userId)) {
      logger.warn('Rate limit exceeded for payout address changes', {
        userId,
      });
      return { success: false, error: 'Too many change requests. Please try again tomorrow.' };
    }

    // Create change request with time-lock
    const now = new Date();
    const verificationDeadline = new Date(now.getTime() + this.config.cooldownDays * 24 * 60 * 60 * 1000);
    const requestId = `payout-change-${crypto.randomUUID()}`;

    const changeRequest: PayoutAddressChangeRequest = {
      requestId,
      userId,
      currentAddress,
      proposedAddress,
      status: 'pending',
      createdAt: now,
      verificationDeadline,
      testPaymentRequired: this.config.testPaymentAmount > 0,
      testPaymentVerified: false,
    };

    this.changeRequests.set(requestId, changeRequest);

    // Track attempt for rate limiting
    const attempts = this.userChangeAttempts.get(userId) || [];
    attempts.push(now);
    this.userChangeAttempts.set(userId, attempts);

    logger.info('Payout address change request created', {
      operation: 'initiateAddressChange',
      requestId,
      userId,
      cooldownDays: this.config.cooldownDays,
      verificationDeadline: verificationDeadline.toISOString(),
    });

    // Send out-of-band notification
    await this.notifyPayoutChange(changeRequest);

    return { success: true, requestId };
  }

  /**
   * Get pending change request for user
   */
  getPendingChangeRequest(userId: string): PayoutAddressChangeRequest | undefined {
    for (const req of this.changeRequests.values()) {
      if (req.userId === userId && req.status === 'pending') {
        // Check if expired
        if (new Date() > req.verificationDeadline) {
          req.status = 'expired';
          logger.info('Change request expired', {
            operation: 'getPendingChangeRequest',
            requestId: req.requestId,
            userId,
          });
          continue;
        }
        return req;
      }
    }
    return undefined;
  }

  /**
   * Confirm test payment received (wallet ownership verification)
   */
  confirmTestPayment(
    requestId: string,
    userId: string,
    testPaymentTxHash: string
  ): { success: boolean; error?: string } {
    const request = this.changeRequests.get(requestId);
    if (!request) {
      logger.warn('Change request not found', {
        requestId,
        userId,
      });
      return { success: false, error: 'Change request not found' };
    }

    if (request.userId !== userId) {
      logger.warn('User mismatch on test payment confirmation', {
        requestId,
        userId,
        requestUserId: request.userId,
      });
      return { success: false, error: 'Unauthorized' };
    }

    if (request.status !== 'pending') {
      logger.warn('Cannot confirm test payment on non-pending request', {
        requestId,
        status: request.status,
      });
      return { success: false, error: 'Change request is no longer pending' };
    }

    // Mark test payment as verified
    request.testPaymentVerified = true;
    request.testPaymentTxHash = testPaymentTxHash;

    logger.info('Test payment confirmed', {
      operation: 'confirmTestPayment',
      requestId,
      userId,
      txHash: testPaymentTxHash.substring(0, 16),
    });

    return { success: true };
  }

  /**
   * Verify change request after cooldown has elapsed
   * Called by cron job or manual verification after deadline
   */
  verifyChangeRequest(requestId: string): { success: boolean; error?: string } {
    const request = this.changeRequests.get(requestId);
    if (!request) {
      return { success: false, error: 'Change request not found' };
    }

    if (request.status !== 'pending') {
      logger.warn('Cannot verify non-pending change request', {
        requestId,
        status: request.status,
      });
      return { success: false, error: `Request is already ${request.status}` };
    }

    const now = new Date();
    if (now < request.verificationDeadline) {
      logger.warn('Change request not yet eligible for verification', {
        requestId,
        timeRemaining: request.verificationDeadline.getTime() - now.getTime(),
      });
      return { success: false, error: 'Change request cooldown not yet elapsed' };
    }

    // Require test payment if configured
    if (request.testPaymentRequired && !request.testPaymentVerified) {
      logger.warn('Cannot verify without test payment confirmation', {
        requestId,
      });
      return { success: false, error: 'Test payment must be confirmed first' };
    }

    // Mark as verified
    request.status = 'verified';
    request.verifiedAt = now;

    logger.info('Payout address change verified', {
      operation: 'verifyChangeRequest',
      requestId,
      userId: request.userId,
      newAddress: request.proposedAddress.substring(0, 8),
    });

    return { success: true };
  }

  /**
   * Cancel an unverified change request
   * Can only be called by the account owner
   */
  cancelChangeRequest(
    requestId: string,
    userId: string,
    reason?: string
  ): { success: boolean; error?: string } {
    const request = this.changeRequests.get(requestId);
    if (!request) {
      logger.warn('Change request not found for cancellation', {
        requestId,
        userId,
      });
      return { success: false, error: 'Change request not found' };
    }

    if (request.userId !== userId) {
      logger.warn('User mismatch on cancellation', {
        requestId,
        userId,
        requestUserId: request.userId,
      });
      return { success: false, error: 'Unauthorized' };
    }

    if (request.status !== 'pending') {
      logger.warn('Cannot cancel non-pending request', {
        requestId,
        status: request.status,
      });
      return { success: false, error: `Request is already ${request.status}` };
    }

    request.status = 'cancelled';
    request.cancelledAt = new Date();
    request.cancellationReason = reason || 'Cancelled by user';

    logger.info('Payout address change cancelled', {
      operation: 'cancelChangeRequest',
      requestId,
      userId,
      reason: request.cancellationReason,
    });

    return { success: true };
  }

  /**
   * Apply verified change to user's account
   * Should be called by payout system when executing a payout
   */
  getActivePayoutAddress(userId: string, fallbackAddress: string): string {
    // Check if there's a verified pending change
    for (const req of this.changeRequests.values()) {
      if (req.userId === userId && req.status === 'verified') {
        const now = new Date();
        if (now >= req.verificationDeadline) {
          logger.info('Using verified payout address change', {
            operation: 'getActivePayoutAddress',
            userId,
            newAddress: req.proposedAddress.substring(0, 8),
          });
          return req.proposedAddress;
        }
      }
    }

    return fallbackAddress;
  }

  /**
   * Send out-of-band notification about pending payout change
   */
  private async notifyPayoutChange(request: PayoutAddressChangeRequest): Promise<void> {
    const notification: PayoutChangeNotification = {
      type: 'payout_change_initiated',
      userId: request.userId,
      proposedAddress: request.proposedAddress,
      verificationDeadline: request.verificationDeadline,
      changeRequestId: request.requestId,
      cooldownDays: this.config.cooldownDays,
      cancelUrl: `/api/routes-f/payout-address-cancel?request_id=${request.requestId}`,
    };

    logger.info('Sending payout change notification', {
      operation: 'notifyPayoutChange',
      userId: request.userId,
      channel: this.config.notificationChannel,
    });

    for (const callback of this.notificationCallbacks) {
      try {
        await callback(notification);
      } catch (error) {
        logger.error('Failed to send payout change notification', {
          userId: request.userId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Register notification callback (e.g., email, SMS)
   */
  onNotification(callback: (notification: PayoutChangeNotification) => Promise<void>): void {
    this.notificationCallbacks.push(callback);
  }

  /**
   * Check rate limiting for change requests
   */
  private checkRateLimit(userId: string): boolean {
    const attempts = this.userChangeAttempts.get(userId) || [];
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Filter to last 24 hours
    const recentAttempts = attempts.filter(a => a > dayAgo);

    if (recentAttempts.length >= this.config.maxChangeAttemptsPerDay) {
      return false;
    }

    // Update attempts
    this.userChangeAttempts.set(userId, recentAttempts);
    return true;
  }

  /**
   * Validate Stellar address format
   */
  private isValidStellarAddress(address: string): boolean {
    return /^G[A-Z0-9]{55}$/.test(address);
  }

  /**
   * Get all change requests for user (admin/debugging)
   */
  getUserChangeHistory(userId: string): PayoutAddressChangeRequest[] {
    return Array.from(this.changeRequests.values()).filter(r => r.userId === userId);
  }

  /**
   * Get pending requests (for cron verification job)
   */
  getPendingRequests(): PayoutAddressChangeRequest[] {
    const now = new Date();
    return Array.from(this.changeRequests.values()).filter(r => {
      if (r.status !== 'pending') return false;
      // Include only if past deadline
      return now >= r.verificationDeadline;
    });
  }

  /**
   * Reset for testing
   */
  resetState(): void {
    this.changeRequests.clear();
    this.userChangeAttempts.clear();
  }
}

/**
 * Payout change notification
 */
export interface PayoutChangeNotification {
  type: 'payout_change_initiated' | 'payout_change_cancelled';
  userId: string;
  proposedAddress: string;
  verificationDeadline: Date;
  changeRequestId: string;
  cooldownDays: number;
  cancelUrl: string;
}
