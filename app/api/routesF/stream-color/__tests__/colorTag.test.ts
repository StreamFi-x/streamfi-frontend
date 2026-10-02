import { isValidHexColor, getColorTag, setColorTag, deleteColorTag } from '../colorData';

describe('isValidHexColor', () => {
  it('accepts 6-digit hex with #', () => {
    expect(isValidHexColor('#FF5733')).toBe(true);
    expect(isValidHexColor('#aabbcc')).toBe(true);
    expect(isValidHexColor('#AABBCC')).toBe(true);
  });

  it('accepts 3-digit hex with #', () => {
    expect(isValidHexColor('#FFF')).toBe(true);
    expect(isValidHexColor('#abc')).toBe(true);
    expect(isValidHexColor('#ABC')).toBe(true);
  });

  it('rejects hex without #', () => {
    expect(isValidHexColor('FF5733')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidHexColor('')).toBe(false);
  });

  it('rejects invalid hex characters', () => {
    expect(isValidHexColor('#GG5733')).toBe(false);
    expect(isValidHexColor('#12345')).toBe(false);
    expect(isValidHexColor('#1234567')).toBe(false);
  });
});

describe('setColorTag', () => {
  it('sets a new color tag and returns it', () => {
    const tag = setColorTag('test-stream-1', '#FF0000');
    expect(tag.streamId).toBe('test-stream-1');
    expect(tag.colorHex).toBe('#FF0000');
    expect(tag.createdAt).toBeDefined();
  });

  it('overwrites an existing tag', () => {
    setColorTag('test-stream-2', '#00FF00');
    const updated = setColorTag('test-stream-2', '#0000FF');
    expect(updated.colorHex).toBe('#0000FF');
  });

  it('makes tag retrievable via getColorTag', () => {
    setColorTag('test-stream-3', '#FF00FF');
    const retrieved = getColorTag('test-stream-3');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.colorHex).toBe('#FF00FF');
  });
});

describe('deleteColorTag', () => {
  it('deletes an existing tag', () => {
    setColorTag('test-delete-stream', '#123456');
    const deleted = deleteColorTag('test-delete-stream');
    expect(deleted).toBe(true);
    expect(getColorTag('test-delete-stream')).toBeNull();
  });

  it('returns false for non-existent tag', () => {
    const deleted = deleteColorTag('non-existent-stream');
    expect(deleted).toBe(false);
  });
});

describe('getColorTag', () => {
  it('returns null for non-existent stream', () => {
    const tag = getColorTag('non-existent-stream');
    expect(tag).toBeNull();
  });

  it('returns seed tag for stream-1', () => {
    const tag = getColorTag('stream-1');
    expect(tag).not.toBeNull();
    expect(tag!.colorHex).toBe('#FF5733');
  });
});