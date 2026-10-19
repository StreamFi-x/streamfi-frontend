/**
 * Quality selection logic for adaptive bitrate streaming
 * 
 * Implements a precedence system for quality selection:
 * 1. Manual override (explicit user selection) - highest priority
 * 2. Proactive connection-aware cap (Network Information API)
 * 3. Reactive adaptive bitrate (ABR based on buffer and throughput)
 * 4. Default/auto (no constraints)
 */

export type Quality = 'auto' | '1080p' | '720p' | '480p' | '360p' | '240p';

export interface QualitySelectionContext {
  /** Manually selected quality by user, if any */
  manualSelection?: Quality;
  /** Connection-based quality cap from Network Information API */
  connectionCap?: Quality;
  /** Current reactive ABR decision (if available) */
  abrSelection?: Quality;
  /** Whether saveData is enabled */
  saveDataEnabled: boolean;
  /** Whether connection is metered */
  isMeteredConnection: boolean;
}

export interface QualitySelectionResult {
  /** Final resolved quality */
  quality: Quality;
  /** Reason for this selection (for debugging/logging) */
  reason: string;
  /** Whether quality was constrained (vs auto/optimal) */
  isConstrained: boolean;
  /** Whether user override is in effect */
  isManualOverride: boolean;
}

/**
 * Quality hierarchy for constraints (lower values = lower quality)
 */
const QUALITY_HIERARCHY: Record<Quality, number> = {
  '1080p': 5,
  '720p': 4,
  '480p': 3,
  '360p': 2,
  '240p': 1,
  'auto': 0, // 'auto' is not hierarchical, acts as "no constraint"
};

/**
 * Determine final quality based on precedence rules:
 * 1. If user manually selected a quality, use it (highest priority)
 * 2. If connection-aware cap exists, use the most restrictive of (manual, cap)
 * 3. Fall back to ABR or default auto
 */
export function resolveQuality(context: QualitySelectionContext): QualitySelectionResult {
  // Case 1: Manual override is present
  if (context.manualSelection && context.manualSelection !== 'auto') {
    return {
      quality: context.manualSelection,
      reason: `Manual selection: ${context.manualSelection}`,
      isConstrained: false,
      isManualOverride: true,
    };
  }

  // Case 2: Connection cap exists (saveData or metered connection)
  if (context.connectionCap && context.connectionCap !== 'auto') {
    return {
      quality: context.connectionCap,
      reason: `Connection-aware cap: ${context.connectionCap} (${
        context.saveDataEnabled ? 'saveData enabled' : 'metered connection'
      })`,
      isConstrained: true,
      isManualOverride: false,
    };
  }

  // Case 3: Use ABR if available
  if (context.abrSelection && context.abrSelection !== 'auto') {
    return {
      quality: context.abrSelection,
      reason: `Adaptive bitrate: ${context.abrSelection}`,
      isConstrained: false,
      isManualOverride: false,
    };
  }

  // Case 4: Default to auto (no constraints)
  return {
    quality: 'auto',
    reason: 'Adaptive bitrate (auto)',
    isConstrained: false,
    isManualOverride: false,
  };
}

/**
 * Apply the most restrictive quality constraint
 * Useful for combining manual override with connection cap
 */
export function getMostRestrictiveQuality(...qualities: (Quality | undefined)[]): Quality {
  const validQualities = qualities.filter(
    (q): q is Quality => q !== undefined && q !== 'auto'
  );

  if (validQualities.length === 0) {
    return 'auto';
  }

  // Find the quality with the lowest hierarchy value (most restrictive)
  return validQualities.reduce((most, current) => {
    const mostValue = QUALITY_HIERARCHY[most];
    const currentValue = QUALITY_HIERARCHY[current];
    return currentValue < mostValue ? current : most;
  });
}

/**
 * Validate if a quality is a valid MuxPlayer value
 * MuxPlayer expects specific quality strings or 'auto'
 */
export function isMuxPlayerQuality(quality: Quality): boolean {
  return ['auto', '1080p', '720p', '480p', '360p', '240p'].includes(quality);
}

/**
 * Convert quality string to MuxPlayer maxResolution format
 * (Mux uses format like "1080p", "720p", etc., or "auto")
 */
export function toMuxQuality(quality: Quality): string {
  return quality === 'auto' ? 'auto' : quality;
}

/**
 * Log quality selection for debugging
 */
export function logQualitySelection(result: QualitySelectionResult, context?: QualitySelectionContext): void {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[Quality Selection]', {
      final: result.quality,
      reason: result.reason,
      isConstrained: result.isConstrained,
      isManualOverride: result.isManualOverride,
      context,
    });
  }
}
