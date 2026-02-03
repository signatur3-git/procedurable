/**
 * ViewDependentGenerator - View-dependent generation (G2-002)
 *
 * Given a camera position and direction, determine which chunks/objects to generate
 * and at what LOD. Distant objects get lower LOD, off-screen objects are skipped entirely.
 */

import { Vec3 } from '../math/Vec3';
import { TerrainChunk, generateTerrainChunk, TerrainChunkOptions } from './TerrainChunk';

/**
 * Camera view configuration
 */
export interface ViewConfig {
  /** Camera position in world space */
  position: Vec3;
  /** Camera look direction (normalized) */
  direction: Vec3;
  /** Horizontal field of view in radians (default: Math.PI / 2 = 90°) */
  fovHorizontal?: number;
  /** Vertical field of view in radians (default: Math.PI / 3 = 60°) */
  fovVertical?: number;
  /** Maximum view distance */
  range: number;
}

/**
 * LOD configuration for view-dependent generation
 */
export interface LODConfig {
  /** Distance thresholds for LOD transitions (sorted ascending) */
  lodDistances: number[];
  /** Maximum LOD tier (default: 4) */
  maxLOD?: number;
}

/**
 * Default LOD distance thresholds
 * - LOD 4 (highest detail): 0-25m
 * - LOD 3: 25-50m
 * - LOD 2: 50-100m
 * - LOD 1: 100-200m
 * - LOD 0 (lowest detail): 200m+
 */
export const DEFAULT_LOD_DISTANCES = [25, 50, 100, 200];

/**
 * Object with computed LOD information
 */
export interface LODObject {
  /** Object identifier */
  id: string;
  /** Object center position */
  position: Vec3;
  /** Distance from camera */
  distance: number;
  /** Assigned LOD tier (0 = lowest, 4 = highest) */
  lodTier: number;
  /** Whether the object is within the view frustum */
  isVisible: boolean;
  /** Angle from camera direction (0 = directly ahead) */
  angleFromView: number;
}

/**
 * View-dependent terrain chunk with LOD
 */
export interface LODTerrainChunk extends TerrainChunk {
  /** Distance from camera to chunk center */
  distance: number;
  /** Assigned LOD tier */
  lodTier: number;
  /** Whether the chunk is within the view frustum */
  isVisible: boolean;
}

/**
 * Result of view-dependent generation
 */
export interface ViewGenerationResult {
  /** Camera configuration used */
  view: ViewConfig;
  /** LOD configuration used */
  lodConfig: LODConfig;
  /** Generated terrain chunks with LOD */
  terrainChunks: LODTerrainChunk[];
  /** Objects with computed LOD */
  objects: LODObject[];
  /** Statistics */
  stats: {
    totalChunks: number;
    visibleChunks: number;
    skippedChunks: number;
    lodDistribution: Record<number, number>;
    totalObjects?: number;
    visibleObjects?: number;
    skippedObjects?: number;
  };
}

/**
 * Compute LOD tier based on distance
 *
 * @param distance Distance from camera
 * @param lodDistances Sorted array of distance thresholds
 * @param maxLOD Maximum LOD tier (default: 4)
 * @returns LOD tier (0 = lowest, maxLOD = highest)
 */
export function computeLODTier(
  distance: number,
  lodDistances: number[] = DEFAULT_LOD_DISTANCES,
  maxLOD: number = 4
): number {
  // LOD tier decreases as distance increases
  // If distance < lodDistances[0], return maxLOD (highest detail)
  // If distance >= lodDistances[lodDistances.length - 1], return 0 (lowest detail)
  for (let i = 0; i < lodDistances.length; i++) {
    if (distance < lodDistances[i]) {
      return maxLOD - i;
    }
  }
  return 0;
}

/**
 * Check if a point is within the view frustum (simplified cone test)
 *
 * @param cameraPos Camera position
 * @param cameraDir Camera look direction (normalized)
 * @param point Point to test
 * @param range Maximum view distance
 * @param fovHorizontal Horizontal FOV in radians
 * @param fovVertical Vertical FOV in radians (optional, uses horizontal if not provided)
 * @returns Object with visibility status and angle from view direction
 */
export function isInViewFrustum(
  cameraPos: Vec3,
  cameraDir: Vec3,
  point: Vec3,
  range: number,
  fovHorizontal: number,
  fovVertical?: number
): { isVisible: boolean; distance: number; angle: number } {
  const toPoint = point.sub(cameraPos);
  const distance = toPoint.length();

  // Beyond range = not visible
  if (distance > range) {
    return { isVisible: false, distance, angle: Math.PI };
  }

  // If point is at camera position, it's visible
  if (distance < 0.0001) {
    return { isVisible: true, distance: 0, angle: 0 };
  }

  // Compute angle between camera direction and direction to point
  const dirToPoint = toPoint.normalize();
  const dot = cameraDir.dot(dirToPoint);
  // Clamp dot product to valid range for acos
  const clampedDot = Math.max(-1, Math.min(1, dot));
  const angle = Math.acos(clampedDot);

  // Use the larger of the two half-FOVs for a simplified cone test
  const effectiveFOV = fovVertical ? Math.max(fovHorizontal, fovVertical) : fovHorizontal;
  const halfFOV = effectiveFOV / 2;

  // Point is visible if angle is within half-FOV
  // We add a small margin (10%) to avoid popping at edges
  const margin = 1.1;
  const isVisible = angle <= halfFOV * margin;

  return { isVisible, distance, angle };
}

/**
 * Compute LOD information for an object
 *
 * @param objectId Object identifier
 * @param objectPos Object center position
 * @param view Camera view configuration
 * @param lodConfig LOD configuration
 * @returns LOD object information
 */
export function computeObjectLOD(
  objectId: string,
  objectPos: Vec3,
  view: ViewConfig,
  lodConfig: LODConfig
): LODObject {
  const fovH = view.fovHorizontal ?? Math.PI / 2;
  const fovV = view.fovVertical ?? Math.PI / 3;

  const { isVisible, distance, angle } = isInViewFrustum(
    view.position,
    view.direction,
    objectPos,
    view.range,
    fovH,
    fovV
  );

  const lodTier = isVisible
    ? computeLODTier(distance, lodConfig.lodDistances, lodConfig.maxLOD ?? 4)
    : 0;

  return {
    id: objectId,
    position: objectPos,
    distance,
    lodTier,
    isVisible,
    angleFromView: angle
  };
}

/**
 * Generate terrain chunks visible from the camera with appropriate LOD
 *
 * @param view Camera view configuration
 * @param terrainOptions Terrain generation options
 * @param lodConfig LOD configuration
 * @returns View-dependent generation result
 */
export function generateViewDependentTerrain(
  view: ViewConfig,
  terrainOptions: Omit<TerrainChunkOptions, 'segments'>,
  lodConfig: LODConfig = { lodDistances: DEFAULT_LOD_DISTANCES }
): ViewGenerationResult {
  const chunkSize = terrainOptions.chunkSize ?? 64;
  const fovH = view.fovHorizontal ?? Math.PI / 2;
  const fovV = view.fovVertical ?? Math.PI / 3;
  const maxLOD = lodConfig.maxLOD ?? 4;

  // Determine chunk range to consider based on camera position and range
  const minChunkX = Math.floor((view.position.x - view.range) / chunkSize);
  const maxChunkX = Math.ceil((view.position.x + view.range) / chunkSize);
  const minChunkZ = Math.floor((view.position.z - view.range) / chunkSize);
  const maxChunkZ = Math.ceil((view.position.z + view.range) / chunkSize);

  const chunks: LODTerrainChunk[] = [];
  const stats = {
    totalChunks: 0,
    visibleChunks: 0,
    skippedChunks: 0,
    lodDistribution: {} as Record<number, number>
  };

  // Initialize LOD distribution
  for (let i = 0; i <= maxLOD; i++) {
    stats.lodDistribution[i] = 0;
  }

  // Evaluate each potential chunk
  for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      stats.totalChunks++;

      // Compute chunk center
      const chunkCenterX = (cx + 0.5) * chunkSize;
      const chunkCenterZ = (cz + 0.5) * chunkSize;
      const chunkCenter = new Vec3(chunkCenterX, view.position.y, chunkCenterZ);

      // Check visibility
      const { isVisible, distance } = isInViewFrustum(
        view.position,
        view.direction,
        chunkCenter,
        view.range,
        fovH,
        fovV
      );

      if (!isVisible) {
        stats.skippedChunks++;
        continue;
      }

      stats.visibleChunks++;

      // Compute LOD tier
      const lodTier = computeLODTier(distance, lodConfig.lodDistances, maxLOD);
      stats.lodDistribution[lodTier]++;

      // Adjust segment count based on LOD tier
      // Higher LOD = more segments
      const baseSegments = 16;
      const segmentsForLOD = Math.max(4, Math.floor(baseSegments * (lodTier + 1) / (maxLOD + 1)));

      // Generate the chunk
      const chunk = generateTerrainChunk(cx, cz, {
        ...terrainOptions,
        segments: segmentsForLOD
      });

      chunks.push({
        ...chunk,
        distance,
        lodTier,
        isVisible: true
      });
    }
  }

  return {
    view,
    lodConfig,
    terrainChunks: chunks,
    objects: [],  // Objects would be added separately
    stats
  };
}

/**
 * Generate a view-dependent scene with terrain and objects
 *
 * @param view Camera view configuration
 * @param objects Array of objects with positions to evaluate
 * @param terrainOptions Optional terrain generation options
 * @param lodConfig LOD configuration
 * @returns View-dependent generation result
 */
export function generateView(
  view: ViewConfig,
  objects: Array<{ id: string; position: Vec3 }>,
  terrainOptions?: Omit<TerrainChunkOptions, 'segments'>,
  lodConfig: LODConfig = { lodDistances: DEFAULT_LOD_DISTANCES }
): ViewGenerationResult {
  // Generate terrain if options provided
  let terrainResult: ViewGenerationResult | null = null;
  if (terrainOptions) {
    terrainResult = generateViewDependentTerrain(view, terrainOptions, lodConfig);
  }

  // Compute LOD for all objects
  const lodObjects: LODObject[] = objects.map(obj =>
    computeObjectLOD(obj.id, obj.position, view, lodConfig)
  );

  // Compute object stats
  const maxLOD = lodConfig.maxLOD ?? 4;
  const objectLodDistribution: Record<number, number> = {};
  for (let i = 0; i <= maxLOD; i++) {
    objectLodDistribution[i] = lodObjects.filter(o => o.isVisible && o.lodTier === i).length;
  }

  // Merge stats - combine terrain LOD distribution with object LOD distribution
  const terrainLodDist = terrainResult?.stats.lodDistribution ?? {};
  const combinedLodDistribution: Record<number, number> = {};
  for (let i = 0; i <= maxLOD; i++) {
    combinedLodDistribution[i] = (terrainLodDist[i] ?? 0) + (objectLodDistribution[i] ?? 0);
  }

  const stats = {
    totalChunks: terrainResult?.stats.totalChunks ?? 0,
    visibleChunks: terrainResult?.stats.visibleChunks ?? 0,
    skippedChunks: terrainResult?.stats.skippedChunks ?? 0,
    lodDistribution: combinedLodDistribution,
    totalObjects: lodObjects.length,
    visibleObjects: lodObjects.filter(o => o.isVisible).length,
    skippedObjects: lodObjects.filter(o => !o.isVisible).length
  };

  return {
    view,
    lodConfig,
    terrainChunks: terrainResult?.terrainChunks ?? [],
    objects: lodObjects,
    stats
  };
}

/**
 * Sort objects by distance from camera (nearest first)
 * Useful for front-to-back rendering
 *
 * @param objects Array of LOD objects
 * @returns Sorted array (nearest first)
 */
export function sortByDistance(objects: LODObject[]): LODObject[] {
  return [...objects].sort((a, b) => a.distance - b.distance);
}

/**
 * Filter objects to only visible ones
 *
 * @param objects Array of LOD objects
 * @returns Array of visible objects only
 */
export function filterVisible(objects: LODObject[]): LODObject[] {
  return objects.filter(o => o.isVisible);
}

/**
 * Get objects at a specific LOD tier
 *
 * @param objects Array of LOD objects
 * @param tier LOD tier to filter by
 * @returns Array of objects at the specified tier
 */
export function getObjectsAtLOD(objects: LODObject[], tier: number): LODObject[] {
  return objects.filter(o => o.isVisible && o.lodTier === tier);
}
