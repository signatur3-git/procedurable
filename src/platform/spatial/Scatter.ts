/**
 * Scatter.ts - Point distribution algorithms for world placement
 * Implements Poisson disk sampling for natural object placement
 */

import { Random } from '../math/Random';

export interface Vec2 {
  x: number;
  z: number;
}

export interface ScatterBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PoissonConfig {
  /** Random seed for deterministic results */
  seed: number;
  /** Minimum distance between points */
  minDistance: number;
  /** Maximum attempts to place a point near each sample */
  maxAttempts?: number;
  /** Optional density mask function (0-1, higher = denser) */
  densityMask?: (x: number, z: number) => number;
}

/**
 * Generate points using Bridson's Poisson disk sampling algorithm
 * Ensures natural-looking distribution with minimum distance constraint
 *
 * @param bounds The rectangular area to scatter points within
 * @param config Configuration for the scatter algorithm
 * @returns Array of 2D points
 */
export function poissonDiskSample(
  bounds: ScatterBounds,
  config: PoissonConfig
): Vec2[] {
  const { minDistance, maxAttempts = 30, densityMask } = config;
  const random = new Random(config.seed);

  // Grid for spatial lookup (much faster than checking all points)
  const cellSize = minDistance / Math.sqrt(2);
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const gridWidth = Math.ceil(width / cellSize);
  const gridDepth = Math.ceil(depth / cellSize);

  // Grid stores point indices (or -1 for empty)
  const grid: number[][] = Array(gridWidth).fill(null).map(() =>
    Array(gridDepth).fill(-1)
  );

  const points: Vec2[] = [];
  const activeList: number[] = []; // Indices of points to try spawning from

  /**
   * Convert world position to grid coordinates
   */
  function worldToGrid(x: number, z: number): { gx: number; gz: number } {
    return {
      gx: Math.floor((x - bounds.minX) / cellSize),
      gz: Math.floor((z - bounds.minZ) / cellSize)
    };
  }

  /**
   * Check if a point is valid (within bounds, not too close to others)
   */
  function isValid(x: number, z: number): boolean {
    // Check bounds
    if (x < bounds.minX || x >= bounds.maxX || z < bounds.minZ || z >= bounds.maxZ) {
      return false;
    }

    // Check distance to nearby points using grid
    const { gx, gz } = worldToGrid(x, z);

    // Check cells in a 5x5 neighborhood (2 cells in each direction)
    const searchRadius = 2;
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dz = -searchRadius; dz <= searchRadius; dz++) {
        const checkX = gx + dx;
        const checkZ = gz + dz;

        if (checkX < 0 || checkX >= gridWidth || checkZ < 0 || checkZ >= gridDepth) {
          continue;
        }

        const pointIdx = grid[checkX][checkZ];
        if (pointIdx !== -1) {
          const other = points[pointIdx];
          const distSq = (x - other.x) ** 2 + (z - other.z) ** 2;

          // Apply density mask to minimum distance if provided
          let effectiveMinDist = minDistance;
          if (densityMask) {
            // Average density between the two points
            const density1 = densityMask(x, z);
            const density2 = densityMask(other.x, other.z);
            const avgDensity = (density1 + density2) / 2;
            // Higher density = smaller minimum distance
            effectiveMinDist = minDistance * (1.0 - 0.5 * avgDensity);
          }

          if (distSq < effectiveMinDist ** 2) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Add a point to the grid and active list
   */
  function addPoint(x: number, z: number): void {
    const idx = points.length;
    points.push({ x, z });
    activeList.push(idx);

    const { gx, gz } = worldToGrid(x, z);
    grid[gx][gz] = idx;
  }

  // Start with one random point in the center area
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const initialRadius = Math.min(width, depth) * 0.2;
  const angle = random.next() * Math.PI * 2;
  const r = random.next() * initialRadius;
  addPoint(
    centerX + Math.cos(angle) * r,
    centerZ + Math.sin(angle) * r
  );

  // Main loop: keep trying to spawn new points around active points
  while (activeList.length > 0) {
    // Pick a random active point
    const activeIdx = Math.floor(random.next() * activeList.length);
    const pointIdx = activeList[activeIdx];
    const point = points[pointIdx];

    let found = false;

    // Try to spawn a new point near this one
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate random point in annulus (ring) around this point
      const angle = random.next() * Math.PI * 2;
      const radius = minDistance + random.next() * minDistance;

      const newX = point.x + Math.cos(angle) * radius;
      const newZ = point.z + Math.sin(angle) * radius;

      if (isValid(newX, newZ)) {
        addPoint(newX, newZ);
        found = true;
        break;
      }
    }

    // If no valid point found after all attempts, remove from active list
    if (!found) {
      activeList.splice(activeIdx, 1);
    }
  }

  return points;
}

/**
 * Simple uniform random scatter (for comparison/fallback)
 */
export function uniformScatter(
  bounds: ScatterBounds,
  count: number,
  seed: number
): Vec2[] {
  const random = new Random(seed);
  const points: Vec2[] = [];

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;

  for (let i = 0; i < count; i++) {
    points.push({
      x: bounds.minX + random.next() * width,
      z: bounds.minZ + random.next() * depth
    });
  }

  return points;
}

