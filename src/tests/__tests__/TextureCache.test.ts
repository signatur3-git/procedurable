/**
 * TextureCache.test.ts
 *
 * Tests for G6-004: Texture Housekeeping
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { writeFile, rm } from 'fs/promises';
import { join } from 'path';
import {
  TextureCache,
  parseTextureFilename,
  formatBytes,
  formatAge,
  parseDuration
} from '../../storage/TextureCache';

describe('G6-004: Texture Housekeeping', () => {
  const testCacheDir = 'output/test-texture-cache';
  let cache: TextureCache;

  beforeEach(async () => {
    cache = new TextureCache(testCacheDir);
    await cache.ensureDir();
  });

  afterEach(async () => {
    try {
      await rm(testCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('parseTextureFilename', () => {
    it('should parse valid texture filename', () => {
      const result = parseTextureFilename('DiningChair_albedo.png');
      expect(result).toEqual({ builderName: 'DiningChair', channel: 'albedo' });
    });

    it('should parse filename with underscores in builder name', () => {
      const result = parseTextureFilename('My_Cool_Chair_roughness.png');
      expect(result).toEqual({ builderName: 'My_Cool_Chair', channel: 'roughness' });
    });

    it('should handle jpg extension', () => {
      const result = parseTextureFilename('Table_normal.jpg');
      expect(result).toEqual({ builderName: 'Table', channel: 'normal' });
    });

    it('should return null for invalid filename', () => {
      expect(parseTextureFilename('nounderscores.png')).toBeNull();
      expect(parseTextureFilename('file.txt')).toBeNull();
      expect(parseTextureFilename('')).toBeNull();
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    });
  });

  describe('formatAge', () => {
    it('should format age correctly', () => {
      expect(formatAge(30 * 1000)).toBe('30s ago');
      expect(formatAge(5 * 60 * 1000)).toBe('5m ago');
      expect(formatAge(3 * 60 * 60 * 1000)).toBe('3h ago');
      expect(formatAge(2 * 24 * 60 * 60 * 1000)).toBe('2d ago');
    });
  });

  describe('parseDuration', () => {
    it('should parse valid duration strings', () => {
      expect(parseDuration('30s')).toBe(30 * 1000);
      expect(parseDuration('5m')).toBe(5 * 60 * 1000);
      expect(parseDuration('24h')).toBe(24 * 60 * 60 * 1000);
      expect(parseDuration('7d')).toBe(7 * 24 * 60 * 60 * 1000);
      expect(parseDuration('2w')).toBe(2 * 7 * 24 * 60 * 60 * 1000);
    });

    it('should return null for invalid duration', () => {
      expect(parseDuration('invalid')).toBeNull();
      expect(parseDuration('7')).toBeNull();
      expect(parseDuration('d7')).toBeNull();
    });
  });

  describe('TextureCache.listTextures', () => {
    it('should return empty array for empty cache', async () => {
      const textures = await cache.listTextures();
      expect(textures).toEqual([]);
    });

    it('should list texture files', async () => {
      await writeFile(join(testCacheDir, 'Chair_albedo.png'), 'test data');
      await writeFile(join(testCacheDir, 'Chair_roughness.png'), 'more data');

      const textures = await cache.listTextures();
      expect(textures.length).toBe(2);
      expect(textures[0].builderName).toBe('Chair');
      expect(textures[0].channel).toBe('albedo');
      expect(textures[1].channel).toBe('roughness');
    });

    it('should filter by builder name', async () => {
      await writeFile(join(testCacheDir, 'Chair_albedo.png'), 'data1');
      await writeFile(join(testCacheDir, 'Table_albedo.png'), 'data2');

      const textures = await cache.listTextures('Chair');
      expect(textures.length).toBe(1);
      expect(textures[0].builderName).toBe('Chair');
    });

    it('should ignore non-texture files', async () => {
      await writeFile(join(testCacheDir, 'Chair_albedo.png'), 'data');
      await writeFile(join(testCacheDir, 'readme.txt'), 'text');
      await writeFile(join(testCacheDir, 'noformat.png'), 'bad');

      const textures = await cache.listTextures();
      expect(textures.length).toBe(1);
    });
  });

  describe('TextureCache.getSummary', () => {
    it('should return summary with grouped data', async () => {
      await writeFile(join(testCacheDir, 'A_albedo.png'), 'aaaa');
      await writeFile(join(testCacheDir, 'A_normal.png'), 'bb');
      await writeFile(join(testCacheDir, 'B_albedo.png'), 'ccc');

      const summary = await cache.getSummary();

      expect(summary.totalFiles).toBe(3);
      expect(summary.byBuilder.size).toBe(2);
      expect(summary.byBuilder.get('A')?.length).toBe(2);
      expect(summary.byBuilder.get('B')?.length).toBe(1);
      expect(summary.byChannel.get('albedo')?.length).toBe(2);
      expect(summary.byChannel.get('normal')?.length).toBe(1);
    });
  });

  describe('TextureCache.clean', () => {
    it('should not delete files newer than threshold', async () => {
      await writeFile(join(testCacheDir, 'New_albedo.png'), 'new data');

      // Use a very large threshold - file should NOT match
      const result = await cache.clean({
        olderThanMs: 1000 * 60 * 60 * 24 * 365, // 1 year
        force: false
      });

      expect(result.files.length).toBe(0);
      expect(result.executed).toBe(false);
    });

    it('should filter by builderName and respect orphan detection', async () => {
      await writeFile(join(testCacheDir, 'Target_albedo.png'), 'target data');
      await writeFile(join(testCacheDir, 'Other_albedo.png'), 'other data');

      // Only target builder is "known", so Other is orphaned
      const result = await cache.clean({
        deleteOrphans: true,
        knownBuilders: new Set(['Target']),
        force: true
      });

      // Other should be deleted as orphaned
      expect(result.files.length).toBe(1);
      expect(result.files[0].builderName).toBe('Other');
      expect(result.executed).toBe(true);

      // Only Target should remain
      const remaining = await cache.listTextures();
      expect(remaining.length).toBe(1);
      expect(remaining[0].builderName).toBe('Target');
    });

    it('should detect orphaned textures', async () => {
      await writeFile(join(testCacheDir, 'Orphan_albedo.png'), 'orphan');
      await writeFile(join(testCacheDir, 'Valid_albedo.png'), 'valid');

      const result = await cache.clean({
        deleteOrphans: true,
        knownBuilders: new Set(['Valid']),
        force: false
      });

      expect(result.files.length).toBe(1);
      expect(result.files[0].builderName).toBe('Orphan');
      expect(result.reasons.get('Orphan_albedo.png')).toContain('orphaned');
    });
  });

  describe('TextureCache.deleteBuilder', () => {
    it('should identify all textures for a builder (dry-run)', async () => {
      await writeFile(join(testCacheDir, 'Target_albedo.png'), 'a');
      await writeFile(join(testCacheDir, 'Target_normal.png'), 'b');
      await writeFile(join(testCacheDir, 'Other_albedo.png'), 'c');

      const result = await cache.deleteBuilder('Target', false);

      expect(result.files.length).toBe(2);
      expect(result.executed).toBe(false);
      // All files should still exist
      const all = await cache.listTextures();
      expect(all.length).toBe(3);
    });

    it('should delete all textures for a builder with force', async () => {
      await writeFile(join(testCacheDir, 'Target_albedo.png'), 'a');
      await writeFile(join(testCacheDir, 'Target_normal.png'), 'b');
      await writeFile(join(testCacheDir, 'Other_albedo.png'), 'c');

      const result = await cache.deleteBuilder('Target', true);

      expect(result.files.length).toBe(2);
      expect(result.executed).toBe(true);
      // Only Other should remain
      const remaining = await cache.listTextures();
      expect(remaining.length).toBe(1);
      expect(remaining[0].builderName).toBe('Other');
    });
  });
});
