/**
 * Hook for detecting network connection quality and constraints
 * Uses the Network Information API (navigator.connection) where available
 * to proactively adjust video quality based on connection characteristics
 * 
 * Supports:
 * - saveData detection (user explicitly opted into data-saving mode)
 * - Connection type detection (4g, 3g, 2g, slow-2g, wifi)
 * - Effective bandwidth estimation
 * - Graceful fallback for unsupported browsers
 */

import { useEffect, useState, useCallback } from 'react';

export type ConnectionType = '4g' | '3g' | '2g' | 'slow-2g' | 'wifi' | 'unknown';

export interface NetworkQualityInfo {
  /** Whether the browser's Network Information API is available */
  isSupported: boolean;
  /** User has explicitly opted into data-saving mode */
  saveData: boolean;
  /** Detected connection type */
  connectionType: ConnectionType;
  /** Whether this is a metered/limited connection */
  isMetered: boolean;
  /** Effective bandwidth in Mbps (estimated or measured) */
  effectiveBandwidth: number | null;
  /** Recommended maximum quality based on connection */
  recommendedQuality: 'auto' | '720p' | '480p' | '360p' | '240p';
  /** Is the connection likely under constraint */
  isConstrained: boolean;
}

/**
 * Mapping from connection types to recommended quality levels
 * Based on typical bandwidth requirements for video streaming
 */
const QUALITY_BY_CONNECTION: Record<ConnectionType, 'auto' | '720p' | '480p' | '360p' | '240p'> = {
  '4g': 'auto',      // ~10-30 Mbps typical
  'wifi': 'auto',    // Varies widely, assume reasonable
  '3g': '480p',      // ~1-3 Mbps
  '2g': '360p',      // ~0.1-0.5 Mbps
  'slow-2g': '240p', // ~0.05 Mbps
  'unknown': 'auto', // Unknown, use adaptive bitrate
};

/**
 * Conservative bandwidth thresholds for quality recommendations
 */
const BANDWIDTH_THRESHOLDS = {
  hd: 5,      // 5 Mbps for 720p+
  sd: 2,      // 2 Mbps for 480p
  low: 1,     // 1 Mbps for 360p
  veryLow: 0.5, // 0.5 Mbps for 240p
};

export function useNetworkQuality(): NetworkQualityInfo {
  const [networkInfo, setNetworkInfo] = useState<NetworkQualityInfo>({
    isSupported: false,
    saveData: false,
    connectionType: 'unknown',
    isMetered: false,
    effectiveBandwidth: null,
    recommendedQuality: 'auto',
    isConstrained: false,
  });

  const updateNetworkInfo = useCallback(() => {
    if (typeof navigator === 'undefined') {
      return;
    }

    // Check if Network Information API is available
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    if (!connection) {
      // API not available - return default unconstrained settings
      setNetworkInfo(prev => ({
        ...prev,
        isSupported: false,
      }));
      return;
    }

    // API is available
    const saveData = connection.saveData || false;
    const connectionType: ConnectionType = (connection.effectiveType || 'unknown') as ConnectionType;
    const isMetered = connection.saveData || 
                      connectionType === '2g' || 
                      connectionType === 'slow-2g' ||
                      connectionType === '3g';

    // Get effective bandwidth if available (downlink in Mbps)
    const effectiveBandwidth = connection.downlink || null;

    // Determine if connection is constrained
    const isConstrained = saveData || isMetered || effectiveBandwidth !== null && effectiveBandwidth < BANDWIDTH_THRESHOLDS.sd;

    // Determine recommended quality
    let recommendedQuality: 'auto' | '720p' | '480p' | '360p' | '240p' = 'auto';

    if (saveData) {
      // If saveData is set, be conservative
      if (effectiveBandwidth !== null) {
        if (effectiveBandwidth >= BANDWIDTH_THRESHOLDS.hd) {
          recommendedQuality = '720p';
        } else if (effectiveBandwidth >= BANDWIDTH_THRESHOLDS.sd) {
          recommendedQuality = '480p';
        } else if (effectiveBandwidth >= BANDWIDTH_THRESHOLDS.low) {
          recommendedQuality = '360p';
        } else {
          recommendedQuality = '240p';
        }
      } else {
        // No bandwidth info, use connection type
        recommendedQuality = QUALITY_BY_CONNECTION[connectionType] || '480p';
      }
    } else {
      // Normal mode: use connection type primarily
      recommendedQuality = QUALITY_BY_CONNECTION[connectionType] || 'auto';
    }

    setNetworkInfo({
      isSupported: true,
      saveData,
      connectionType,
      isMetered,
      effectiveBandwidth,
      recommendedQuality,
      isConstrained,
    });
  }, []);

  useEffect(() => {
    // Initial check
    updateNetworkInfo();

    // Listen for connection changes
    if (typeof navigator !== 'undefined') {
      const connection = (navigator as any).connection ||
                        (navigator as any).mozConnection ||
                        (navigator as any).webkitConnection;

      if (connection) {
        connection.addEventListener('change', updateNetworkInfo);
        return () => {
          connection.removeEventListener('change', updateNetworkInfo);
        };
      }
    }
  }, [updateNetworkInfo]);

  return networkInfo;
}

/**
 * Get a human-readable description of the current network status
 */
export function getNetworkStatusDescription(info: NetworkQualityInfo): string {
  if (!info.isSupported) {
    return 'Network information not available in this browser';
  }

  const parts: string[] = [];

  if (info.saveData) {
    parts.push('Data Saver mode enabled');
  }

  parts.push(`Connection: ${info.connectionType}`);

  if (info.effectiveBandwidth !== null) {
    parts.push(`Bandwidth: ~${info.effectiveBandwidth.toFixed(1)} Mbps`);
  }

  if (info.isMetered) {
    parts.push('(metered/limited)');
  }

  return parts.join(' • ');
}

/**
 * Determine if quality should be capped based on network info
 * Returns null if no constraint, or the max recommended quality
 */
export function getMaxQualityForNetwork(info: NetworkQualityInfo): 'auto' | '720p' | '480p' | '360p' | '240p' | null {
  if (info.saveData || info.isMetered) {
    return info.recommendedQuality;
  }
  return null;
}
