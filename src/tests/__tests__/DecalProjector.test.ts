/**
 * Decal Projector Tests (G5-001)
 */

import { describe, it, expect } from '@jest/globals';
import {
  DecalProjector,
  projectToDecalUV,
  evaluateDecal,
  createPlanarDecal,
  Decal,
  PlanarProjection,
  CylindricalProjection,
  SphericalProjection
} from '../../platform/materials/DecalProjector';
import { Vec3 } from '../../platform/math/Vec3';
import { defaultResult } from '../../platform/materials/TextureGenerator';

// Import generators
import '../../platform/materials/generators';

describe('Decal Projector (G5-001)', () => {
  describe('projectToDecalUV - Planar', () => {
    const planarProj: PlanarProjection = {
      type: 'planar',
      origin: new Vec3(0, 0, 0),
      normal: new Vec3(0, 0, 1),
      up: new Vec3(0, 1, 0),
      width: 1,
      height: 1
    };

    it('should project center point to UV (0.5, 0.5)', () => {
      const result = projectToDecalUV(new Vec3(0, 0, 0), planarProj);
      expect(result.u).toBeCloseTo(0.5);
      expect(result.v).toBeCloseTo(0.5);
      expect(result.inBounds).toBe(true);
    });

    it('should project corner points correctly', () => {
      const topRight = projectToDecalUV(new Vec3(0.5, 0.5, 0), planarProj);
      expect(topRight.u).toBeCloseTo(1);
      expect(topRight.v).toBeCloseTo(1);
      expect(topRight.inBounds).toBe(true);

      const bottomLeft = projectToDecalUV(new Vec3(-0.5, -0.5, 0), planarProj);
      expect(bottomLeft.u).toBeCloseTo(0);
      expect(bottomLeft.v).toBeCloseTo(0);
      expect(bottomLeft.inBounds).toBe(true);
    });

    it('should mark out-of-bounds points', () => {
      const outside = projectToDecalUV(new Vec3(1, 0, 0), planarProj);
      expect(outside.inBounds).toBe(false);
    });

    it('should calculate depth from projection plane', () => {
      const onPlane = projectToDecalUV(new Vec3(0, 0, 0), planarProj);
      const offPlane = projectToDecalUV(new Vec3(0, 0, 0.2), planarProj);

      expect(onPlane.depth).toBeCloseTo(0);
      expect(offPlane.depth).toBeCloseTo(0.2);
    });
  });

  describe('projectToDecalUV - Cylindrical', () => {
    const cylProj: CylindricalProjection = {
      type: 'cylindrical',
      origin: new Vec3(0, 0, 0),
      axis: new Vec3(0, 1, 0),
      radius: 1,
      height: 2,
      startAngle: 0,
      endAngle: Math.PI * 2
    };

    it('should project points on cylinder surface', () => {
      const point = new Vec3(1, 0, 0); // On surface at angle 0
      const result = projectToDecalUV(point, cylProj);

      expect(result.v).toBeCloseTo(0.5); // Middle height
      expect(result.inBounds).toBe(true);
    });

    it('should vary V with height', () => {
      const top = projectToDecalUV(new Vec3(1, 1, 0), cylProj);
      const bottom = projectToDecalUV(new Vec3(1, -1, 0), cylProj);

      expect(top.v).toBeGreaterThan(bottom.v);
    });
  });

  describe('projectToDecalUV - Spherical', () => {
    const sphereProj: SphericalProjection = {
      type: 'spherical',
      origin: new Vec3(0, 0, 0),
      radius: 1
    };

    it('should project points on sphere surface', () => {
      const point = new Vec3(1, 0, 0);
      const result = projectToDecalUV(point, sphereProj);

      expect(result.inBounds).toBe(true);
      expect(result.depth).toBeCloseTo(0);
    });

    it('should project top/bottom correctly', () => {
      const top = projectToDecalUV(new Vec3(0, 1, 0), sphereProj);
      const bottom = projectToDecalUV(new Vec3(0, -1, 0), sphereProj);

      // Top should have lower V than bottom (V increases downward in spherical coords)
      expect(top.v).toBeLessThan(bottom.v);
    });
  });

  describe('evaluateDecal', () => {
    it('should return zero coverage for out-of-bounds points', () => {
      const decal = createPlanarDecal(
        'test',
        new Vec3(0, 0, 0),
        new Vec3(0, 0, 1),
        1,
        { r: 1, g: 0, b: 0 }
      );

      const { coverage } = evaluateDecal(decal, new Vec3(10, 10, 10), 42);
      expect(coverage).toBe(0);
    });

    it('should return coverage for in-bounds points', () => {
      const decal = createPlanarDecal(
        'test',
        new Vec3(0, 0, 0),
        new Vec3(0, 0, 1),
        1,
        { r: 1, g: 0, b: 0 }
      );

      const { result, coverage } = evaluateDecal(decal, new Vec3(0, 0, 0), 42);
      expect(coverage).toBeGreaterThan(0);
      expect(result.albedo.r).toBe(1);
      expect(result.albedo.g).toBe(0);
    });

    it('should use generator when specified', () => {
      const decal: Decal = {
        name: 'noise_decal',
        source: {
          generator: 'noise_color',
          params: { colorA: { r: 0, g: 0, b: 0 }, colorB: { r: 1, g: 1, b: 1 } }
        },
        projection: {
          type: 'planar',
          origin: new Vec3(0, 0, 0),
          normal: new Vec3(0, 0, 1),
          up: new Vec3(0, 1, 0),
          width: 1,
          height: 1
        }
      };

      const { result, coverage } = evaluateDecal(decal, new Vec3(0, 0, 0), 42);
      expect(coverage).toBeGreaterThan(0);
      expect(result.albedo.r).toBeGreaterThanOrEqual(0);
      expect(result.albedo.r).toBeLessThanOrEqual(1);
    });
  });

  describe('DecalProjector class', () => {
    it('should add and remove decals', () => {
      const projector = new DecalProjector();
      expect(projector.count).toBe(0);

      projector.addDecal(createPlanarDecal('d1', new Vec3(0, 0, 0), new Vec3(0, 0, 1), 1, { r: 1, g: 0, b: 0 }));
      expect(projector.count).toBe(1);

      projector.addDecal(createPlanarDecal('d2', new Vec3(1, 0, 0), new Vec3(0, 0, 1), 1, { r: 0, g: 1, b: 0 }));
      expect(projector.count).toBe(2);

      const removed = projector.removeDecal('d1');
      expect(removed).toBe(true);
      expect(projector.count).toBe(1);

      const notFound = projector.removeDecal('nonexistent');
      expect(notFound).toBe(false);
    });

    it('should evaluate multiple decals', () => {
      const projector = new DecalProjector();

      // Red decal at origin
      projector.addDecal(createPlanarDecal('red', new Vec3(0, 0, 0), new Vec3(0, 0, 1), 1, { r: 1, g: 0, b: 0 }));

      // Green decal offset
      projector.addDecal(createPlanarDecal('green', new Vec3(2, 0, 0), new Vec3(0, 0, 1), 1, { r: 0, g: 1, b: 0 }));

      const base = defaultResult();

      // Point at red decal
      const atRed = projector.evaluate(new Vec3(0, 0, 0), base, 42);
      expect(atRed.albedo.r).toBeGreaterThan(0.5);

      // Point at green decal
      const atGreen = projector.evaluate(new Vec3(2, 0, 0), base, 42);
      expect(atGreen.albedo.g).toBeGreaterThan(0.5);

      // Point with no decal coverage
      const atNone = projector.evaluate(new Vec3(10, 0, 0), base, 42);
      expect(atNone.albedo.r).toBeCloseTo(base.albedo.r);
    });

    it('should apply blend modes', () => {
      const projector = new DecalProjector();

      const decal: Decal = {
        name: 'multiply_decal',
        source: { color: { r: 0.5, g: 0.5, b: 0.5 } },
        projection: {
          type: 'planar',
          origin: new Vec3(0, 0, 0),
          normal: new Vec3(0, 0, 1),
          up: new Vec3(0, 1, 0),
          width: 1,
          height: 1
        },
        blendMode: 'multiply',
        opacity: 1
      };

      projector.addDecal(decal);

      const base = defaultResult();
      base.albedo = { r: 1, g: 1, b: 1 }; // White base

      const result = projector.evaluate(new Vec3(0, 0, 0), base, 42);

      // Multiply blend: white * 0.5 should give ~0.5
      // (with some edge falloff)
      expect(result.albedo.r).toBeLessThan(1);
    });
  });

  describe('createPlanarDecal helper', () => {
    it('should create a valid planar decal', () => {
      const decal = createPlanarDecal(
        'logo',
        new Vec3(0, 1, 0),
        new Vec3(0, 1, 0),
        0.5,
        { r: 0.2, g: 0.4, b: 0.8 }
      );

      expect(decal.name).toBe('logo');
      expect(decal.source.color).toEqual({ r: 0.2, g: 0.4, b: 0.8 });
      expect(decal.projection.type).toBe('planar');
      expect((decal.projection as PlanarProjection).width).toBe(0.5);
    });
  });

  describe('Determinism', () => {
    it('should produce same results with same seed', () => {
      const decal: Decal = {
        name: 'noise_decal',
        source: {
          generator: 'noise_color'
        },
        projection: {
          type: 'planar',
          origin: new Vec3(0, 0, 0),
          normal: new Vec3(0, 0, 1),
          up: new Vec3(0, 1, 0),
          width: 1,
          height: 1
        }
      };

      const pos = new Vec3(0.1, 0.2, 0);
      const r1 = evaluateDecal(decal, pos, 42);
      const r2 = evaluateDecal(decal, pos, 42);

      expect(r1.result.albedo.r).toBe(r2.result.albedo.r);
      expect(r1.coverage).toBe(r2.coverage);
    });
  });
});
