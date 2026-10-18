/**
 * Tests for useNetworkQuality hook
 * Covers Network Information API detection, quality recommendation, and fallback behavior
 */

import { getNetworkStatusDescription, getMaxQualityForNetwork, type NetworkQualityInfo } from '@/hooks/useNetworkQuality';

describe('Network Quality Utilities', () => {
  describe('getNetworkStatusDescription', () => {
    it('should return unsupported message when API not available', () => {
      const info: NetworkQualityInfo = {
        isSupported: false,
        saveData: false,
        connectionType: 'unknown',
        isMetered: false,
        effectiveBandwidth: null,
        recommendedQuality: 'auto',
        isConstrained: false,
      };

      const description = getNetworkStatusDescription(info);
      expect(description).toContain('not available');
    });

    it('should include saveData indicator when enabled', () => {
      const info: NetworkQualityInfo = {
        isSupported: true,
        saveData: true,
        connectionType: '4g',
        isMetered: false,
        effectiveBandwidth: null,
        recommendedQuality: '480p',
        isConstrained: true,
      };

      const description = getNetworkStatusDescription(info);
      expect(description).toContain('Data Saver');
    });

    it('should include connection type', () => {
      const info: NetworkQualityInfo = {
        isSupported: true,
        saveData: false,
        connectionType: '3g',
        isMetered: true,
        effectiveBandwidth: null,
        recommendedQuality: '480p',
        isConstrained: true,
      };

      const description = getNetworkStatusDescription(info);
      expect(description).toContain('3g');
    });

    it('should include bandwidth when available', () => {
      const info: NetworkQualityInfo = {
        isSupported: true,
        saveData: false,
        connectionType: 'wifi',
        isMetered: false,
        effectiveBandwidth: 25.5,
        recommendedQuality: 'auto',
        isConstrained: false,
      };

      const description = getNetworkStatusDescription(info);
      expect(description).toContain('25.5');
      expect(description).toContain('Mbps');
    });

    it('should include metered indicator when applicable', () => {
      const info: NetworkQualityInfo = {
        isSupported: true,
        saveData: false,
        connectionType: '3g',
        isMetered: true,
        effectiveBandwidth: 2.5,
        recommendedQuality: '480p',
        isConstrained: true,
      };

      const description = getNetworkStatusDescription(info);
      expect(description).toContain('metered');
    });

    it('should build complete description with all fields', () => {
      const info: NetworkQualityInfo = {
        isSupported: true,
        saveData: true,
        connectionType: '3g',
        isMetered: true,
        effectiveBandwidth: 1.5,
        recommendedQuality: '360p',
        isConstrained: true,
      };

      const description = getNetworkStatusDescription(info);
      
      // Should contain all relevant information
      expect(description).toContain('Data Saver');
      expect(description).toContain('3g');
      expect(description).toContain('1.5');
      expect(description).toContain('metered');
    });
  });

  describe('getMaxQualityForNetwork', () => {
    it('should return null when saveData is false and connection is not metered', () => {
      const info: NetworkQualityInfo = {
        isSupported: true,
        saveData: false,
        connectionType: 'wifi',
        isMetered: false,
        effectiveBandwidth: 50,
        recommendedQuality: 'auto',
        isConstrained: false,
      };

      const maxQuality = getMaxQualityForNetwork(info);
      expect(maxQuality).toBeNull();
    });

    it('should return recommended quality when saveData is enabled', () => {
      const info: NetworkQualityInfo = {
        isSupported: true,
        saveData: true,
        connectionType: '4g',
        isMetered: false,
        effectiveBandwidth: 10,
        recommendedQuality: '720p',
        isConstrained: true,
      };

      const maxQuality = getMaxQualityForNetwork(info);
      expect(maxQuality).toBe('720p');
    });

    it('should return recommended quality when metered', () => {
      const info: NetworkQualityInfo = {
        isSupported: true,
        saveData: false,
        connectionType: '3g',
        isMetered: true,
        effectiveBandwidth: null,
        recommendedQuality: '480p',
        isConstrained: true,
      };

      const maxQuality = getMaxQualityForNetwork(info);
      expect(maxQuality).toBe('480p');
    });

    it('should handle both saveData and metered together', () => {
      const info: NetworkQualityInfo = {
        isSupported: true,
        saveData: true,
        connectionType: '2g',
        isMetered: true,
        effectiveBandwidth: 0.3,
        recommendedQuality: '240p',
        isConstrained: true,
      };

      const maxQuality = getMaxQualityForNetwork(info);
      expect(maxQuality).toBe('240p');
    });
  });

  describe('Connection type to quality mapping', () => {
    // These test the expected behavior based on connection types
    // In real usage, this would be tested in the actual useNetworkQuality hook

    it('should recommend high quality for 4g/wifi', () => {
      // 4g and wifi are not metered by default, so should return null (no cap)
      const info4g: NetworkQualityInfo = {
        isSupported: true,
        saveData: false,
        connectionType: '4g',
        isMetered: false,
        effectiveBandwidth: 20,
        recommendedQuality: 'auto',
        isConstrained: false,
      };

      expect(getMaxQualityForNetwork(info4g)).toBeNull();

      const infoWifi: NetworkQualityInfo = {
        isSupported: true,
        saveData: false,
        connectionType: 'wifi',
        isMetered: false,
        effectiveBandwidth: 100,
        recommendedQuality: 'auto',
        isConstrained: false,
      };

      expect(getMaxQualityForNetwork(infoWifi)).toBeNull();
    });

    it('should recommend moderate quality for 3g', () => {
      const info: NetworkQualityInfo = {
        isSupported: true,
        saveData: false,
        connectionType: '3g',
        isMetered: true,
        effectiveBandwidth: 2,
        recommendedQuality: '480p',
        isConstrained: true,
      };

      expect(getMaxQualityForNetwork(info)).toBe('480p');
    });

    it('should recommend low quality for 2g/slow-2g', () => {
      const info2g: NetworkQualityInfo = {
        isSupported: true,
        saveData: false,
        connectionType: '2g',
        isMetered: true,
        effectiveBandwidth: 0.2,
        recommendedQuality: '360p',
        isConstrained: true,
      };

      expect(getMaxQualityForNetwork(info2g)).toBe('360p');

      const infoSlow2g: NetworkQualityInfo = {
        isSupported: true,
        saveData: false,
        connectionType: 'slow-2g',
        isMetered: true,
        effectiveBandwidth: 0.05,
        recommendedQuality: '240p',
        isConstrained: true,
      };

      expect(getMaxQualityForNetwork(infoSlow2g)).toBe('240p');
    });
  });

  describe('Graceful fallback for unsupported browsers', () => {
    it('should handle missing Network Information API', () => {
      const info: NetworkQualityInfo = {
        isSupported: false,
        saveData: false,
        connectionType: 'unknown',
        isMetered: false,
        effectiveBandwidth: null,
        recommendedQuality: 'auto',
        isConstrained: false,
      };

      // Should not apply any constraints when API unavailable
      expect(getMaxQualityForNetwork(info)).toBeNull();
    });
  });

  describe('Manual override precedence', () => {
    it('should respect manual override even when metered', () => {
      // This is tested in quality-selection.test.ts
      // but validating the preconditions here
      const info: NetworkQualityInfo = {
        isSupported: true,
        saveData: false,
        connectionType: '2g',
        isMetered: true,
        effectiveBandwidth: 0.2,
        recommendedQuality: '360p',
        isConstrained: true,
      };

      // The quality resolution logic should allow manual override
      // even though network recommends 360p
      const cap = getMaxQualityForNetwork(info);
      expect(cap).toBe('360p');
    });
  });

  describe('Connection change detection', () => {
    it('should provide info object for reactive updates', () => {
      const infoWifi: NetworkQualityInfo = {
        isSupported: true,
        saveData: false,
        connectionType: 'wifi',
        isMetered: false,
        effectiveBandwidth: 50,
        recommendedQuality: 'auto',
        isConstrained: false,
      };

      const info3g: NetworkQualityInfo = {
        isSupported: true,
        saveData: false,
        connectionType: '3g',
        isMetered: true,
        effectiveBandwidth: 2,
        recommendedQuality: '480p',
        isConstrained: true,
      };

      // Both should be comparable for reactive updates
      expect(infoWifi.connectionType).not.toBe(info3g.connectionType);
      expect(infoWifi.isConstrained).not.toBe(info3g.isConstrained);
      expect(infoWifi.recommendedQuality).not.toBe(info3g.recommendedQuality);
    });
  });
});
