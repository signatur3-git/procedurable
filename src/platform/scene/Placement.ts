/**
 * Placement System - Constraint-based object placement
 * 
 * Used for:
 * - DiningScene chair placement (no overlaps, face table center)
 * - Future: clutter placement, environment props
 * 
 * P2-M2: Scene Constraints & Packing
 */

import { Vec3 } from '../math/Vec3';
import { AABB } from '../math/AABB';
import { Random } from '../math/Random';

/**
 * A placement candidate with position and orientation
 */
export interface PlacementCandidate {
  position: Vec3;
  rotation: number;  // Y-axis rotation in radians
  aabb: AABB;        // Bounding box at this placement (world space)
}

/**
 * Result of a placement attempt
 */
export interface PlacementResult {
  success: boolean;
  placements: PlacementCandidate[];
  rejected: number;
  reason?: string;
}

/**
 * Configuration for placement
 */
export interface PlacementConfig {
  /** Minimum distance between placed objects (XZ plane) */
  minDistance: number;
  
  /** Maximum attempts to place each object */
  maxAttempts: number;
  
  /** If true, reduce count rather than fail when space runs out */
  allowReducedCount: boolean;
  
  /** Random seed for deterministic placement */
  seed: number;
}

/**
 * Place objects around a rectangular perimeter (like chairs around a table)
 */
export function placeAroundRectangle(
  tableCenter: Vec3,
  tableWidth: number,
  tableDepth: number,
  objectAABB: AABB,  // AABB of a single object at origin
  count: number,
  config: PlacementConfig
): PlacementResult {
  const random = new Random(config.seed);
  const placements: PlacementCandidate[] = [];
  let rejected = 0;
  
  // Calculate chair dimensions
  const chairWidth = objectAABB.size.x;
  const chairDepth = objectAABB.size.z;

  // Minimum spacing between chair centers
  const minSpacing = chairWidth + config.minDistance;

  // Generate candidate positions along each side
  const candidates: { pos: Vec3; rot: number }[] = [];
  
  // Offset from table edge (half chair depth + gap)
  const edgeOffset = chairDepth / 2 + 0.15;

  // Calculate how many chairs fit on each side
  const frontBackCapacity = Math.max(1, Math.floor(tableWidth / minSpacing));
  const sideCapacity = Math.max(1, Math.floor(tableDepth / minSpacing));

  // Front side (negative Z) - chairs face +Z (toward table)
  const frontZ = tableCenter.z - tableDepth / 2 - edgeOffset;
  for (let i = 0; i < frontBackCapacity; i++) {
    // Center the chairs along the side
    const startX = tableCenter.x - (frontBackCapacity - 1) * minSpacing / 2;
    const x = startX + i * minSpacing;
    candidates.push({
      pos: new Vec3(x, tableCenter.y, frontZ),
      rot: 0  // Facing +Z (toward table)
    });
  }
  
  // Back side (positive Z) - chairs face -Z (toward table)
  const backZ = tableCenter.z + tableDepth / 2 + edgeOffset;
  for (let i = 0; i < frontBackCapacity; i++) {
    const startX = tableCenter.x - (frontBackCapacity - 1) * minSpacing / 2;
    const x = startX + i * minSpacing;
    candidates.push({
      pos: new Vec3(x, tableCenter.y, backZ),
      rot: Math.PI  // Facing -Z (toward table)
    });
  }
  
  // Left side (negative X) - chairs face +X (toward table)
  const leftX = tableCenter.x - tableWidth / 2 - edgeOffset;
  for (let i = 0; i < sideCapacity; i++) {
    const startZ = tableCenter.z - (sideCapacity - 1) * minSpacing / 2;
    const z = startZ + i * minSpacing;
    candidates.push({
      pos: new Vec3(leftX, tableCenter.y, z),
      rot: Math.PI / 2  // Facing +X (toward table)
    });
  }
  
  // Right side (positive X) - chairs face -X (toward table)
  const rightX = tableCenter.x + tableWidth / 2 + edgeOffset;
  for (let i = 0; i < sideCapacity; i++) {
    const startZ = tableCenter.z - (sideCapacity - 1) * minSpacing / 2;
    const z = startZ + i * minSpacing;
    candidates.push({
      pos: new Vec3(rightX, tableCenter.y, z),
      rot: -Math.PI / 2  // Facing -X (toward table)
    });
  }
  
  // Shuffle candidates for variety (but deterministic based on seed)
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  
  // Select up to 'count' positions, ensuring no overlaps
  const targetCount = Math.min(count, candidates.length);
  
  for (const candidate of candidates) {
    if (placements.length >= targetCount) break;
    
    // Create AABB at this position
    const placedAABB = objectAABB.translated(candidate.pos);
    
    // Check distance to all already-placed chairs
    let hasConflict = false;
    for (const existing of placements) {
      const dist = placedAABB.distanceToXZ(existing.aabb);
      if (dist < config.minDistance) {
        hasConflict = true;
        rejected++;
        break;
      }
    }
    
    if (!hasConflict) {
      placements.push({
        position: candidate.pos,
        rotation: candidate.rot,
        aabb: placedAABB
      });
    }
  }
  
  // If we couldn't place enough and allowReducedCount is false, fail
  if (placements.length < count && !config.allowReducedCount) {
    return {
      success: false,
      placements: [],
      rejected,
      reason: `Could only place ${placements.length} of ${count} objects`
    };
  }
  
  return {
    success: true,
    placements,
    rejected
  };
}

/**
 * Place objects around a circular perimeter (like chairs around a round table)
 */
export function placeAroundCircle(
  center: Vec3,
  radius: number,
  objectAABB: AABB,
  count: number,
  config: PlacementConfig
): PlacementResult {
  const random = new Random(config.seed);
  const placements: PlacementCandidate[] = [];
  let rejected = 0;
  
  // Calculate angular spacing
  const objectWidth = objectAABB.size.x;
  const circumference = 2 * Math.PI * radius;
  const maxObjects = Math.floor(circumference / Math.max(objectWidth, config.minDistance));
  const actualCount = Math.min(count, maxObjects);
  
  if (actualCount < count && !config.allowReducedCount) {
    return {
      success: false,
      placements: [],
      rejected: count - actualCount,
      reason: `Circle can only fit ${maxObjects} objects, requested ${count}`
    };
  }
  
  // Place evenly around circle with random offset
  const angleStep = (2 * Math.PI) / actualCount;
  const startAngle = random.next() * angleStep;  // Random offset for variety
  
  // Offset from circle edge (half object depth + small gap)
  const edgeOffset = objectAABB.size.z / 2 + 0.1;
  const placementRadius = radius + edgeOffset;
  
  for (let i = 0; i < actualCount; i++) {
    const angle = startAngle + i * angleStep;
    
    const x = center.x + Math.cos(angle) * placementRadius;
    const z = center.z + Math.sin(angle) * placementRadius;
    const position = new Vec3(x, center.y, z);
    
    // Rotation to face center (inward)
    const rotation = angle + Math.PI;  // Face toward center
    
    const placedAABB = objectAABB.translated(position);
    
    // Check for conflicts (shouldn't happen with even spacing, but be safe)
    let hasConflict = false;
    for (const existing of placements) {
      const distance = placedAABB.distanceToXZ(existing.aabb);
      if (distance < config.minDistance) {
        hasConflict = true;
        rejected++;
        break;
      }
    }
    
    if (!hasConflict) {
      placements.push({
        position,
        rotation,
        aabb: placedAABB
      });
    }
  }
  
  return {
    success: true,
    placements,
    rejected
  };
}

/**
 * Compute AABB for a mesh from vertex positions
 */
export function computeAABBFromVertices(positions: number[]): AABB {
  const aabb = new AABB();
  for (let i = 0; i < positions.length; i += 3) {
    aabb.expandToInclude(new Vec3(positions[i], positions[i + 1], positions[i + 2]));
  }
  return aabb;
}
