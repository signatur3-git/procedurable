/**
 * Material Stack Tests (G4-003)
 */

import { describe, it, expect } from '@jest/globals';
import {
  MaterialStack,
  createMaterialStack,
  evaluateMask,
  LayerMask
} from '../../platform/materials/MaterialStack';
import { EvaluationContext } from '../../platform/materials/TextureGenerator';

// Import generators to register them
import '../../platform/materials/generators';

describe('Material Stack (G4-003)', () => {
  describe('createMaterialStack', () => {
    it('should create a material stack from definition', () => {
      const stack = createMaterialStack({
        layers: [
          { generator: 'wood_grain' }
        ]
      });

      expect(stack).toBeInstanceOf(MaterialStack);
      expect(stack.layerCount).toBe(1);
    });
  });

  describe('MaterialStack.evaluate', () => {
    it('should evaluate single layer', () => {
      const stack = createMaterialStack({
        layers: [
          { generator: 'wood_grain', params: { species: 'oak' } }
        ]
      });

      const ctx: EvaluationContext = { u: 0.5, v: 0.5 };
      const result = stack.evaluate(ctx, 42);

      expect(result.albedo).toBeDefined();
      expect(result.roughness).toBeGreaterThan(0);
      expect(result.metallic).toBe(0);
    });

    it('should evaluate multiple layers', () => {
      const stack = createMaterialStack({
        layers: [
          { generator: 'wood_grain' },
          { generator: 'edge_wear', opacity: 0.5 }
        ]
      });

      const ctx: EvaluationContext = { u: 0.5, v: 0.5, curvature: 0.5 };
      const result = stack.evaluate(ctx, 42);

      expect(result.albedo).toBeDefined();
    });

    it('should apply layer opacity', () => {
      const stackFull = createMaterialStack({
        layers: [
          { generator: 'noise_color', params: { colorA: { r: 0, g: 0, b: 0 }, colorB: { r: 1, g: 1, b: 1 } } }
        ]
      });

      const stackHalf = createMaterialStack({
        layers: [
          { generator: 'noise_color', params: { colorA: { r: 0, g: 0, b: 0 }, colorB: { r: 1, g: 1, b: 1 } }, opacity: 0.5 }
        ]
      });

      const ctx: EvaluationContext = { u: 0.5, v: 0.5 };
      const fullResult = stackFull.evaluate(ctx, 42);
      const halfResult = stackHalf.evaluate(ctx, 42);

      // Half opacity should blend with default gray (0.5)
      // So colors should be closer to 0.5
      expect(Math.abs(halfResult.albedo.r - 0.5)).toBeLessThanOrEqual(Math.abs(fullResult.albedo.r - 0.5));
    });

    it('should be deterministic', () => {
      const stack = createMaterialStack({
        layers: [
          { generator: 'wood_grain' },
          { generator: 'dirt_accumulation', mask: { type: 'ao' } }
        ]
      });

      const ctx: EvaluationContext = { u: 0.3, v: 0.7, ao: 0.5 };
      const r1 = stack.evaluate(ctx, 42);
      const r2 = stack.evaluate(ctx, 42);

      expect(r1.albedo.r).toBe(r2.albedo.r);
      expect(r1.roughness).toBe(r2.roughness);
    });
  });

  describe('Blend Modes', () => {
    it('should support multiply blend mode', () => {
      const stack = createMaterialStack({
        layers: [
          { generator: 'noise_color', params: { colorA: { r: 1, g: 1, b: 1 }, colorB: { r: 1, g: 1, b: 1 } } },
          { generator: 'noise_color', params: { colorA: { r: 0.5, g: 0.5, b: 0.5 }, colorB: { r: 0.5, g: 0.5, b: 0.5 } }, blendMode: 'multiply' }
        ]
      });

      const result = stack.evaluate({ u: 0.5, v: 0.5 }, 42);
      // White * 0.5 = 0.5
      expect(result.albedo.r).toBeCloseTo(0.5, 1);
    });

    it('should support add blend mode', () => {
      const stack = createMaterialStack({
        layers: [
          { generator: 'noise_color', params: { colorA: { r: 0.3, g: 0.3, b: 0.3 }, colorB: { r: 0.3, g: 0.3, b: 0.3 } } },
          { generator: 'noise_color', params: { colorA: { r: 0.3, g: 0.3, b: 0.3 }, colorB: { r: 0.3, g: 0.3, b: 0.3 } }, blendMode: 'add' }
        ]
      });

      const result = stack.evaluate({ u: 0.5, v: 0.5 }, 42);
      // 0.3 + 0.3 = 0.6
      expect(result.albedo.r).toBeCloseTo(0.6, 1);
    });

    it('should support screen blend mode', () => {
      const stack = createMaterialStack({
        layers: [
          { generator: 'noise_color', params: { colorA: { r: 0.5, g: 0.5, b: 0.5 }, colorB: { r: 0.5, g: 0.5, b: 0.5 } } },
          { generator: 'noise_color', params: { colorA: { r: 0.5, g: 0.5, b: 0.5 }, colorB: { r: 0.5, g: 0.5, b: 0.5 } }, blendMode: 'screen' }
        ]
      });

      const result = stack.evaluate({ u: 0.5, v: 0.5 }, 42);
      // screen(0.5, 0.5) = 1 - (1-0.5)*(1-0.5) = 0.75
      expect(result.albedo.r).toBeCloseTo(0.75, 1);
    });
  });

  describe('evaluateMask', () => {
    it('should evaluate uniform mask', () => {
      const mask: LayerMask = { type: 'uniform', value: 0.7 };
      const result = evaluateMask(mask, { u: 0, v: 0 }, 42);
      expect(result).toBe(0.7);
    });

    it('should evaluate noise mask', () => {
      const mask: LayerMask = { type: 'noise', noiseScale: 5 };
      const r1 = evaluateMask(mask, { u: 0, v: 0 }, 42);
      const r2 = evaluateMask(mask, { u: 0.5, v: 0.5 }, 42);

      expect(r1).toBeGreaterThanOrEqual(0);
      expect(r1).toBeLessThanOrEqual(1);
      expect(r1).not.toBe(r2); // Should vary with position
    });

    it('should evaluate curvature mask', () => {
      const mask: LayerMask = { type: 'curvature', threshold: 0.3, falloff: 0.2 };

      const low = evaluateMask(mask, { u: 0, v: 0, curvature: 0.1 }, 42);
      const high = evaluateMask(mask, { u: 0, v: 0, curvature: 0.6 }, 42);

      expect(low).toBeLessThan(high);
      expect(low).toBe(0); // Below threshold
      expect(high).toBeGreaterThan(0.5);
    });

    it('should evaluate ao mask', () => {
      const mask: LayerMask = { type: 'ao', threshold: 0.7, falloff: 0.3 };

      const highAO = evaluateMask(mask, { u: 0, v: 0, ao: 0.9 }, 42);
      const lowAO = evaluateMask(mask, { u: 0, v: 0, ao: 0.3 }, 42);

      // Low AO (crevices) should have higher mask value
      expect(lowAO).toBeGreaterThan(highAO);
    });

    it('should invert mask when specified', () => {
      const mask: LayerMask = { type: 'uniform', value: 0.3, invert: true };
      const result = evaluateMask(mask, { u: 0, v: 0 }, 42);
      expect(result).toBeCloseTo(0.7);
    });

    it('should evaluate simple expression', () => {
      const mask: LayerMask = { type: 'expression', expression: 'curvature > 0.5' };

      const below = evaluateMask(mask, { u: 0, v: 0, curvature: 0.3 }, 42);
      const above = evaluateMask(mask, { u: 0, v: 0, curvature: 0.7 }, 42);

      expect(below).toBe(0);
      expect(above).toBe(1);
    });

    it('should evaluate AND expression', () => {
      const mask: LayerMask = { type: 'expression', expression: 'curvature > 0.5 AND ao < 0.5' };

      const bothTrue = evaluateMask(mask, { u: 0, v: 0, curvature: 0.7, ao: 0.3 }, 42);
      const oneFalse = evaluateMask(mask, { u: 0, v: 0, curvature: 0.3, ao: 0.3 }, 42); // curvature is false

      expect(bothTrue).toBe(1);
      expect(oneFalse).toBe(0);
    });
  });

  describe('Real-world material stack', () => {
    it('should create worn wood material', () => {
      const stack = createMaterialStack({
        layers: [
          { generator: 'wood_grain', params: { species: 'oak' } },
          {
            generator: 'edge_wear',
            params: { wearAmount: 0.6 },
            blendMode: 'normal',
            mask: { type: 'curvature', threshold: 0.2, falloff: 0.3 }
          },
          {
            generator: 'dirt_accumulation',
            params: { dirtAmount: 0.4 },
            blendMode: 'multiply',
            mask: { type: 'ao', threshold: 0.6, falloff: 0.3 }
          }
        ]
      });

      // Test at flat area (low curvature, high AO)
      const flatResult = stack.evaluate({ u: 0.5, v: 0.5, curvature: 0, ao: 0.9 }, 42);

      // Test at edge (high curvature)
      const edgeResult = stack.evaluate({ u: 0.5, v: 0.5, curvature: 0.7, ao: 0.9 }, 42);

      // Test in crevice (low AO)
      const creviceResult = stack.evaluate({ u: 0.5, v: 0.5, curvature: 0, ao: 0.3 }, 42);

      // All should have valid values in reasonable range
      expect(flatResult.albedo.r).toBeGreaterThan(0);
      expect(flatResult.albedo.r).toBeLessThan(1);
      expect(edgeResult.albedo.r).toBeGreaterThan(0);
      expect(creviceResult.albedo.r).toBeGreaterThan(0);

      // Roughness should be positive
      expect(flatResult.roughness).toBeGreaterThan(0);
      expect(edgeResult.roughness).toBeGreaterThan(0);
      expect(creviceResult.roughness).toBeGreaterThan(0);
    });
  });
});
