/**
 * Poisson Disk Sampling Tests
 *
 * Tests for natural scatter pattern generation
 */

import { describe, it, expect } from '@jest/globals';
import { poissonDiskScatter, poissonDiskCircle, createRadialDensityField } from '../../platform/spatial/PoissonDisk';
import { field } from '../../platform/spatial/ScalarField';

describe('PoissonDisk - Basic Scatter', () => {
  describe('poissonDiskScatter', () => {
    it('should generate points within bounds', () => {
      const bounds = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };
      const result = poissonDiskScatter(bounds, {
        minDistance: 1.0,
        seed: 42
      });

      expect(result.points.length).toBeGreaterThan(0);

      // All points should be within bounds
      for (const p of result.points) {
        expect(p.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(p.x).toBeLessThanOrEqual(bounds.maxX);
        expect(p.z).toBeGreaterThanOrEqual(bounds.minZ);
        expect(p.z).toBeLessThanOrEqual(bounds.maxZ);
      }
    });

    it('should respect minimum distance constraint', () => {
      const bounds = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };
      const minDistance = 2.0;

      const result = poissonDiskScatter(bounds, {
        minDistance,
        seed: 42
      });

      // Check all pairs of points
      for (let i = 0; i < result.points.length; i++) {
        for (let j = i + 1; j < result.points.length; j++) {
          const p1 = result.points[i];
          const p2 = result.points[j];
          const dx = p2.x - p1.x;
          const dz = p2.z - p1.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          expect(dist).toBeGreaterThanOrEqual(minDistance - 0.0001); // Small tolerance for floating point
        }
      }
    });

    it('should be deterministic with same seed', () => {
      const bounds = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };
      const options = { minDistance: 1.0, seed: 123 };

      const result1 = poissonDiskScatter(bounds, options);
      const result2 = poissonDiskScatter(bounds, options);

      expect(result1.points.length).toBe(result2.points.length);

      for (let i = 0; i < result1.points.length; i++) {
        expect(result1.points[i].x).toBeCloseTo(result2.points[i].x, 10);
        expect(result1.points[i].z).toBeCloseTo(result2.points[i].z, 10);
      }
    });

    it('should produce different results with different seeds', () => {
      const bounds = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };

      const result1 = poissonDiskScatter(bounds, { minDistance: 1.0, seed: 1 });
      const result2 = poissonDiskScatter(bounds, { minDistance: 1.0, seed: 2 });

      // Should have different first points
      expect(result1.points[0].x).not.toBeCloseTo(result2.points[0].x, 5);
    });

    it('should generate fewer points with larger minimum distance', () => {
      const bounds = { minX: 0, maxX: 20, minZ: 0, maxZ: 20 };

      const resultSmall = poissonDiskScatter(bounds, {
        minDistance: 1.0,
        seed: 42
      });

      const resultLarge = poissonDiskScatter(bounds, {
        minDistance: 3.0,
        seed: 42
      });

      expect(resultLarge.points.length).toBeLessThan(resultSmall.points.length);
    });

    it('should handle small areas gracefully', () => {
      const bounds = { minX: 0, maxX: 2, minZ: 0, maxZ: 2 };

      const result = poissonDiskScatter(bounds, {
        minDistance: 1.5,
        seed: 42
      });

      // Should have at least 1 point, but not many
      expect(result.points.length).toBeGreaterThan(0);
      expect(result.points.length).toBeLessThan(5);
    });
  });

  describe('poissonDiskCircle', () => {
    it('should generate points within circular bounds', () => {
      const center = { x: 5, z: 5 };
      const radius = 5;

      const result = poissonDiskCircle(center, radius, {
        minDistance: 1.0,
        seed: 42
      });

      expect(result.points.length).toBeGreaterThan(0);

      // All points should be within radius
      for (const p of result.points) {
        const dx = p.x - center.x;
        const dz = p.z - center.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        expect(dist).toBeLessThanOrEqual(radius + 0.0001);
      }
    });

    it('should respect minimum distance in circular area', () => {
      const center = { x: 0, z: 0 };
      const radius = 10;
      const minDistance = 2.0;

      const result = poissonDiskCircle(center, radius, {
        minDistance,
        seed: 42
      });

      // Check all pairs
      for (let i = 0; i < result.points.length; i++) {
        for (let j = i + 1; j < result.points.length; j++) {
          const p1 = result.points[i];
          const p2 = result.points[j];
          const dx = p2.x - p1.x;
          const dz = p2.z - p1.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          expect(dist).toBeGreaterThanOrEqual(minDistance - 0.0001);
        }
      }
    });
  });
});

describe('PoissonDisk - Field-Driven Density', () => {
  it('should place more points where density field is high', () => {
    const bounds = { minX: 0, maxX: 20, minZ: 0, maxZ: 20 };

    // High density on left half, low density on right half
    const densityField = {
      sample(x: number, _y: number, _z: number): number {
        return x < 10 ? 1.0 : 0.2;
      }
    };

    const result = poissonDiskScatter(bounds, {
      minDistance: 1.5,
      densityField,
      densityThreshold: 0.5,
      seed: 42
    });

    // Count points on each half
    let leftCount = 0;
    let rightCount = 0;
    for (const p of result.points) {
      if (p.x < 10) leftCount++;
      else rightCount++;
    }

    // Left half should have significantly more points
    expect(leftCount).toBeGreaterThan(rightCount * 2);
  });

  it('should use radial density field correctly', () => {
    const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
    const center = { x: 0, z: 0 };
    const radius = 8;

    const densityField = createRadialDensityField(center, radius);

    const result = poissonDiskScatter(bounds, {
      minDistance: 1.2,
      densityField,
      densityThreshold: 0.3,
      seed: 42
    });

    // Most points should be near center
    let centerCount = 0;
    let edgeCount = 0;

    for (const p of result.points) {
      const dx = p.x - center.x;
      const dz = p.z - center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < radius * 0.5) centerCount++;
      else if (dist > radius * 0.8) edgeCount++;
    }

    // Should have more points near center than edge
    expect(centerCount).toBeGreaterThan(edgeCount);
  });

  it('should work with scalar field from ScalarField module', () => {
    const bounds = { minX: 0, maxX: 20, minZ: 0, maxZ: 20 };

    // Use noise field as density mask
    const densityField = field.clamp(
      field.noise2d(123, 0.1, 1.0),
      0, 1
    );

    const result = poissonDiskScatter(bounds, {
      minDistance: 1.5,
      densityField,
      densityThreshold: 0.4,
      seed: 42
    });

    expect(result.points.length).toBeGreaterThan(0);

    // All points should satisfy density threshold
    for (const p of result.points) {
      const density = densityField.sample(p.x, 0, p.z);
      expect(density).toBeGreaterThanOrEqual(0.4 - 0.01); // Small tolerance
    }
  });

  it('should reject points below density threshold', () => {
    const bounds = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };

    // Very sparse density field
    const densityField = {
      sample(x: number, _y: number, z: number): number {
        // Only high density in small center area
        return (x > 4 && x < 6 && z > 4 && z < 6) ? 1.0 : 0.0;
      }
    };

    const result = poissonDiskScatter(bounds, {
      minDistance: 0.5,
      densityField,
      densityThreshold: 0.8,
      seed: 42
    });

    // All points should be in center area
    for (const p of result.points) {
      expect(p.x).toBeGreaterThan(4);
      expect(p.x).toBeLessThan(6);
      expect(p.z).toBeGreaterThan(4);
      expect(p.z).toBeLessThan(6);
    }
  });
});

describe('PoissonDisk - Performance & Statistics', () => {
  it('should report rejected attempts', () => {
    const bounds = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };

    const result = poissonDiskScatter(bounds, {
      minDistance: 1.0,
      seed: 42
    });

    expect(result.rejectedAttempts).toBeGreaterThan(0);
    expect(result.successfulPoints).toBe(result.points.length);
  });

  it('should handle edge cases without crashing', () => {
    // Very small area
    const result1 = poissonDiskScatter(
      { minX: 0, maxX: 1, minZ: 0, maxZ: 1 },
      { minDistance: 0.5, seed: 42 }
    );
    expect(result1.points.length).toBeGreaterThan(0);

    // Large minimum distance (can fit very few points)
    const result2 = poissonDiskScatter(
      { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
      { minDistance: 8.0, seed: 42 }
    );
    expect(result2.points.length).toBeGreaterThan(0);
    expect(result2.points.length).toBeLessThan(5);
  });

  it('should be reasonably fast for moderate areas', () => {
    const start = Date.now();

    const result = poissonDiskScatter(
      { minX: 0, maxX: 100, minZ: 0, maxZ: 100 },
      { minDistance: 2.0, seed: 42 }
    );

    const elapsed = Date.now() - start;

    expect(result.points.length).toBeGreaterThan(100);
    expect(elapsed).toBeLessThan(2000); // Should complete in under 2 seconds (allows for system load variation)
  });
});

describe('PoissonDisk - Real World Examples', () => {
  it('should create forest scatter pattern', () => {
    // 50m x 50m forest area
    const bounds = { minX: 0, maxX: 50, minZ: 0, maxZ: 50 };

    // Trees need 3-5m spacing
    const result = poissonDiskScatter(bounds, {
      minDistance: 3.5,
      seed: 12345
    });

    // Should have reasonable tree count
    expect(result.points.length).toBeGreaterThan(50);
    expect(result.points.length).toBeLessThan(250);
  });

  it('should create rock scatter with density mask', () => {
    // 20m x 20m area with rocky patches
    const bounds = { minX: 0, maxX: 20, minZ: 0, maxZ: 20 };

    // More rocks in certain areas (use noise)
    const rockyAreas = field.clamp(
      field.noise2d(777, 0.1, 1.0),
      0, 1
    );

    const result = poissonDiskScatter(bounds, {
      minDistance: 1.2,
      densityField: rockyAreas,
      densityThreshold: 0.4,
      seed: 888
    });

    expect(result.points.length).toBeGreaterThan(0);

    // Verify all rocks are in valid areas
    for (const rock of result.points) {
      const density = rockyAreas.sample(rock.x, 0, rock.z);
      expect(density).toBeGreaterThanOrEqual(0.4 - 0.01);
    }
  });

  it('should create table clutter pattern', () => {
    // 1.2m x 0.8m table surface
    const bounds = { minX: 0, maxX: 1.2, minZ: 0, maxZ: 0.8 };

    // Clutter items need 10-15cm spacing
    const result = poissonDiskScatter(bounds, {
      minDistance: 0.12,
      seed: 999
    });

    // Should have reasonable number of items
    expect(result.points.length).toBeGreaterThan(10);
    expect(result.points.length).toBeLessThan(100);
  });

  it('should create clearing in forest', () => {
    // Forest with a clearing in the center
    const bounds = { minX: -25, maxX: 25, minZ: -25, maxZ: 25 };

    // Density = 0 in center, high elsewhere
    const forestWithClearing = {
      sample(x: number, _y: number, z: number): number {
        const distFromCenter = Math.sqrt(x * x + z * z);
        return distFromCenter < 10 ? 0 : 1; // 10m radius clearing
      }
    };

    const result = poissonDiskScatter(bounds, {
      minDistance: 4.0,
      densityField: forestWithClearing,
      densityThreshold: 0.5,
      seed: 555
    });

    // No points should be in clearing
    for (const tree of result.points) {
      const distFromCenter = Math.sqrt(tree.x * tree.x + tree.z * tree.z);
      expect(distFromCenter).toBeGreaterThanOrEqual(10);
    }
  });
});

