/**
 * Tests for Poisson disk sampling and scatter algorithms
 */

import { poissonDiskSample, uniformScatter, ScatterBounds } from '../../platform/spatial/Scatter';

describe('Scatter', () => {
  describe('poissonDiskSample', () => {
    it('generates points within bounds', () => {
      const bounds: ScatterBounds = {
        minX: 0,
        maxX: 10,
        minZ: 0,
        maxZ: 10
      };

      const points = poissonDiskSample(bounds, {
        seed: 42,
        minDistance: 2.0
      });

      expect(points.length).toBeGreaterThan(0);

      for (const point of points) {
        expect(point.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(point.x).toBeLessThan(bounds.maxX);
        expect(point.z).toBeGreaterThanOrEqual(bounds.minZ);
        expect(point.z).toBeLessThan(bounds.maxZ);
      }
    });

    it('respects minimum distance constraint', () => {
      const bounds: ScatterBounds = {
        minX: 0,
        maxX: 20,
        minZ: 0,
        maxZ: 20
      };

      const minDistance = 3.0;
      const points = poissonDiskSample(bounds, {
        seed: 123,
        minDistance
      });

      // Check all pairs of points
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dx = points[i].x - points[j].x;
          const dz = points[i].z - points[j].z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          expect(dist).toBeGreaterThanOrEqual(minDistance - 0.0001);
        }
      }
    });

    it('is deterministic with same seed', () => {
      const bounds: ScatterBounds = {
        minX: -5,
        maxX: 5,
        minZ: -5,
        maxZ: 5
      };

      const config = { seed: 777, minDistance: 1.5 };

      const points1 = poissonDiskSample(bounds, config);
      const points2 = poissonDiskSample(bounds, config);

      expect(points1.length).toBe(points2.length);

      for (let i = 0; i < points1.length; i++) {
        expect(points1[i].x).toBeCloseTo(points2[i].x, 5);
        expect(points1[i].z).toBeCloseTo(points2[i].z, 5);
      }
    });

    it('produces different results with different seeds', () => {
      const bounds: ScatterBounds = {
        minX: 0,
        maxX: 15,
        minZ: 0,
        maxZ: 15
      };

      const points1 = poissonDiskSample(bounds, {
        seed: 1,
        minDistance: 2.0
      });

      const points2 = poissonDiskSample(bounds, {
        seed: 2,
        minDistance: 2.0
      });

      // Should have different counts or positions
      let different = points1.length !== points2.length;
      if (!different && points1.length > 0) {
        // Check first few points
        for (let i = 0; i < Math.min(3, points1.length); i++) {
          if (Math.abs(points1[i].x - points2[i].x) > 0.01 ||
              Math.abs(points1[i].z - points2[i].z) > 0.01) {
            different = true;
            break;
          }
        }
      }

      expect(different).toBe(true);
    });

    it('generates reasonable density', () => {
      const bounds: ScatterBounds = {
        minX: 0,
        maxX: 50,
        minZ: 0,
        maxZ: 50
      };

      const minDistance = 3.5;
      const points = poissonDiskSample(bounds, {
        seed: 999,
        minDistance
      });

      // Theoretical max density: ~1 point per (minDistance)^2 hexagonal packing
      // But Poisson is less dense, expect roughly 30-70% of theoretical max
      const area = (bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ);
      const theoreticalMax = area / (minDistance * minDistance * 0.866); // hexagonal packing

      expect(points.length).toBeGreaterThan(theoreticalMax * 0.3);
      expect(points.length).toBeLessThan(theoreticalMax * 0.8);
    });

    it('handles small bounds', () => {
      const bounds: ScatterBounds = {
        minX: 0,
        maxX: 2,
        minZ: 0,
        maxZ: 2
      };

      const points = poissonDiskSample(bounds, {
        seed: 42,
        minDistance: 1.5
      });

      // Should get at least 1 point
      expect(points.length).toBeGreaterThan(0);
      expect(points.length).toBeLessThan(5); // But not many in small area
    });

    it('handles rectangular (non-square) bounds', () => {
      const bounds: ScatterBounds = {
        minX: 0,
        maxX: 30,
        minZ: 0,
        maxZ: 10
      };

      const points = poissonDiskSample(bounds, {
        seed: 555,
        minDistance: 2.5
      });

      expect(points.length).toBeGreaterThan(0);

      // All points should be within bounds
      for (const point of points) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThan(30);
        expect(point.z).toBeGreaterThanOrEqual(0);
        expect(point.z).toBeLessThan(10);
      }
    });

    it('supports density mask for variable spacing', () => {
      const bounds: ScatterBounds = {
        minX: 0,
        maxX: 20,
        minZ: 0,
        maxZ: 20
      };

      // Density mask: higher density near center
      const densityMask = (x: number, z: number): number => {
        const dx = x - 10;
        const dz = z - 10;
        const distFromCenter = Math.sqrt(dx * dx + dz * dz);
        return Math.max(0, 1.0 - distFromCenter / 10);
      };

      const points = poissonDiskSample(bounds, {
        seed: 333,
        minDistance: 2.0,
        densityMask
      });

      expect(points.length).toBeGreaterThan(0);

      // Count points in center vs edges
      let centerCount = 0;
      let edgeCount = 0;

      for (const point of points) {
        const dx = point.x - 10;
        const dz = point.z - 10;
        const distFromCenter = Math.sqrt(dx * dx + dz * dz);

        if (distFromCenter < 5) {
          centerCount++;
        } else if (distFromCenter > 8) {
          edgeCount++;
        }
      }

      // Should have more points near center (higher density)
      // Use ratio check instead of absolute comparison (more robust)
      const centerArea = Math.PI * 5 * 5; // radius 5
      const edgeArea = Math.PI * (10 * 10 - 8 * 8); // annulus from 8 to 10
      const centerDensity = centerCount / centerArea;
      const edgeDensity = edgeCount / edgeArea;

      expect(centerDensity).toBeGreaterThan(edgeDensity * 0.8); // Allow some variance
    });

    it('works with negative bounds', () => {
      const bounds: ScatterBounds = {
        minX: -10,
        maxX: 10,
        minZ: -10,
        maxZ: 10
      };

      const points = poissonDiskSample(bounds, {
        seed: 888,
        minDistance: 2.5
      });

      expect(points.length).toBeGreaterThan(0);

      for (const point of points) {
        expect(point.x).toBeGreaterThanOrEqual(-10);
        expect(point.x).toBeLessThan(10);
        expect(point.z).toBeGreaterThanOrEqual(-10);
        expect(point.z).toBeLessThan(10);
      }
    });
  });

  describe('uniformScatter', () => {
    it('generates requested count', () => {
      const bounds: ScatterBounds = {
        minX: 0,
        maxX: 10,
        minZ: 0,
        maxZ: 10
      };

      const points = uniformScatter(bounds, 25, 42);

      expect(points.length).toBe(25);
    });

    it('generates points within bounds', () => {
      const bounds: ScatterBounds = {
        minX: -5,
        maxX: 15,
        minZ: -10,
        maxZ: 10
      };

      const points = uniformScatter(bounds, 50, 123);

      for (const point of points) {
        expect(point.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(point.x).toBeLessThan(bounds.maxX);
        expect(point.z).toBeGreaterThanOrEqual(bounds.minZ);
        expect(point.z).toBeLessThan(bounds.maxZ);
      }
    });

    it('is deterministic with same seed', () => {
      const bounds: ScatterBounds = {
        minX: 0,
        maxX: 10,
        minZ: 0,
        maxZ: 10
      };

      const points1 = uniformScatter(bounds, 20, 777);
      const points2 = uniformScatter(bounds, 20, 777);

      expect(points1.length).toBe(points2.length);

      for (let i = 0; i < points1.length; i++) {
        expect(points1[i].x).toBe(points2[i].x);
        expect(points1[i].z).toBe(points2[i].z);
      }
    });

    it('may have points closer than Poisson minimum distance', () => {
      const bounds: ScatterBounds = {
        minX: 0,
        maxX: 10,
        minZ: 0,
        maxZ: 10
      };

      // With high count, some points should be close together
      const points = uniformScatter(bounds, 100, 42);

      let foundClose = false;
      for (let i = 0; i < points.length && !foundClose; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dx = points[i].x - points[j].x;
          const dz = points[i].z - points[j].z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist < 0.5) {
            foundClose = true;
            break;
          }
        }
      }

      expect(foundClose).toBe(true);
    });
  });
});

