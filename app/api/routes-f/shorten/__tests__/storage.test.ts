/**
 * @jest-environment jsdom
 */

import { UrlStorage } from '../_lib/storage';
import type { UrlEntry } from '../_lib/types';

describe('URL Storage', () => {
  beforeEach(() => {
    UrlStorage.clear();
  });

  describe('set', () => {
    it('should store a URL entry', () => {
      UrlStorage.set('abc123', 'https://example.com');
      
      const entry = UrlStorage.get('abc123');
      expect(entry).toBeDefined();
      expect(entry!.url).toBe('https://example.com');
      expect(entry!.hits).toBe(0);
      expect(entry!.createdAt).toBeInstanceOf(Date);
    });

    it('should overwrite existing entry', () => {
      UrlStorage.set('abc123', 'https://first.com');
      UrlStorage.set('abc123', 'https://second.com');
      
      const entry = UrlStorage.get('abc123');
      expect(entry!.url).toBe('https://second.com');
    });
  });

  describe('get', () => {
    it('should return stored entry', () => {
      UrlStorage.set('abc123', 'https://example.com');
      
      const entry = UrlStorage.get('abc123');
      expect(entry).toBeDefined();
      expect(entry!.url).toBe('https://example.com');
    });

    it('should return undefined for non-existent code', () => {
      const entry = UrlStorage.get('nonexistent');
      expect(entry).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing code', () => {
      UrlStorage.set('abc123', 'https://example.com');
      
      expect(UrlStorage.has('abc123')).toBe(true);
    });

    it('should return false for non-existent code', () => {
      expect(UrlStorage.has('nonexistent')).toBe(false);
    });
  });

  describe('incrementHits', () => {
    it('should increment hit count and return entry', () => {
      UrlStorage.set('abc123', 'https://example.com');
      
      const entry = UrlStorage.incrementHits('abc123');
      expect(entry).toBeDefined();
      expect(entry!.hits).toBe(1);
      
      const storedEntry = UrlStorage.get('abc123');
      expect(storedEntry!.hits).toBe(1);
    });

    it('should handle multiple increments', () => {
      UrlStorage.set('abc123', 'https://example.com');
      
      UrlStorage.incrementHits('abc123');
      UrlStorage.incrementHits('abc123');
      UrlStorage.incrementHits('abc123');
      
      const entry = UrlStorage.get('abc123');
      expect(entry!.hits).toBe(3);
    });

    it('should return undefined for non-existent code', () => {
      const entry = UrlStorage.incrementHits('nonexistent');
      expect(entry).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all stored entries', () => {
      UrlStorage.set('abc123', 'https://first.com');
      UrlStorage.set('def456', 'https://second.com');
      
      const allEntries = UrlStorage.getAll();
      expect(allEntries.size).toBe(2);
      expect(allEntries.has('abc123')).toBe(true);
      expect(allEntries.has('def456')).toBe(true);
      expect(allEntries.get('abc123')!.url).toBe('https://first.com');
      expect(allEntries.get('def456')!.url).toBe('https://second.com');
    });

    it('should return empty map when no entries exist', () => {
      const allEntries = UrlStorage.getAll();
      expect(allEntries.size).toBe(0);
    });

    it('should return a copy (modifications should not affect original)', () => {
      UrlStorage.set('abc123', 'https://example.com');
      
      const allEntries = UrlStorage.getAll();
      allEntries.clear();
      
      expect(UrlStorage.getAll().size).toBe(1);
      expect(UrlStorage.has('abc123')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      UrlStorage.set('abc123', 'https://first.com');
      UrlStorage.set('def456', 'https://second.com');
      
      expect(UrlStorage.size()).toBe(2);
      
      UrlStorage.clear();
      
      expect(UrlStorage.size()).toBe(0);
      expect(UrlStorage.get('abc123')).toBeUndefined();
      expect(UrlStorage.get('def456')).toBeUndefined();
    });
  });

  describe('size', () => {
    it('should return 0 for empty storage', () => {
      expect(UrlStorage.size()).toBe(0);
    });

    it('should return correct count after adding entries', () => {
      UrlStorage.set('abc123', 'https://first.com');
      expect(UrlStorage.size()).toBe(1);
      
      UrlStorage.set('def456', 'https://second.com');
      expect(UrlStorage.size()).toBe(2);
    });

    it('should maintain count after overwriting existing entry', () => {
      UrlStorage.set('abc123', 'https://first.com');
      expect(UrlStorage.size()).toBe(1);
      
      UrlStorage.set('abc123', 'https://second.com');
      expect(UrlStorage.size()).toBe(1);
    });
  });

  describe('data persistence', () => {
    it('should maintain data integrity across operations', () => {
      const code = 'abc123';
      const url = 'https://example.com';
      
      // Store entry
      UrlStorage.set(code, url);
      
      // Verify initial state
      let entry = UrlStorage.get(code);
      expect(entry!.url).toBe(url);
      expect(entry!.hits).toBe(0);
      
      // Increment hits
      UrlStorage.incrementHits(code);
      entry = UrlStorage.get(code);
      expect(entry!.hits).toBe(1);
      
      // Increment again
      UrlStorage.incrementHits(code);
      entry = UrlStorage.get(code);
      expect(entry!.hits).toBe(2);
      
      // Verify URL hasn't changed
      expect(entry!.url).toBe(url);
      expect(entry!.createdAt).toBeInstanceOf(Date);
    });
  });
});
