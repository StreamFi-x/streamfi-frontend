/**
 * Tests for video quality selection logic
 * Covers precedence rules, constraint application, and edge cases
 */

import {
  resolveQuality,
  getMostRestrictiveQuality,
  isMuxPlayerQuality,
  toMuxQuality,
  type QualitySelectionContext,
  type Quality,
} from '@/lib/video/quality-selection';

describe('Quality Selection Logic', () => {
  describe('resolveQuality', () => {
    it('should prioritize manual selection over all constraints', () => {
      const context: QualitySelectionContext = {
        manualSelection: '1080p',
        connectionCap: '360p',
        saveDataEnabled: true,
        isMeteredConnection: true,
      };

      const result = resolveQuality(context);

      expect(result.quality).toBe('1080p');
      expect(result.isManualOverride).toBe(true);
      expect(result.isConstrained).toBe(false);
      expect(result.reason).toContain('Manual selection');
    });

    it('should apply connection cap when no manual selection', () => {
      const context: QualitySelectionContext = {
        connectionCap: '480p',
        saveDataEnabled: true,
        isMeteredConnection: false,
      };

      const result = resolveQuality(context);

      expect(result.quality).toBe('480p');
      expect(result.isManualOverride).toBe(false);
      expect(result.isConstrained).toBe(true);
      expect(result.reason).toContain('Connection-aware cap');
    });

    it('should use ABR selection when no constraints', () => {
      const context: QualitySelectionContext = {
        abrSelection: '720p',
        saveDataEnabled: false,
        isMeteredConnection: false,
      };

      const result = resolveQuality(context);

      expect(result.quality).toBe('720p');
      expect(result.isManualOverride).toBe(false);
      expect(result.isConstrained).toBe(false);
      expect(result.reason).toContain('Adaptive bitrate');
    });

    it('should default to auto when no constraints or ABR', () => {
      const context: QualitySelectionContext = {
        saveDataEnabled: false,
        isMeteredConnection: false,
      };

      const result = resolveQuality(context);

      expect(result.quality).toBe('auto');
      expect(result.isConstrained).toBe(false);
      expect(result.reason).toContain('Adaptive bitrate (auto)');
    });

    it('should ignore auto manual selection and use cap instead', () => {
      const context: QualitySelectionContext = {
        manualSelection: 'auto',
        connectionCap: '480p',
        saveDataEnabled: true,
        isMeteredConnection: false,
      };

      const result = resolveQuality(context);

      expect(result.quality).toBe('480p');
      expect(result.isManualOverride).toBe(false);
      expect(result.isConstrained).toBe(true);
    });

    it('should apply cap with saveData enabled', () => {
      const context: QualitySelectionContext = {
        connectionCap: '360p',
        saveDataEnabled: true,
        isMeteredConnection: false,
      };

      const result = resolveQuality(context);

      expect(result.quality).toBe('360p');
      expect(result.isConstrained).toBe(true);
      expect(result.reason).toContain('saveData enabled');
    });

    it('should apply cap with metered connection', () => {
      const context: QualitySelectionContext = {
        connectionCap: '480p',
        saveDataEnabled: false,
        isMeteredConnection: true,
      };

      const result = resolveQuality(context);

      expect(result.quality).toBe('480p');
      expect(result.isConstrained).toBe(true);
      expect(result.reason).toContain('metered connection');
    });

    it('should respect manual override even with saveData', () => {
      const context: QualitySelectionContext = {
        manualSelection: '720p',
        connectionCap: '360p',
        saveDataEnabled: true,
        isMeteredConnection: true,
      };

      const result = resolveQuality(context);

      // Manual override takes precedence
      expect(result.quality).toBe('720p');
      expect(result.isManualOverride).toBe(true);
    });
  });

  describe('getMostRestrictiveQuality', () => {
    it('should return the most restrictive of multiple qualities', () => {
      expect(getMostRestrictiveQuality('1080p', '480p', '720p')).toBe('480p');
    });

    it('should ignore auto in comparison', () => {
      expect(getMostRestrictiveQuality('auto', '720p', '480p')).toBe('480p');
    });

    it('should handle undefined values', () => {
      expect(getMostRestrictiveQuality('720p', undefined, '480p')).toBe('480p');
    });

    it('should return auto when all are undefined or auto', () => {
      expect(getMostRestrictiveQuality(undefined, 'auto', undefined)).toBe('auto');
    });

    it('should return auto when array is empty', () => {
      expect(getMostRestrictiveQuality()).toBe('auto');
    });

    it('should correctly order all qualities from high to low bandwidth', () => {
      const qualities: Quality[] = ['240p', '360p', '480p', '720p', '1080p'];
      
      // 240p should always be most restrictive
      expect(getMostRestrictiveQuality(...qualities)).toBe('240p');
      
      // 480p should be most restrictive when excluding 240p and 360p
      expect(getMostRestrictiveQuality('1080p', '720p', '480p')).toBe('480p');
    });
  });

  describe('isMuxPlayerQuality', () => {
    it('should validate all valid MuxPlayer qualities', () => {
      const validQualities: Quality[] = ['auto', '1080p', '720p', '480p', '360p', '240p'];
      
      validQualities.forEach(quality => {
        expect(isMuxPlayerQuality(quality)).toBe(true);
      });
    });
  });

  describe('toMuxQuality', () => {
    it('should return the quality string unchanged', () => {
      expect(toMuxQuality('auto')).toBe('auto');
      expect(toMuxQuality('720p')).toBe('720p');
      expect(toMuxQuality('480p')).toBe('480p');
    });

    it('should handle all quality types', () => {
      const qualities: Quality[] = ['auto', '1080p', '720p', '480p', '360p', '240p'];
      
      qualities.forEach(quality => {
        expect(toMuxQuality(quality)).toBe(quality);
      });
    });
  });

  describe('Edge cases and ambiguous scenarios', () => {
    it('should handle conflicting manual override vs connection cap gracefully', () => {
      const context: QualitySelectionContext = {
        manualSelection: '240p', // User explicitly chose lowest
        connectionCap: '1080p',  // Connection cap says high is OK
        saveDataEnabled: true,
        isMeteredConnection: true,
      };

      const result = resolveQuality(context);

      // Manual override takes precedence even if more restrictive than cap
      expect(result.quality).toBe('240p');
      expect(result.isManualOverride).toBe(true);
    });

    it('should handle user trying to override with higher quality than cap', () => {
      const context: QualitySelectionContext = {
        manualSelection: '1080p',
        connectionCap: '360p',
        saveDataEnabled: false,
        isMeteredConnection: true,
      };

      const result = resolveQuality(context);

      // Manual override is respected (system trusts user's choice)
      expect(result.quality).toBe('1080p');
      expect(result.isManualOverride).toBe(true);
    });

    it('should detect constraints from both saveData and metered connection', () => {
      const context: QualitySelectionContext = {
        connectionCap: '480p',
        saveDataEnabled: true,
        isMeteredConnection: true,
      };

      const result = resolveQuality(context);

      expect(result.isConstrained).toBe(true);
      expect(result.reason).toContain('saveData enabled');
    });

    it('should provide clear reason for each selection type', () => {
      // Manual selection
      let result = resolveQuality({
        manualSelection: '720p',
        saveDataEnabled: false,
        isMeteredConnection: false,
      });
      expect(result.reason).toContain('Manual');

      // Connection cap
      result = resolveQuality({
        connectionCap: '480p',
        saveDataEnabled: true,
        isMeteredConnection: false,
      });
      expect(result.reason).toContain('Connection-aware');

      // ABR
      result = resolveQuality({
        abrSelection: '720p',
        saveDataEnabled: false,
        isMeteredConnection: false,
      });
      expect(result.reason).toContain('Adaptive bitrate');

      // Auto
      result = resolveQuality({
        saveDataEnabled: false,
        isMeteredConnection: false,
      });
      expect(result.reason).toContain('auto');
    });
  });
});
