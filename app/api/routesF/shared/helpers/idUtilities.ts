/**
 * Generate a deterministic ID based on prefix and timestamp
 */
export function generateDeterministicId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate verification request ID
 */
export function generateVerificationRequestId(): string {
  return generateDeterministicId('ver');
}

/**
 * Generate follow relationship ID
 */
export function generateFollowId(): string {
  return generateDeterministicId('flw');
}

/**
 * Generate viewer ID
 */
export function generateViewerId(): string {
  return generateDeterministicId('vwr');
}

/**
 * Generate creator ID
 */
export function generateCreatorId(): string {
  return generateDeterministicId('crt');
}

/**
 * Validate if ID has correct format for a given prefix
 */
export function validateIdFormat(id: string, prefix: string): boolean {
  return id.startsWith(`${prefix}_`) && id.length > prefix.length + 2;
}

/**
 * Extract timestamp from ID
 */
export function extractTimestampFromId(id: string): number | null {
  try {
    const parts = id.split('_');
    if (parts.length < 3) return null;
    
    const timestampPart = parts[1];
    return parseInt(timestampPart, 36);
  } catch {
    return null;
  }
}