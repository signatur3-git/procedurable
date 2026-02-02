/**
 * MetadataStore Tests (B3-001)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import {
  MetadataStore,
  MetadataNotFoundError,
  InvalidKeyError
} from '../../storage/MetadataStore';

describe('MetadataStore (B3-001)', () => {
  const testDir = './test-metadata-temp';
  let store: MetadataStore;

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    store = new MetadataStore({ rootDir: testDir });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('set and get', () => {
    it('should store and retrieve a simple value', async () => {
      await store.set('test-key', { name: 'Test', value: 42 });
      const entry = await store.get('test-key');
      expect(entry.key).toBe('test-key');
      expect(entry.value).toEqual({ name: 'Test', value: 42 });
    });

    it('should store and retrieve a namespaced key', async () => {
      await store.set('styles/modern', { colors: ['#fff'] });
      const entry = await store.get('styles/modern');
      expect(entry.key).toBe('styles/modern');
    });

    it('should throw MetadataNotFoundError for non-existent key', async () => {
      await expect(store.get('nonexistent')).rejects.toThrow(MetadataNotFoundError);
    });

    it('should preserve description and tags', async () => {
      await store.set('test', { foo: 'bar' }, {
        description: 'A test entry',
        tags: ['test', 'example']
      });
      const entry = await store.get('test');
      expect(entry.description).toBe('A test entry');
      expect(entry.tags).toEqual(['test', 'example']);
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      await store.set('exists-test', { value: 1 });
      expect(await store.exists('exists-test')).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      expect(await store.exists('does-not-exist')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete an existing entry', async () => {
      await store.set('to-delete', { value: 1 });
      await store.delete('to-delete');
      expect(await store.exists('to-delete')).toBe(false);
    });

    it('should throw when deleting non-existent key', async () => {
      await expect(store.delete('nonexistent')).rejects.toThrow(MetadataNotFoundError);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await store.set('styles/modern', { theme: 'modern' });
      await store.set('styles/rustic', { theme: 'rustic' });
      await store.set('rules/clearance', { min: 0.5 });
    });

    it('should list all keys', async () => {
      const result = await store.list();
      expect(result.total).toBe(3);
    });

    it('should filter by prefix', async () => {
      const result = await store.list({ prefix: 'styles/' });
      expect(result.total).toBe(2);
    });

    it('should limit results', async () => {
      const result = await store.list({ limit: 2 });
      expect(result.keys).toHaveLength(2);
    });

    it('should return sorted keys', async () => {
      const result = await store.list();
      const sorted = [...result.keys].sort();
      expect(result.keys).toEqual(sorted);
    });
  });

  describe('getAll', () => {
    it('should get all entries matching a prefix', async () => {
      await store.set('data/a', { value: 1 });
      await store.set('data/b', { value: 2 });
      await store.set('other/c', { value: 3 });

      const entries = await store.getAll('data/');
      expect(entries).toHaveLength(2);
    });
  });

  describe('key validation', () => {
    it('should accept valid namespaced key', async () => {
      await expect(store.set('namespace/key', { v: 1 })).resolves.not.toThrow();
    });

    it('should reject empty key', async () => {
      await expect(store.set('', { v: 1 })).rejects.toThrow(InvalidKeyError);
    });

    it('should reject key with double slashes', async () => {
      await expect(store.set('a//b', { v: 1 })).rejects.toThrow(InvalidKeyError);
    });

    it('should reject key starting with slash', async () => {
      await expect(store.set('/leading', { v: 1 })).rejects.toThrow(InvalidKeyError);
    });
  });

  describe('value types', () => {
    it('should store complex nested objects', async () => {
      const complex = { name: 'Style', colors: { primary: '#fff' } };
      await store.set('complex', complex);
      const entry = await store.get('complex');
      expect(entry.value).toEqual(complex);
    });

    it('should store arrays', async () => {
      await store.set('array', [1, 2, 3]);
      const entry = await store.get('array');
      expect(entry.value).toEqual([1, 2, 3]);
    });
  });
});
