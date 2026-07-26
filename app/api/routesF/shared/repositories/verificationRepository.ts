import { getCurrentTimestamp } from '../../helpers/dateUtilities';
import { generateVerificationRequestId } from '../../helpers/idUtilities';
import type { VerificationRequest } from '../../types';

// In-memory mock storage
let verificationRequests: VerificationRequest[] = [];

/**
 * Verification Request Repository
 */
export const verificationRepository = {
  /**
   * Find verification request by ID
   */
  findById(requestId: string): VerificationRequest | null {
    return verificationRequests.find(request => request.request_id === requestId) || null;
  },

  /**
   * Find all verification requests by creator ID
   */
  findByCreatorId(creatorId: string): VerificationRequest[] {
    return verificationRequests.filter(request => request.creator_id === creatorId);
  },

  /**
   * Check if creator has pending verification request
   */
  hasPendingRequest(creatorId: string): boolean {
    return verificationRequests.some(
      request => request.creator_id === creatorId && request.status === 'pending'
    );
  },

  /**
   * Create a new verification request
   */
  create(request: Omit<VerificationRequest, 'request_id' | 'status' | 'submitted_at'>): VerificationRequest {
    const newRequest: VerificationRequest = {
      ...request,
      request_id: generateVerificationRequestId(),
      status: 'pending',
      submitted_at: getCurrentTimestamp(),
    };
    
    verificationRequests.push(newRequest);
    return newRequest;
  },

  /**
   * Update verification request status
   */
  updateStatus(requestId: string, status: VerificationRequest['status']): VerificationRequest | null {
    const requestIndex = verificationRequests.findIndex(request => request.request_id === requestId);
    
    if (requestIndex === -1) return null;
    
    const updatedRequest: VerificationRequest = {
      ...verificationRequests[requestIndex],
      status,
      reviewed_at: getCurrentTimestamp(),
    };
    
    verificationRequests[requestIndex] = updatedRequest;
    return updatedRequest;
  },

  /**
   * Get all verification requests (for debugging/testing)
   */
  getAll(): VerificationRequest[] {
    return [...verificationRequests];
  },

  /**
   * Seed with mock data
   */
  seed(data: VerificationRequest[]): void {
    verificationRequests = [...data];
  },

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    verificationRequests = [];
  },
};