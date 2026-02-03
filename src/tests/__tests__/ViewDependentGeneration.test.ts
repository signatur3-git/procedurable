/**
 * View-Dependent Generation Tests (G2-002)
 *
 * Tests for view-dependent scene generation with distance-based LOD.
 */

import { describe, it, expect } from '@jest/globals';
import { Vec3 } from '../../platform/math/Vec3';
import {
  computeLODTier,
  isInViewFrustum,
  computeObjectLOD,
  generateViewDependentTerrain,
  generateView,
  sortByDistance,
  filterVisible,
  getObjectsAtLOD,
  DEFAULT_LOD_DISTANCES,
  ViewConfig,
  LODConfig
} from '../../platform/scene/ViewDependentGenerator';

describe('View-Dependent Generation (G2-002)', () => {
  describe('computeLODTier', () => {
    it('should return highest LOD for nearest distances', () => {
      expect(computeLODTier(0)).toBe(4);
      expect(computeLODTier(10)).toBe(4);
      expect(computeLODTier(24)).toBe(4);
    });

    it('should return lower LOD for farther distances', () => {
      expect(computeLODTier(30)).toBe(3);  // 25-50m
      expect(computeLODTier(75)).toBe(2);  // 50-100m
      expect(computeLODTier(150)).toBe(1); // 100-200m
      expect(computeLODTier(250)).toBe(0); // 200m+
    });

    it('should handle custom LOD distances', () => {
      const customDistances = [10, 20, 40];
      expect(computeLODTier(5, customDistances, 3)).toBe(3);
      expect(computeLODTier(15, customDistances, 3)).toBe(2);
      expect(computeLODTier(30, customDistances, 3)).toBe(1);
      expect(computeLODTier(50, customDistances, 3)).toBe(0);
    });

    it('should handle edge cases at threshold boundaries', () => {
      expect(computeLODTier(25)).toBe(3);  // At threshold, moves to next LOD
      expect(computeLODTier(24.99)).toBe(4);
    });
  });

  describe('isInViewFrustum', () => {
    const cameraPos = new Vec3(0, 10, 0);
    const cameraDir = new Vec3(0, 0, 1).normalize();  // Looking +Z
    const range = 100;
    const fov = Math.PI / 2;  // 90 degrees

    it('should return visible for point directly ahead', () => {
      const point = new Vec3(0, 10, 50);
      const result = isInViewFrustum(cameraPos, cameraDir, point, range, fov);

      expect(result.isVisible).toBe(true);
      expect(result.distance).toBeCloseTo(50);
      expect(result.angle).toBeCloseTo(0);
    });

    it('should return visible for point within FOV', () => {
      const point = new Vec3(30, 10, 50);  // Off to the side but within 90° FOV
      const result = isInViewFrustum(cameraPos, cameraDir, point, range, fov);

      expect(result.isVisible).toBe(true);
    });

    it('should return not visible for point beyond range', () => {
      const point = new Vec3(0, 10, 150);  // Beyond 100m range
      const result = isInViewFrustum(cameraPos, cameraDir, point, range, fov);

      expect(result.isVisible).toBe(false);
      expect(result.distance).toBeGreaterThan(range);
    });

    it('should return not visible for point behind camera', () => {
      const point = new Vec3(0, 10, -50);  // Behind camera
      const result = isInViewFrustum(cameraPos, cameraDir, point, range, fov);

      expect(result.isVisible).toBe(false);
      expect(result.angle).toBeGreaterThan(Math.PI / 2);  // More than 90 degrees
    });

    it('should return not visible for point far outside FOV', () => {
      const point = new Vec3(100, 10, 10);  // Far to the side
      const result = isInViewFrustum(cameraPos, cameraDir, point, range, fov);

      expect(result.isVisible).toBe(false);
    });

    it('should handle point at camera position', () => {
      const result = isInViewFrustum(cameraPos, cameraDir, cameraPos, range, fov);

      expect(result.isVisible).toBe(true);
      expect(result.distance).toBe(0);
    });
  });

  describe('computeObjectLOD', () => {
    const view: ViewConfig = {
      position: new Vec3(0, 10, 0),
      direction: new Vec3(0, 0, 1).normalize(),
      range: 200,
      fovHorizontal: Math.PI / 2
    };

    const lodConfig: LODConfig = {
      lodDistances: DEFAULT_LOD_DISTANCES,
      maxLOD: 4
    };

    it('should compute correct LOD for nearby visible object', () => {
      const result = computeObjectLOD('obj1', new Vec3(0, 10, 20), view, lodConfig);

      expect(result.id).toBe('obj1');
      expect(result.isVisible).toBe(true);
      expect(result.lodTier).toBe(4);  // Within 25m
      expect(result.distance).toBeCloseTo(20);
    });

    it('should compute correct LOD for distant visible object', () => {
      const result = computeObjectLOD('obj2', new Vec3(0, 10, 150), view, lodConfig);

      expect(result.isVisible).toBe(true);
      expect(result.lodTier).toBe(1);  // 100-200m
    });

    it('should return LOD 0 for non-visible object', () => {
      const result = computeObjectLOD('obj3', new Vec3(0, 10, -50), view, lodConfig);

      expect(result.isVisible).toBe(false);
      expect(result.lodTier).toBe(0);  // Non-visible objects get LOD 0
    });
  });

  describe('generateViewDependentTerrain', () => {
    const view: ViewConfig = {
      position: new Vec3(64, 10, 64),  // Center of chunk (1,1)
      direction: new Vec3(1, 0, 1).normalize(),  // Looking +X+Z
      range: 100,
      fovHorizontal: Math.PI / 2
    };

    const heightFunction = (x: number, z: number): number => {
      // Simple test terrain
      return Math.sin(x * 0.1) * Math.cos(z * 0.1) * 5;
    };

    it('should generate terrain chunks within view', () => {
      const result = generateViewDependentTerrain(view, { chunkSize: 64, heightFunction });

      expect(result.terrainChunks.length).toBeGreaterThan(0);
      expect(result.stats.visibleChunks).toBeGreaterThan(0);
    });

    it('should assign appropriate LOD tiers based on distance', () => {
      const result = generateViewDependentTerrain(view, { chunkSize: 64, heightFunction });

      // Find a nearby chunk
      const nearbyChunk = result.terrainChunks.find(c => c.distance < 50);
      if (nearbyChunk) {
        expect(nearbyChunk.lodTier).toBeGreaterThanOrEqual(2);  // High LOD for nearby
      }

      // Find a far chunk
      const farChunk = result.terrainChunks.find(c => c.distance > 80);
      if (farChunk) {
        expect(farChunk.lodTier).toBeLessThanOrEqual(2);  // Lower LOD for distant
      }
    });

    it('should skip chunks outside view frustum', () => {
      const narrowView: ViewConfig = {
        ...view,
        fovHorizontal: Math.PI / 4  // 45 degrees - narrower
      };

      const wideResult = generateViewDependentTerrain(view, { chunkSize: 64, heightFunction });
      const narrowResult = generateViewDependentTerrain(narrowView, { chunkSize: 64, heightFunction });

      // Narrower FOV should result in fewer visible chunks
      expect(narrowResult.stats.visibleChunks).toBeLessThanOrEqual(wideResult.stats.visibleChunks);
    });

    it('should have consistent LOD distribution stats', () => {
      const result = generateViewDependentTerrain(view, { chunkSize: 64, heightFunction });

      // Sum of LOD distribution should equal visible chunks
      const lodSum = Object.values(result.stats.lodDistribution).reduce((a, b) => a + b, 0);
      expect(lodSum).toBe(result.stats.visibleChunks);
    });
  });

  describe('generateView with objects', () => {
    const view: ViewConfig = {
      position: new Vec3(50, 10, 50),
      direction: new Vec3(1, 0, 0).normalize(),  // Looking +X
      range: 100
    };

    const objects = [
      { id: 'near', position: new Vec3(60, 10, 50) },   // 10m ahead
      { id: 'medium', position: new Vec3(100, 10, 50) }, // 50m ahead
      { id: 'far', position: new Vec3(140, 10, 50) },    // 90m ahead
      { id: 'behind', position: new Vec3(0, 10, 50) },   // Behind camera
      { id: 'outside', position: new Vec3(200, 10, 50) } // Beyond range
    ];

    it('should compute LOD for all objects', () => {
      const result = generateView(view, objects);

      expect(result.objects.length).toBe(5);
    });

    it('should mark nearby objects as higher LOD', () => {
      const result = generateView(view, objects);

      const nearObj = result.objects.find(o => o.id === 'near');
      expect(nearObj?.isVisible).toBe(true);
      expect(nearObj?.lodTier).toBe(4);  // Highest LOD
    });

    it('should mark far objects as lower LOD', () => {
      const result = generateView(view, objects);

      const farObj = result.objects.find(o => o.id === 'far');
      expect(farObj?.isVisible).toBe(true);
      expect(farObj?.lodTier).toBeLessThan(4);  // Not highest LOD
    });

    it('should mark objects behind camera as not visible', () => {
      const result = generateView(view, objects);

      const behindObj = result.objects.find(o => o.id === 'behind');
      expect(behindObj?.isVisible).toBe(false);
    });

    it('should mark objects beyond range as not visible', () => {
      const result = generateView(view, objects);

      const outsideObj = result.objects.find(o => o.id === 'outside');
      expect(outsideObj?.isVisible).toBe(false);
    });

    it('should track visibility stats correctly', () => {
      const result = generateView(view, objects);

      const visibleCount = result.objects.filter(o => o.isVisible).length;
      expect(result.stats.visibleObjects).toBe(visibleCount);
      expect(result.stats.skippedObjects).toBe(objects.length - visibleCount);
    });
  });

  describe('sortByDistance', () => {
    it('should sort objects by distance (nearest first)', () => {
      const objects = [
        { id: 'far', position: new Vec3(0, 0, 0), distance: 100, lodTier: 1, isVisible: true, angleFromView: 0 },
        { id: 'near', position: new Vec3(0, 0, 0), distance: 10, lodTier: 4, isVisible: true, angleFromView: 0 },
        { id: 'medium', position: new Vec3(0, 0, 0), distance: 50, lodTier: 2, isVisible: true, angleFromView: 0 }
      ];

      const sorted = sortByDistance(objects);

      expect(sorted[0].id).toBe('near');
      expect(sorted[1].id).toBe('medium');
      expect(sorted[2].id).toBe('far');
    });

    it('should not modify original array', () => {
      const objects = [
        { id: 'far', position: new Vec3(0, 0, 0), distance: 100, lodTier: 1, isVisible: true, angleFromView: 0 },
        { id: 'near', position: new Vec3(0, 0, 0), distance: 10, lodTier: 4, isVisible: true, angleFromView: 0 }
      ];

      sortByDistance(objects);

      expect(objects[0].id).toBe('far');  // Original unchanged
    });
  });

  describe('filterVisible', () => {
    it('should return only visible objects', () => {
      const objects = [
        { id: 'vis1', position: new Vec3(0, 0, 0), distance: 10, lodTier: 4, isVisible: true, angleFromView: 0 },
        { id: 'invis', position: new Vec3(0, 0, 0), distance: 100, lodTier: 0, isVisible: false, angleFromView: Math.PI },
        { id: 'vis2', position: new Vec3(0, 0, 0), distance: 50, lodTier: 2, isVisible: true, angleFromView: 0.5 }
      ];

      const filtered = filterVisible(objects);

      expect(filtered.length).toBe(2);
      expect(filtered.every(o => o.isVisible)).toBe(true);
    });
  });

  describe('getObjectsAtLOD', () => {
    it('should return only objects at specified LOD tier', () => {
      const objects = [
        { id: 'lod4', position: new Vec3(0, 0, 0), distance: 10, lodTier: 4, isVisible: true, angleFromView: 0 },
        { id: 'lod2', position: new Vec3(0, 0, 0), distance: 60, lodTier: 2, isVisible: true, angleFromView: 0 },
        { id: 'lod4b', position: new Vec3(0, 0, 0), distance: 20, lodTier: 4, isVisible: true, angleFromView: 0 },
        { id: 'invis', position: new Vec3(0, 0, 0), distance: 100, lodTier: 4, isVisible: false, angleFromView: Math.PI }
      ];

      const lod4Objects = getObjectsAtLOD(objects, 4);

      expect(lod4Objects.length).toBe(2);  // Only visible LOD 4 objects
      expect(lod4Objects.every(o => o.lodTier === 4 && o.isVisible)).toBe(true);
    });
  });

  describe('progressive generation', () => {
    it('should generate more detail for closer camera positions', () => {
      const heightFunction = (_x: number, _z: number): number => 0;

      // Camera far from origin
      const farView: ViewConfig = {
        position: new Vec3(500, 10, 500),
        direction: new Vec3(0, 0, 1).normalize(),
        range: 200
      };

      // Camera closer to origin
      const nearView: ViewConfig = {
        position: new Vec3(32, 10, 32),  // Center of chunk (0,0)
        direction: new Vec3(0, 0, 1).normalize(),
        range: 200
      };

      const farResult = generateViewDependentTerrain(farView, { chunkSize: 64, heightFunction });
      const nearResult = generateViewDependentTerrain(nearView, { chunkSize: 64, heightFunction });

      // Both should have visible chunks
      expect(farResult.terrainChunks.length).toBeGreaterThan(0);
      expect(nearResult.terrainChunks.length).toBeGreaterThan(0);

      // Near result should have higher LOD for chunk at origin
      const nearOriginChunk = nearResult.terrainChunks.find(c => c.chunkX === 0 && c.chunkZ === 0);
      const farOriginChunk = farResult.terrainChunks.find(c => c.chunkX === 0 && c.chunkZ === 0);

      if (nearOriginChunk && farOriginChunk) {
        expect(nearOriginChunk.lodTier).toBeGreaterThan(farOriginChunk.lodTier);
      }
    });
  });
});
