import {
  __resetQuietHoursStore,
  getConfig,
  setConfig,
  isValidTimezone,
  hourInTimezone,
  isHourInQuietWindow,
  isInQuietHours,
  DEFAULT_CONFIG,
} from './store';

describe('quiet-hours store', () => {
  beforeEach(() => {
    __resetQuietHoursStore();
  });

  describe('getConfig / setConfig', () => {
    it('returns the default config for a viewer with nothing stored', () => {
      expect(getConfig('v1')).toEqual({ viewer_id: 'v1', ...DEFAULT_CONFIG });
    });

    it('returns a stored config after setConfig', () => {
      setConfig('v1', { start_hour: 20, end_hour: 6, timezone: 'UTC', enabled: true });
      expect(getConfig('v1')).toEqual({
        viewer_id: 'v1',
        start_hour: 20,
        end_hour: 6,
        timezone: 'UTC',
        enabled: true,
      });
    });

    it('keeps configs independent per viewer', () => {
      setConfig('v1', { start_hour: 20, end_hour: 6, timezone: 'UTC', enabled: true });
      expect(getConfig('v2')).toEqual({ viewer_id: 'v2', ...DEFAULT_CONFIG });
    });
  });

  describe('isValidTimezone', () => {
    it('accepts a valid IANA timezone', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
    });

    it('rejects a garbage timezone string', () => {
      expect(isValidTimezone('Not/A_Timezone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });
  });

  describe('hourInTimezone', () => {
    it('extracts the correct local hour for a fixed-offset, no-DST zone', () => {
      // 14:00 UTC + 9h (JST has no DST) = 23:00 same day in Tokyo.
      expect(hourInTimezone(new Date('2026-01-15T14:00:00Z'), 'Asia/Tokyo')).toBe(23);
      // 02:00 UTC + 9h = 11:00 same day in Tokyo.
      expect(hourInTimezone(new Date('2026-01-15T02:00:00Z'), 'Asia/Tokyo')).toBe(11);
    });

    it('matches the UTC hour directly for the UTC zone', () => {
      expect(hourInTimezone(new Date('2026-01-15T14:00:00Z'), 'UTC')).toBe(14);
    });
  });

  describe('isHourInQuietWindow', () => {
    it('handles a same-day window normally', () => {
      // 9 -> 17 (daytime quiet, unusual but valid)
      expect(isHourInQuietWindow(9, 9, 17)).toBe(true);
      expect(isHourInQuietWindow(16, 9, 17)).toBe(true);
      expect(isHourInQuietWindow(17, 9, 17)).toBe(false); // end is exclusive
      expect(isHourInQuietWindow(8, 9, 17)).toBe(false);
      expect(isHourInQuietWindow(20, 9, 17)).toBe(false);
    });

    it('handles a window that crosses midnight', () => {
      // 22 -> 8
      expect(isHourInQuietWindow(23, 22, 8)).toBe(true);
      expect(isHourInQuietWindow(0, 22, 8)).toBe(true);
      expect(isHourInQuietWindow(7, 22, 8)).toBe(true);
      expect(isHourInQuietWindow(22, 22, 8)).toBe(true); // start is inclusive
      expect(isHourInQuietWindow(8, 22, 8)).toBe(false); // end is exclusive
      expect(isHourInQuietWindow(12, 22, 8)).toBe(false);
      expect(isHourInQuietWindow(21, 22, 8)).toBe(false);
    });

    it('treats start === end as a full 24h window', () => {
      expect(isHourInQuietWindow(0, 5, 5)).toBe(true);
      expect(isHourInQuietWindow(23, 5, 5)).toBe(true);
    });
  });

  describe('isInQuietHours', () => {
    const baseConfig = { viewer_id: 'v1', start_hour: 22, end_hour: 8, timezone: 'Asia/Tokyo', enabled: true };

    it('is false when the config is disabled, regardless of the time', () => {
      const disabled = { ...baseConfig, enabled: false };
      expect(isInQuietHours(disabled, new Date('2026-01-15T14:00:00Z'))).toBe(false);
    });

    it('is true for an instant that lands in the cross-midnight window in the configured timezone', () => {
      // 14:00 UTC = 23:00 JST -> inside [22, 8)
      expect(isInQuietHours(baseConfig, new Date('2026-01-15T14:00:00Z'))).toBe(true);
    });

    it('is false for an instant that lands outside the window in the configured timezone', () => {
      // 02:00 UTC = 11:00 JST -> outside [22, 8)
      expect(isInQuietHours(baseConfig, new Date('2026-01-15T02:00:00Z'))).toBe(false);
    });

    it('gives a different answer for the same UTC instant under a different timezone', () => {
      // 20:00 UTC = 05:00 JST (inside 22->8) but 20:00 UTC in UTC itself is
      // NOT inside 22->8 -- same instant, different verdicts by timezone.
      const at = new Date('2026-01-15T20:00:00Z');
      const jstConfig = { ...baseConfig, timezone: 'Asia/Tokyo' };
      const utcConfig = { ...baseConfig, timezone: 'UTC' };
      expect(isInQuietHours(jstConfig, at)).toBe(true);
      expect(isInQuietHours(utcConfig, at)).toBe(false);
    });
  });
});
