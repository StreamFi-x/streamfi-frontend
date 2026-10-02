import {
  PayoutAddressVerifier,
  PayoutVerificationConfig,
} from '@/lib/payouts/payout-address-verifier';

describe('Payout Address Verification', () => {
  let verifier: PayoutAddressVerifier;
  const validAddress1 = 'GAQAA5Z4K6U5ENRJEZL7HCL7R5D6ZE2BKRMQ4YC7STRONG6ENRJEZL7HCL7R';
  const validAddress2 = 'GBUQWP3BOUZX34LOCALGHG7GSTLW5SVXE7YQSTQYSTRONG6ENRJEZL7HCL7';
  const userId = 'user-123';

  beforeEach(() => {
    const config: PayoutVerificationConfig = {
      cooldownDays: 3,
      testPaymentAmount: 0.01,
      testPaymentAsset: 'USDC',
      notificationChannel: 'email',
      maxChangeAttemptsPerDay: 5,
    };
    verifier = new PayoutAddressVerifier(config);
  });

  describe('Initiate Address Change', () => {
    it('creates a pending change request with time-lock', async () => {
      const result = await verifier.initiateAddressChange(userId, validAddress1, validAddress2);

      expect(result.success).toBe(true);
      expect(result.requestId).toBeDefined();

      const pending = verifier.getPendingChangeRequest(userId);
      expect(pending).toBeDefined();
      expect(pending?.status).toBe('pending');
      expect(pending?.proposedAddress).toBe(validAddress2);
    });

    it('rejects invalid Stellar address', async () => {
      const result = await verifier.initiateAddressChange(userId, validAddress1, 'INVALID123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('prevents changing to same address', async () => {
      const result = await verifier.initiateAddressChange(userId, validAddress1, validAddress1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('must differ');
    });

    it('enforces rate limiting (max changes per day)', async () => {
      const config: PayoutVerificationConfig = {
        cooldownDays: 1,
        testPaymentAmount: 0.01,
        testPaymentAsset: 'USDC',
        notificationChannel: 'email',
        maxChangeAttemptsPerDay: 2,
      };
      const limitedVerifier = new PayoutAddressVerifier(config);

      // First attempt should succeed
      let result = await limitedVerifier.initiateAddressChange(
        userId,
        validAddress1,
        validAddress2
      );
      expect(result.success).toBe(true);

      // Second attempt should succeed
      result = await limitedVerifier.initiateAddressChange(
        userId,
        validAddress1,
        validAddress2
      );
      expect(result.success).toBe(true);

      // Third attempt should fail (rate limited)
      result = await limitedVerifier.initiateAddressChange(
        userId,
        validAddress1,
        validAddress2
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many');
    });

    it('sends notification on initiation', async () => {
      const notifications: any[] = [];
      verifier.onNotification(async (n) => {
        notifications.push(n);
      });

      const result = await verifier.initiateAddressChange(userId, validAddress1, validAddress2);
      expect(result.success).toBe(true);

      // Give async notification time to process
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].type).toBe('payout_change_initiated');
      expect(notifications[0].userId).toBe(userId);
    });
  });

  describe('Cooldown Enforcement', () => {
    it('blocks verification before cooldown elapsed', async () => {
      const result = await verifier.initiateAddressChange(userId, validAddress1, validAddress2);
      expect(result.requestId).toBeDefined();

      // Try to verify immediately (should fail)
      const verifyResult = verifier.verifyChangeRequest(result.requestId!);
      expect(verifyResult.success).toBe(false);
      expect(verifyResult.error).toContain('cooldown not yet elapsed');
    });

    it('allows verification after cooldown elapsed', async () => {
      // Use short cooldown for testing
      const config: PayoutVerificationConfig = {
        cooldownDays: 0, // 0 days = immediate
        testPaymentAmount: 0,
        testPaymentAsset: 'USDC',
        notificationChannel: 'email',
        maxChangeAttemptsPerDay: 10,
      };
      const shortCooldownVerifier = new PayoutAddressVerifier(config);

      const result = await shortCooldownVerifier.initiateAddressChange(
        userId,
        validAddress1,
        validAddress2
      );
      expect(result.requestId).toBeDefined();

      // Wait a bit to ensure deadline has passed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify should now succeed
      const verifyResult = shortCooldownVerifier.verifyChangeRequest(result.requestId!);
      expect(verifyResult.success).toBe(true);
    });

    it('tracks verification deadline in change request', async () => {
      const result = await verifier.initiateAddressChange(userId, validAddress1, validAddress2);
      expect(result.requestId).toBeDefined();

      const pending = verifier.getPendingChangeRequest(userId);
      expect(pending).toBeDefined();

      const deadlineTime = pending!.verificationDeadline.getTime();
      const nowTime = Date.now();
      const expectedDelay = 3 * 24 * 60 * 60 * 1000; // 3 days

      // Should be approximately 3 days in future
      expect(Math.abs(deadlineTime - nowTime - expectedDelay)).toBeLessThan(1000);
    });
  });

  describe('Test Payment Verification', () => {
    it('tracks test payment as required and unverified initially', async () => {
      const result = await verifier.initiateAddressChange(userId, validAddress1, validAddress2);
      expect(result.requestId).toBeDefined();

      const pending = verifier.getPendingChangeRequest(userId);
      expect(pending?.testPaymentRequired).toBe(true);
      expect(pending?.testPaymentVerified).toBe(false);
    });

    it('confirms test payment and marks as verified', async () => {
      const result = await verifier.initiateAddressChange(userId, validAddress1, validAddress2);
      expect(result.requestId).toBeDefined();

      const txHash = 'a'.repeat(56); // Mock tx hash
      const confirmResult = verifier.confirmTestPayment(result.requestId!, userId, txHash);

      expect(confirmResult.success).toBe(true);

      const pending = verifier.getPendingChangeRequest(userId);
      expect(pending?.testPaymentVerified).toBe(true);
      expect(pending?.testPaymentTxHash).toBe(txHash);
    });

    it('prevents verification without test payment confirmation', async () => {
      const config: PayoutVerificationConfig = {
        cooldownDays: 0,
        testPaymentAmount: 0.01,
        testPaymentAsset: 'USDC',
        notificationChannel: 'email',
        maxChangeAttemptsPerDay: 10,
      };
      const verifierWithPayment = new PayoutAddressVerifier(config);

      const result = await verifierWithPayment.initiateAddressChange(
        userId,
        validAddress1,
        validAddress2
      );

      // Cooldown passed, but test payment not confirmed
      const verifyResult = verifierWithPayment.verifyChangeRequest(result.requestId!);
      expect(verifyResult.success).toBe(false);
      expect(verifyResult.error).toContain('Test payment');
    });

    it('allows verification with test payment confirmed', async () => {
      const config: PayoutVerificationConfig = {
        cooldownDays: 0,
        testPaymentAmount: 0.01,
        testPaymentAsset: 'USDC',
        notificationChannel: 'email',
        maxChangeAttemptsPerDay: 10,
      };
      const verifierWithPayment = new PayoutAddressVerifier(config);

      const result = await verifierWithPayment.initiateAddressChange(
        userId,
        validAddress1,
        validAddress2
      );

      // Confirm test payment
      const confirmResult = verifierWithPayment.confirmTestPayment(
        result.requestId!,
        userId,
        'b'.repeat(56)
      );
      expect(confirmResult.success).toBe(true);

      // Now verification should succeed
      const verifyResult = verifierWithPayment.verifyChangeRequest(result.requestId!);
      expect(verifyResult.success).toBe(true);
    });
  });

  describe('Cancellation Path', () => {
    it('allows user to cancel pending change request', async () => {
      const result = await verifier.initiateAddressChange(userId, validAddress1, validAddress2);
      expect(result.requestId).toBeDefined();

      const pending = verifier.getPendingChangeRequest(userId);
      expect(pending?.status).toBe('pending');

      // Cancel the request
      const cancelResult = verifier.cancelChangeRequest(result.requestId!, userId);
      expect(cancelResult.success).toBe(true);

      // Verify it's now cancelled
      const cancelled = verifier.getPendingChangeRequest(userId);
      expect(cancelled).toBeUndefined();
    });

    it('prevents cancellation by non-owner', async () => {
      const result = await verifier.initiateAddressChange(userId, validAddress1, validAddress2);
      expect(result.requestId).toBeDefined();

      // Try to cancel as different user
      const cancelResult = verifier.cancelChangeRequest(result.requestId!, 'other-user');
      expect(cancelResult.success).toBe(false);
      expect(cancelResult.error).toContain('Unauthorized');
    });

    it('prevents cancellation of verified request', async () => {
      const config: PayoutVerificationConfig = {
        cooldownDays: 0,
        testPaymentAmount: 0,
        testPaymentAsset: 'USDC',
        notificationChannel: 'email',
        maxChangeAttemptsPerDay: 10,
      };
      const shortVerifier = new PayoutAddressVerifier(config);

      const result = await shortVerifier.initiateAddressChange(userId, validAddress1, validAddress2);
      expect(result.requestId).toBeDefined();

      // Verify the change
      await new Promise(resolve => setTimeout(resolve, 100));
      const verifyResult = shortVerifier.verifyChangeRequest(result.requestId!);
      expect(verifyResult.success).toBe(true);

      // Try to cancel verified request
      const cancelResult = shortVerifier.cancelChangeRequest(result.requestId!, userId);
      expect(cancelResult.success).toBe(false);
      expect(cancelResult.error).toContain('no longer pending');
    });

    it('tracks cancellation with reason', async () => {
      const result = await verifier.initiateAddressChange(userId, validAddress1, validAddress2);
      expect(result.requestId).toBeDefined();

      const cancelResult = verifier.cancelChangeRequest(
        result.requestId!,
        userId,
        'Not my address'
      );
      expect(cancelResult.success).toBe(true);

      const history = verifier.getUserChangeHistory(userId);
      const cancelled = history.find(r => r.status === 'cancelled');
      expect(cancelled?.cancellationReason).toBe('Not my address');
    });
  });

  describe('Active Payout Address Resolution', () => {
    it('returns current address when no verified change pending', () => {
      const address = verifier.getActivePayoutAddress(userId, validAddress1);
      expect(address).toBe(validAddress1);
    });

    it('returns new address when verified change is active', async () => {
      const config: PayoutVerificationConfig = {
        cooldownDays: 0,
        testPaymentAmount: 0,
        testPaymentAsset: 'USDC',
        notificationChannel: 'email',
        maxChangeAttemptsPerDay: 10,
      };
      const shortVerifier = new PayoutAddressVerifier(config);

      await shortVerifier.initiateAddressChange(userId, validAddress1, validAddress2);
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = shortVerifier.getPendingRequests()[0];
      shortVerifier.verifyChangeRequest(result.requestId);

      const address = shortVerifier.getActivePayoutAddress(userId, validAddress1);
      expect(address).toBe(validAddress2);
    });
  });

  describe('Pending Request Retrieval', () => {
    it('returns pending requests past deadline for verification', async () => {
      const config: PayoutVerificationConfig = {
        cooldownDays: 0,
        testPaymentAmount: 0,
        testPaymentAsset: 'USDC',
        notificationChannel: 'email',
        maxChangeAttemptsPerDay: 10,
      };
      const shortVerifier = new PayoutAddressVerifier(config);

      await shortVerifier.initiateAddressChange(userId, validAddress1, validAddress2);
      await new Promise(resolve => setTimeout(resolve, 100));

      const pending = shortVerifier.getPendingRequests();
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].status).toBe('pending');
    });
  });

  describe('User Change History', () => {
    it('retrieves all changes for a user', async () => {
      const userId2 = 'user-456';

      await verifier.initiateAddressChange(userId, validAddress1, validAddress2);
      await verifier.initiateAddressChange(userId2, validAddress1, validAddress2);

      const history1 = verifier.getUserChangeHistory(userId);
      const history2 = verifier.getUserChangeHistory(userId2);

      expect(history1.length).toBe(1);
      expect(history1[0].userId).toBe(userId);

      expect(history2.length).toBe(1);
      expect(history2[0].userId).toBe(userId2);
    });
  });
});
