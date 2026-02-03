/**
 * Texture Generator Tests (G4-002)
 */

import { describe, it, expect } from '@jest/globals';
import {
  getGenerator, listGenerators, defaultResult, perlin2D, fbm2D, worley2D,
  SeededRandom, EvaluationContext
} from '../../platform/materials/TextureGenerator';

// Import generators to register them
import '../../platform/materials/generators';

describe('Texture Generators (G4-002)', () => {
  describe('Generator Registry', () => {
    it('should have wood_grain generator registered', () => {
      const gen = getGenerator('wood_grain');
      expect(gen).toBeDefined();
      expect(gen!.name).toBe('wood_grain');
    });

    it('should have edge_wear generator registered', () => {
      const gen = getGenerator('edge_wear');
      expect(gen).toBeDefined();
    });

    it('should have dirt_accumulation generator registered', () => {
      const gen = getGenerator('dirt_accumulation');
      expect(gen).toBeDefined();
    });

    it('should list all registered generators', () => {
      const list = listGenerators();
      expect(list).toContain('wood_grain');
      expect(list).toContain('edge_wear');
      expect(list).toContain('dirt_accumulation');
    });
  });

  describe('Noise Functions', () => {
    it('perlin2D should be deterministic', () => {
      const v1 = perlin2D(0.5, 0.5, 42);
      const v2 = perlin2D(0.5, 0.5, 42);
      expect(v1).toBe(v2);
    });

    it('perlin2D should vary with position', () => {
      const v1 = perlin2D(0, 0, 42);
      const v2 = perlin2D(1, 1, 42);
      expect(v1).not.toBe(v2);
    });

    it('perlin2D should vary with seed', () => {
      const v1 = perlin2D(0.5, 0.5, 42);
      const v2 = perlin2D(0.5, 0.5, 123);
      expect(v1).not.toBe(v2);
    });

    it('fbm2D should produce values in reasonable range', () => {
      for (let i = 0; i < 10; i++) {
        const v = fbm2D(i * 0.1, i * 0.1, 42, 4);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    });

    it('worley2D should return distance and cellId', () => {
      const result = worley2D(0.5, 0.5, 42);
      expect(result.distance).toBeGreaterThanOrEqual(0);
      expect(typeof result.cellId).toBe('number');
    });
  });

  describe('SeededRandom', () => {
    it('should be deterministic', () => {
      const rng1 = new SeededRandom(42);
      const rng2 = new SeededRandom(42);
      for (let i = 0; i < 10; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('should produce different sequences with different seeds', () => {
      const rng1 = new SeededRandom(42);
      const rng2 = new SeededRandom(123);
      let anyDifferent = false;
      for (let i = 0; i < 10; i++) {
        if (rng1.next() !== rng2.next()) anyDifferent = true;
      }
      expect(anyDifferent).toBe(true);
    });

    it('should produce values in [0, 1)', () => {
      const rng = new SeededRandom(42);
      for (let i = 0; i < 100; i++) {
        const v = rng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe('Wood Grain Generator', () => {
    it('should produce valid texture result', () => {
      const gen = getGenerator('wood_grain')!;
      const ctx: EvaluationContext = { u: 0.5, v: 0.5 };
      const result = gen.evaluate(ctx, {}, 42);

      expect(result.albedo).toBeDefined();
      expect(result.albedo.r).toBeGreaterThanOrEqual(0);
      expect(result.albedo.r).toBeLessThanOrEqual(1);
      expect(result.roughness).toBeGreaterThanOrEqual(0);
      expect(result.roughness).toBeLessThanOrEqual(1);
      expect(result.metallic).toBe(0); // Wood is not metallic
    });

    it('should be deterministic', () => {
      const gen = getGenerator('wood_grain')!;
      const ctx: EvaluationContext = { u: 0.5, v: 0.5 };
      const r1 = gen.evaluate(ctx, {}, 42);
      const r2 = gen.evaluate(ctx, {}, 42);

      expect(r1.albedo.r).toBe(r2.albedo.r);
      expect(r1.roughness).toBe(r2.roughness);
    });

    it('should vary with UV position', () => {
      const gen = getGenerator('wood_grain')!;
      const r1 = gen.evaluate({ u: 0, v: 0 }, {}, 42);
      const r2 = gen.evaluate({ u: 0.5, v: 0.5 }, {}, 42);

      // Colors should differ at different positions
      const diff = Math.abs(r1.albedo.r - r2.albedo.r) +
                   Math.abs(r1.albedo.g - r2.albedo.g) +
                   Math.abs(r1.albedo.b - r2.albedo.b);
      expect(diff).toBeGreaterThan(0);
    });

    it('should respect species parameter', () => {
      const gen = getGenerator('wood_grain')!;
      const ctx: EvaluationContext = { u: 0.5, v: 0.5 };
      const oak = gen.evaluate(ctx, { species: 'oak' }, 42);
      const walnut = gen.evaluate(ctx, { species: 'walnut' }, 42);

      // Different species should have different colors
      expect(oak.albedo.r).not.toBe(walnut.albedo.r);
    });
  });

  describe('Edge Wear Generator', () => {
    it('should produce more wear at high curvature', () => {
      const gen = getGenerator('edge_wear')!;

      const lowCurve = gen.evaluate({ u: 0.5, v: 0.5, curvature: 0 }, {}, 42);
      const highCurve = gen.evaluate({ u: 0.5, v: 0.5, curvature: 0.8 }, {}, 42);

      // High curvature should show more wear (lighter/different color)
      // The worn color is lighter than base, so r should be higher
      expect(highCurve.albedo.r).toBeGreaterThanOrEqual(lowCurve.albedo.r);
    });

    it('should respect wearAmount parameter', () => {
      const gen = getGenerator('edge_wear')!;
      const ctx: EvaluationContext = { u: 0.5, v: 0.5, curvature: 0.5 };

      const low = gen.evaluate(ctx, { wearAmount: 0.1 }, 42);
      const high = gen.evaluate(ctx, { wearAmount: 0.9 }, 42);

      // More wear amount should show more effect
      expect(high.roughness).toBeGreaterThanOrEqual(low.roughness);
    });
  });

  describe('Dirt Accumulation Generator', () => {
    it('should produce more dirt at low AO', () => {
      const gen = getGenerator('dirt_accumulation')!;

      const highAO = gen.evaluate({ u: 0.5, v: 0.5, ao: 0.9 }, {}, 42);
      const lowAO = gen.evaluate({ u: 0.5, v: 0.5, ao: 0.3 }, {}, 42);

      // Low AO (crevices) should be darker (lower r,g,b)
      expect(lowAO.albedo.r).toBeLessThanOrEqual(highAO.albedo.r);
    });

    it('should be deterministic', () => {
      const gen = getGenerator('dirt_accumulation')!;
      const ctx: EvaluationContext = { u: 0.5, v: 0.5, ao: 0.5 };
      const r1 = gen.evaluate(ctx, {}, 42);
      const r2 = gen.evaluate(ctx, {}, 42);

      expect(r1.albedo.r).toBe(r2.albedo.r);
    });
  });

  describe('Stone Generator', () => {
    it('should be registered', () => {
      const gen = getGenerator('stone');
      expect(gen).toBeDefined();
    });

    it('should produce valid texture result', () => {
      const gen = getGenerator('stone')!;
      const result = gen.evaluate({ u: 0.5, v: 0.5 }, {}, 42);

      expect(result.albedo.r).toBeGreaterThanOrEqual(0);
      expect(result.albedo.r).toBeLessThanOrEqual(1);
      expect(result.metallic).toBe(0);
    });

    it('should be deterministic', () => {
      const gen = getGenerator('stone')!;
      const r1 = gen.evaluate({ u: 0.3, v: 0.7 }, {}, 42);
      const r2 = gen.evaluate({ u: 0.3, v: 0.7 }, {}, 42);
      expect(r1.albedo.r).toBe(r2.albedo.r);
    });
  });

  describe('Metal Brushed Generator', () => {
    it('should be registered', () => {
      const gen = getGenerator('metal_brushed');
      expect(gen).toBeDefined();
    });

    it('should produce metallic output', () => {
      const gen = getGenerator('metal_brushed')!;
      const result = gen.evaluate({ u: 0.5, v: 0.5 }, {}, 42);

      expect(result.metallic).toBeGreaterThan(0.5);
    });

    it('should respect brush direction', () => {
      const gen = getGenerator('metal_brushed')!;
      const horizontal = gen.evaluate({ u: 0.5, v: 0.5 }, { brushDirection: 0 }, 42);
      const vertical = gen.evaluate({ u: 0.5, v: 0.5 }, { brushDirection: Math.PI / 2 }, 42);

      // Different brush directions should produce different normals
      expect(horizontal.normal.x).not.toBe(vertical.normal.x);
    });
  });

  describe('Noise Color Generator', () => {
    it('should be registered', () => {
      const gen = getGenerator('noise_color');
      expect(gen).toBeDefined();
    });

    it('should blend between two colors', () => {
      const gen = getGenerator('noise_color')!;
      const result = gen.evaluate({ u: 0.5, v: 0.5 }, {
        colorA: { r: 0, g: 0, b: 0 },
        colorB: { r: 1, g: 1, b: 1 }
      }, 42);

      // Result should be somewhere between black and white
      expect(result.albedo.r).toBeGreaterThanOrEqual(0);
      expect(result.albedo.r).toBeLessThanOrEqual(1);
    });

    it('should be deterministic', () => {
      const gen = getGenerator('noise_color')!;
      const r1 = gen.evaluate({ u: 0.2, v: 0.8 }, {}, 42);
      const r2 = gen.evaluate({ u: 0.2, v: 0.8 }, {}, 42);
      expect(r1.albedo.r).toBe(r2.albedo.r);
    });
  });

  describe('defaultResult', () => {
    it('should return neutral values', () => {
      const result = defaultResult();
      expect(result.albedo.r).toBe(0.5);
      expect(result.albedo.g).toBe(0.5);
      expect(result.albedo.b).toBe(0.5);
      expect(result.roughness).toBe(0.5);
      expect(result.metallic).toBe(0);
      expect(result.height).toBe(0);
    });
  });
});
