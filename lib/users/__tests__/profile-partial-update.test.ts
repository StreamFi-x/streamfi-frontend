// lib/users/__tests__/profile-partial-update.test.ts
/**
 * Jest unit tests for profile-partial-update utilities.
 */
import { normalizeSocialLinksRecord, computeProfilePatch, detectFieldConflicts, ProfileSnapshot } from "../../users/profile-partial-update";

describe('normalizeSocialLinksRecord', () => {
  test('null input returns empty object', () => {
    expect(normalizeSocialLinksRecord(null)).toEqual({});
  });

  test('plain object maps strings directly', () => {
    const input = { twitter: 'https://t.co/a', github: 'https://github.com/b' };
    expect(normalizeSocialLinksRecord(input)).toEqual(input);
  });

  test('array of link objects converts correctly', () => {
    const input = [
      { platform: 'twitter', url: 'https://t.co/a' },
      { platform: 'github', socialLink: 'https://github.com/b' },
    ];
    expect(normalizeSocialLinksRecord(input)).toEqual({
      twitter: 'https://t.co/a',
      github: 'https://github.com/b',
    });
  });

  test('JSON string of object parses', () => {
    const json = JSON.stringify({ linkedin: 'https://lnkd.in/x' });
    expect(normalizeSocialLinksRecord(json)).toEqual({ linkedin: 'https://lnkd.in/x' });
  });

  test('JSON string of array parses', () => {
    const json = JSON.stringify([
      { platform: 'twitter', url: 'https://t.co/a' },
    ]);
    expect(normalizeSocialLinksRecord(json)).toEqual({ twitter: 'https://t.co/a' });
  });
});

describe('computeProfilePatch', () => {
  const base: ProfileSnapshot = {
    username: 'alice',
    bio: 'hello',
    socialLinks: { twitter: 't.co/a' },
    avatar: null,
    banner: null,
    updatedAt: '2023-01-01T00:00:00Z',
  };

  test('bio only change', () => {
    const current = { ...base, bio: 'new bio' };
    const { patch, changedFields, hasChanges } = computeProfilePatch(base, current);
    expect(patch).toEqual({ bio: 'new bio' });
    expect(changedFields).toEqual(['bio']);
    expect(hasChanges).toBe(true);
  });

  test('socialLinks only change', () => {
    const current = { ...base, socialLinks: { twitter: 't.co/a', github: 'g.co/b' } };
    const { patch, changedFields, hasChanges } = computeProfilePatch(base, current);
    expect(patch).toEqual({ socialLinks: { twitter: 't.co/a', github: 'g.co/b' } });
    expect(changedFields).toEqual(['socialLinks']);
    expect(hasChanges).toBe(true);
  });

  test('avatar only change with File placeholder', () => {
    const fakeFile = new File([new Blob()], 'avatar.png');
    const current = { ...base, avatar: fakeFile };
    const { patch, changedFields, hasChanges } = computeProfilePatch(base, current);
    expect(patch.avatar).toBe(fakeFile);
    expect(changedFields).toEqual(['avatar']);
    expect(hasChanges).toBe(true);
  });

  test('username only change', () => {
    const current = { ...base, username: 'bob' };
    const { patch, changedFields, hasChanges } = computeProfilePatch(base, current);
    expect(patch).toEqual({ username: 'bob' });
    expect(changedFields).toEqual(['username']);
    expect(hasChanges).toBe(true);
  });

  test('clear bio to empty string', () => {
    const current = { ...base, bio: '' };
    const { patch } = computeProfilePatch(base, current);
    expect(patch.bio).toBe('');
  });

  test('clear socialLinks to empty object', () => {
    const current = { ...base, socialLinks: {} };
    const { patch } = computeProfilePatch(base, current);
    expect(patch.socialLinks).toEqual({});
  });

  test('no changes yields hasChanges false', () => {
    const { hasChanges, changedFields, patch } = computeProfilePatch(base, base);
    expect(hasChanges).toBe(false);
    expect(changedFields).toEqual([]);
    expect(patch).toEqual({});
  });
});

describe('detectFieldConflicts', () => {
  const serverRow = { updated_at: '2023-01-02T00:00:00Z', bio: 'old', username: 'alice' };

  test('matching expectedUpdatedAt yields no conflicts', () => {
    const conflicts = detectFieldConflicts({
      serverRow,
      incomingFields: ['bio'],
      expectedUpdatedAt: '2023-01-02T00:00:00Z',
      baseValues: { bio: 'old' },
    });
    expect(conflicts).toEqual([]);
  });

  test('timestamp mismatch and different server value reports conflict', () => {
    const conflicts = detectFieldConflicts({
      serverRow,
      incomingFields: ['bio'],
      expectedUpdatedAt: '2023-01-01T00:00:00Z',
      baseValues: { bio: 'old' },
    });
    // serverRow.bio unchanged from base, so no conflict for bio
    expect(conflicts).toEqual([]);
  });

  test('conflict when server value diverged from base', () => {
    const conflicts = detectFieldConflicts({
      serverRow: { ...serverRow, bio: 'different' },
      incomingFields: ['bio'],
      expectedUpdatedAt: '2023-01-01T00:00:00Z',
      baseValues: { bio: 'old' },
    });
    expect(conflicts).toEqual(['bio']);
  });

  test('all incoming fields flagged when baseValues missing', () => {
    const conflicts = detectFieldConflicts({
      serverRow,
      incomingFields: ['bio', 'username'],
      expectedUpdatedAt: '2023-01-01T00:00:00Z',
    });
    expect(conflicts.sort()).toEqual(['bio', 'username'].sort());
  });

  test('no expectedUpdatedAt = no conflicts', () => {
    const conflicts = detectFieldConflicts({
      serverRow,
      incomingFields: ['bio'],
    });
    expect(conflicts).toEqual([]);
  });
});
