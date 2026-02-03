/**
 * Text Rasterizer Tests (G5-002)
 */

import { describe, it, expect } from '@jest/globals';
import {
  TextRasterizer,
  TextLayer,
  rasterizeText,
  evaluateTextLayer,
  createTextResult,
  textRasterizer
} from '../../platform/materials/TextRasterizer';

describe('Text Rasterizer (G5-002)', () => {
  describe('TextRasterizer class', () => {
    it('should create instance', () => {
      const rasterizer = new TextRasterizer();
      expect(rasterizer).toBeDefined();
    });

    it('should have singleton instance', () => {
      expect(textRasterizer).toBeDefined();
      expect(textRasterizer).toBeInstanceOf(TextRasterizer);
    });

    it('should cache rasterized text', async () => {
      const rasterizer = new TextRasterizer();

      // First call
      const result1 = await rasterizer.rasterize('A', 'procedural', 32, 64);
      // Second call should return cached
      const result2 = await rasterizer.rasterize('A', 'procedural', 32, 64);

      expect(result1).toBe(result2); // Same reference = cached
    });

    it('should clear cache', async () => {
      const rasterizer = new TextRasterizer();

      await rasterizer.rasterize('B', 'procedural', 32, 64);
      rasterizer.clearCache();

      const result = await rasterizer.rasterize('B', 'procedural', 32, 64);
      expect(result).toBeDefined();
    });
  });

  describe('rasterizeText', () => {
    it('should rasterize single character', async () => {
      const result = await rasterizeText('A', 'procedural', 64, 64, 32);

      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
      expect(result.coverage).toBeInstanceOf(Float32Array);
      expect(result.coverage.length).toBe(64 * 64);
    });

    it('should rasterize multiple characters', async () => {
      const result = await rasterizeText('ABC', 'procedural', 128, 64, 32);

      expect(result.width).toBe(128);
      expect(result.uvBounds).toBeDefined();
      // uvBounds should be defined even if no coverage
      expect(typeof result.uvBounds.uMin).toBe('number');
      expect(typeof result.uvBounds.uMax).toBe('number');
    });

    it('should have coverage buffer of correct size', async () => {
      const result = await rasterizeText('O', 'procedural', 64, 64, 32);

      // Coverage buffer should exist and be correct size
      expect(result.coverage.length).toBe(64 * 64);

      // All values should be 0 or 1
      for (let i = 0; i < result.coverage.length; i++) {
        expect(result.coverage[i]).toBeGreaterThanOrEqual(0);
        expect(result.coverage[i]).toBeLessThanOrEqual(1);
      }
    });

    it('should handle empty text', async () => {
      const result = await rasterizeText('', 'procedural', 64, 64, 32);

      let total = 0;
      for (let i = 0; i < result.coverage.length; i++) {
        total += result.coverage[i];
      }

      expect(total).toBe(0);
    });
  });

  describe('evaluateTextLayer', () => {
    it('should return zero coverage outside bounds', async () => {
      const rasterized = await rasterizeText('X', 'procedural', 64, 64, 32);

      const layer: TextLayer = {
        content: 'X',
        size: 0.5,
        color: { r: 1, g: 0, b: 0 },
        position: { u: 0.5, v: 0.5 }
      };

      // Way outside
      const result = evaluateTextLayer(layer, 0, 0, rasterized);
      expect(result.coverage).toBe(0);
    });

    it('should return color from layer', async () => {
      const rasterized = await rasterizeText('X', 'procedural', 64, 64, 32);

      const layer: TextLayer = {
        content: 'X',
        size: 0.5,
        color: { r: 0.8, g: 0.2, b: 0.1 },
        position: { u: 0.5, v: 0.5 }
      };

      const result = evaluateTextLayer(layer, 0.5, 0.5, rasterized);
      expect(result.color).toEqual(layer.color);
    });
  });

  describe('createTextResult', () => {
    it('should create texture result with coverage', () => {
      const layer: TextLayer = {
        content: 'TEST',
        size: 0.5,
        color: { r: 0, g: 0, b: 0 },
        position: { u: 0.5, v: 0.5 }
      };

      const result = createTextResult(layer, 1.0);

      expect(result.albedo).toEqual(layer.color);
      expect(result.roughness).toBeLessThan(0.5); // Text is smooth
      expect(result.metallic).toBe(0);
    });

    it('should use background color when no coverage', () => {
      const layer: TextLayer = {
        content: 'TEST',
        size: 0.5,
        color: { r: 0, g: 0, b: 0 },
        backgroundColor: { r: 1, g: 1, b: 1 },
        position: { u: 0.5, v: 0.5 }
      };

      const result = createTextResult(layer, 0);

      expect(result.albedo).toEqual(layer.backgroundColor);
    });

    it('should add slight height for embossing effect', () => {
      const layer: TextLayer = {
        content: 'TEST',
        size: 0.5,
        color: { r: 0, g: 0, b: 0 },
        position: { u: 0.5, v: 0.5 }
      };

      const withCoverage = createTextResult(layer, 1.0);
      const withoutCoverage = createTextResult(layer, 0);

      expect(withCoverage.height).toBeGreaterThan(withoutCoverage.height);
    });
  });

  describe('Determinism', () => {
    it('should produce same result for same input', async () => {
      const r1 = await rasterizeText('TEST', 'procedural', 64, 64, 32);
      const r2 = await rasterizeText('TEST', 'procedural', 64, 64, 32);

      // Compare coverage arrays
      for (let i = 0; i < r1.coverage.length; i++) {
        expect(r1.coverage[i]).toBe(r2.coverage[i]);
      }
    });
  });
});
