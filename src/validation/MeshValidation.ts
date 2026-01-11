/**
 * Mesh Validation Utilities
 *
 * Preventive design: validate that primitives produce expected dimensions
 */

import { Mesh } from '../geometry/Mesh';
import { Vec3 } from '../core/Vec3';

export interface BoundsInfo {
  min: Vec3;
  max: Vec3;
  size: Vec3;
  center: Vec3;
}

/**
 * Calculate the bounding box of a mesh
 */
export function getMeshBounds(mesh: Mesh): BoundsInfo {
  if (mesh.vertices.length === 0) {
    return {
      min: Vec3.zero(),
      max: Vec3.zero(),
      size: Vec3.zero(),
      center: Vec3.zero()
    };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const v of mesh.vertices) {
    minX = Math.min(minX, v.position.x);
    minY = Math.min(minY, v.position.y);
    minZ = Math.min(minZ, v.position.z);
    maxX = Math.max(maxX, v.position.x);
    maxY = Math.max(maxY, v.position.y);
    maxZ = Math.max(maxZ, v.position.z);
  }

  const min = new Vec3(minX, minY, minZ);
  const max = new Vec3(maxX, maxY, maxZ);
  const size = max.sub(min);
  const center = min.add(max).mul(0.5);

  return { min, max, size, center };
}

/**
 * Validate that mesh dimensions match expected values within tolerance
 */
export function validateMeshDimensions(
  mesh: Mesh,
  expectedSize: { x?: number; y?: number; z?: number },
  tolerance: number = 0.001,
  name: string = 'mesh'
): boolean {
  const bounds = getMeshBounds(mesh);
  let valid = true;

  if (expectedSize.x !== undefined) {
    const diff = Math.abs(bounds.size.x - expectedSize.x);
    if (diff > tolerance) {
      console.error(`[VALIDATION] ${name}: X size ${bounds.size.x.toFixed(4)} != expected ${expectedSize.x} (diff: ${diff.toFixed(4)})`);
      valid = false;
    }
  }

  if (expectedSize.y !== undefined) {
    const diff = Math.abs(bounds.size.y - expectedSize.y);
    if (diff > tolerance) {
      console.error(`[VALIDATION] ${name}: Y size ${bounds.size.y.toFixed(4)} != expected ${expectedSize.y} (diff: ${diff.toFixed(4)})`);
      valid = false;
    }
  }

  if (expectedSize.z !== undefined) {
    const diff = Math.abs(bounds.size.z - expectedSize.z);
    if (diff > tolerance) {
      console.error(`[VALIDATION] ${name}: Z size ${bounds.size.z.toFixed(4)} != expected ${expectedSize.z} (diff: ${diff.toFixed(4)})`);
      valid = false;
    }
  }

  return valid;
}

/**
 * Validate that mesh origin is at expected position
 */
export function validateMeshOrigin(
  mesh: Mesh,
  expectedMin: { x?: number; y?: number; z?: number },
  tolerance: number = 0.001,
  name: string = 'mesh'
): boolean {
  const bounds = getMeshBounds(mesh);
  let valid = true;

  if (expectedMin.x !== undefined) {
    const diff = Math.abs(bounds.min.x - expectedMin.x);
    if (diff > tolerance) {
      console.error(`[VALIDATION] ${name}: min X ${bounds.min.x.toFixed(4)} != expected ${expectedMin.x}`);
      valid = false;
    }
  }

  if (expectedMin.y !== undefined) {
    const diff = Math.abs(bounds.min.y - expectedMin.y);
    if (diff > tolerance) {
      console.error(`[VALIDATION] ${name}: min Y ${bounds.min.y.toFixed(4)} != expected ${expectedMin.y}`);
      valid = false;
    }
  }

  if (expectedMin.z !== undefined) {
    const diff = Math.abs(bounds.min.z - expectedMin.z);
    if (diff > tolerance) {
      console.error(`[VALIDATION] ${name}: min Z ${bounds.min.z.toFixed(4)} != expected ${expectedMin.z}`);
      valid = false;
    }
  }

  return valid;
}

/**
 * Log mesh bounds in a readable format
 */
export function logBounds(mesh: Mesh, name: string): void {
  const bounds = getMeshBounds(mesh);
  console.log(`[BOUNDS] ${name}:`);
  console.log(`  X: [${bounds.min.x.toFixed(3)}, ${bounds.max.x.toFixed(3)}] size=${bounds.size.x.toFixed(3)}`);
  console.log(`  Y: [${bounds.min.y.toFixed(3)}, ${bounds.max.y.toFixed(3)}] size=${bounds.size.y.toFixed(3)}`);
  console.log(`  Z: [${bounds.min.z.toFixed(3)}, ${bounds.max.z.toFixed(3)}] size=${bounds.size.z.toFixed(3)}`);
}

