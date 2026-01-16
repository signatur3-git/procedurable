/**
 * Poisson Disk Sampling - Natural scatter patterns
 *
 * Implements Bridson's algorithm for generating evenly-spaced random points
 * with minimum distance constraints. Creates natural-looking distributions
 * (blue noise) that avoid clustering and regular grid patterns.
 *
 * Use cases:
 * - Tree placement in forests
 * - Rock scatter in terrain
 * - Clutter on surfaces
 * - Any natural distribution
 *
 * Features:
 * - Field-driven density (place more where field is high)
 * - Respects bounds
 * - Deterministic (same seed = same pattern)
 * - Fast (grid-accelerated)
 */

import { ScalarField } from './ScalarField';
import { SeededRandom } from '../builder/TracedBuilder';

/**
 * A 2D point in world space
 */
export interface Point2D {
  x: number;
  z: number;
}

/**
 * Options for Poisson disk sampling
 */
export interface PoissonDiskOptions {
  /** Minimum distance between points */
  minDistance: number;

  /** Maximum attempts to place a point around each sample */
  maxAttempts?: number;

  /** Optional density field (0-1, higher = more points) */
  densityField?: ScalarField;

  /** Threshold for density field (only place if field > threshold) */
  densityThreshold?: number;

  /** Random seed for deterministic generation */
  seed?: number;
}

/**
 * Result of Poisson disk sampling
 */
export interface PoissonDiskResult {
  points: Point2D[];
  rejectedAttempts: number;
  successfulPoints: number;
}

/**
 * Generate Poisson disk scattered points in a rectangular area
 *
 * @param bounds Rectangle bounds { minX, maxX, minZ, maxZ }
 * @param options Sampling options
 * @returns Array of scattered points
 */
export function poissonDiskScatter(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  options: PoissonDiskOptions
): PoissonDiskResult {
  const {
    minDistance,
    maxAttempts = 30,
    densityField,
    densityThreshold = 0.3,
    seed = 12345
  } = options;

  const rng = new SeededRandom(seed);
  const points: Point2D[] = [];
  const activeList: Point2D[] = [];

  // Grid for fast spatial lookup
  const cellSize = minDistance / Math.sqrt(2);
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(depth / cellSize);
  const grid: (Point2D | null)[][] = Array(rows).fill(null).map(() => Array(cols).fill(null));

  let rejectedAttempts = 0;

  /**
   * Convert world coordinates to grid coordinates
   */
  function worldToGrid(x: number, z: number): { row: number; col: number } {
    const col = Math.floor((x - bounds.minX) / cellSize);
    const row = Math.floor((z - bounds.minZ) / cellSize);
    return { row, col };
  }

  /**
   * Check if a point is valid (not too close to existing points)
   */
  function isValidPoint(x: number, z: number): boolean {
    // Check bounds
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
      return false;
    }

    // Check density field if provided
    if (densityField) {
      const density = densityField.sample(x, 0, z);
      if (density < densityThreshold) {
        return false;
      }
    }

    // Check distance to nearby points using grid
    const { row, col } = worldToGrid(x, z);
    const searchRadius = 2; // Check 5x5 neighborhood

    for (let r = Math.max(0, row - searchRadius); r <= Math.min(rows - 1, row + searchRadius); r++) {
      for (let c = Math.max(0, col - searchRadius); c <= Math.min(cols - 1, col + searchRadius); c++) {
        const neighbor = grid[r][c];
        if (neighbor) {
          const dx = x - neighbor.x;
          const dz = z - neighbor.z;
          const distSq = dx * dx + dz * dz;
          if (distSq < minDistance * minDistance) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Add a point to the results
   */
  function addPoint(x: number, z: number): void {
    const point = { x, z };
    points.push(point);
    activeList.push(point);

    const { row, col } = worldToGrid(x, z);
    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      grid[row][col] = point;
    }
  }

  /**
   * Generate a random point in an annulus around a center point
   */
  function generateRandomPointAround(center: Point2D): Point2D {
    const angle = rng.next() * Math.PI * 2;
    const radius = minDistance * (1 + rng.next()); // Between minDistance and 2*minDistance

    return {
      x: center.x + Math.cos(angle) * radius,
      z: center.z + Math.sin(angle) * radius
    };
  }

  // Step 1: Generate initial point
  const initialX = bounds.minX + rng.next() * width;
  const initialZ = bounds.minZ + rng.next() * depth;

  if (isValidPoint(initialX, initialZ)) {
    addPoint(initialX, initialZ);
  }

  // Step 2: Process active list
  while (activeList.length > 0) {
    // Pick a random active point
    const randomIndex = Math.floor(rng.next() * activeList.length);
    const activePoint = activeList[randomIndex];

    let foundValidPoint = false;

    // Try to generate points around it
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = generateRandomPointAround(activePoint);

      if (isValidPoint(candidate.x, candidate.z)) {
        addPoint(candidate.x, candidate.z);
        foundValidPoint = true;
        break;
      } else {
        rejectedAttempts++;
      }
    }

    // If no valid point found after maxAttempts, remove from active list
    if (!foundValidPoint) {
      activeList.splice(randomIndex, 1);
    }
  }

  return {
    points,
    rejectedAttempts,
    successfulPoints: points.length
  };
}

/**
 * Generate Poisson disk scatter in a circular area
 *
 * @param center Center of the circle
 * @param radius Radius of the circle
 * @param options Sampling options
 * @returns Array of scattered points
 */
export function poissonDiskCircle(
  center: { x: number; z: number },
  radius: number,
  options: PoissonDiskOptions
): PoissonDiskResult {
  // Use rectangular bounds, then filter to circle
  const bounds = {
    minX: center.x - radius,
    maxX: center.x + radius,
    minZ: center.z - radius,
    maxZ: center.z + radius
  };

  const result = poissonDiskScatter(bounds, options);

  // Filter points to only those inside the circle
  const filteredPoints = result.points.filter(p => {
    const dx = p.x - center.x;
    const dz = p.z - center.z;
    return (dx * dx + dz * dz) <= radius * radius;
  });

  return {
    points: filteredPoints,
    rejectedAttempts: result.rejectedAttempts,
    successfulPoints: filteredPoints.length
  };
}

/**
 * Helper: Create a simple density field for testing
 * Returns higher density in the center, fading to edges
 */
export function createRadialDensityField(
  center: { x: number; z: number },
  radius: number
): ScalarField {
  return {
    sample(x: number, _y: number, z: number): number {
      const dx = x - center.x;
      const dz = z - center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const normalized = Math.max(0, 1 - (dist / radius));
      return normalized;
    }
  };
}

