/**
 * MorphTarget - Vertex offset sets for mesh blending
 *
 * A morph target (blend shape) is a set of per-vertex position offsets from a base mesh.
 * Blending is linear interpolation of offsets. Enables:
 * - Character body variation (lean to stocky)
 * - Facial expressions
 * - LOD transitions
 * - Procedural variation from archetypes
 *
 * Story: E3-001
 */

import { Vec3 } from '../math/Vec3';
import { Mesh } from './Mesh';

/**
 * A single vertex offset in a morph target.
 * Sparse representation - only stores non-zero deltas.
 */
export interface VertexOffset {
  /** Index into the base mesh's vertex array */
  vertexIndex: number;
  /** Position offset to add when this target is fully active */
  offset: Vec3;
}

/**
 * A named morph target containing sparse vertex offsets.
 */
export class MorphTarget {
  /** Unique name for this target (e.g., "smile", "stocky", "LOD1") */
  public readonly name: string;

  /** Sparse array of vertex offsets (only non-zero deltas stored) */
  public readonly offsets: VertexOffset[];

  /** Number of vertices in the base mesh (for validation) */
  public readonly baseVertexCount: number;

  constructor(name: string, offsets: VertexOffset[], baseVertexCount: number) {
    this.name = name;
    this.offsets = offsets;
    this.baseVertexCount = baseVertexCount;

    // Validate vertex indices are within bounds
    for (const offset of offsets) {
      if (offset.vertexIndex < 0 || offset.vertexIndex >= baseVertexCount) {
        throw new Error(
          `MorphTarget "${name}": vertex index ${offset.vertexIndex} out of bounds (0-${baseVertexCount - 1})`
        );
      }
    }
  }

  /**
   * Get the offset for a specific vertex, or zero vector if not in sparse set.
   */
  getOffset(vertexIndex: number): Vec3 {
    const entry = this.offsets.find(o => o.vertexIndex === vertexIndex);
    return entry ? entry.offset : new Vec3(0, 0, 0);
  }

  /**
   * Get number of non-zero offsets in this target.
   */
  get offsetCount(): number {
    return this.offsets.length;
  }

  /**
   * Clone this morph target.
   */
  clone(): MorphTarget {
    return new MorphTarget(
      this.name,
      this.offsets.map(o => ({
        vertexIndex: o.vertexIndex,
        offset: o.offset.clone()
      })),
      this.baseVertexCount
    );
  }

  /**
   * Scale all offsets by a factor (useful for creating intensity variants).
   */
  scaled(factor: number): MorphTarget {
    return new MorphTarget(
      this.name,
      this.offsets.map(o => ({
        vertexIndex: o.vertexIndex,
        offset: o.offset.mul(factor)
      })),
      this.baseVertexCount
    );
  }
}

/**
 * A set of morph targets associated with a base mesh.
 * Validates topology consistency and provides blending operations.
 */
export class MorphTargetSet {
  /** The base mesh that targets modify */
  private readonly baseVertexCount: number;

  /** Named morph targets */
  private readonly targets: Map<string, MorphTarget> = new Map();

  constructor(baseVertexCount: number) {
    this.baseVertexCount = baseVertexCount;
  }

  /**
   * Create a MorphTargetSet from a mesh.
   */
  static fromMesh(mesh: Mesh): MorphTargetSet {
    return new MorphTargetSet(mesh.vertices.length);
  }

  /**
   * Add a morph target to the set.
   * @throws If vertex count doesn't match or name already exists
   */
  addTarget(target: MorphTarget): void {
    if (target.baseVertexCount !== this.baseVertexCount) {
      throw new Error(
        `MorphTarget "${target.name}": vertex count ${target.baseVertexCount} doesn't match base mesh (${this.baseVertexCount})`
      );
    }
    if (this.targets.has(target.name)) {
      throw new Error(`MorphTarget "${target.name}" already exists in set`);
    }
    this.targets.set(target.name, target);
  }

  /**
   * Get a target by name.
   */
  getTarget(name: string): MorphTarget | undefined {
    return this.targets.get(name);
  }

  /**
   * Get all target names.
   */
  getTargetNames(): string[] {
    return Array.from(this.targets.keys());
  }

  /**
   * Get all targets.
   */
  getAllTargets(): MorphTarget[] {
    return Array.from(this.targets.values());
  }

  /**
   * Check if a target exists.
   */
  hasTarget(name: string): boolean {
    return this.targets.has(name);
  }

  /**
   * Remove a target by name.
   */
  removeTarget(name: string): boolean {
    return this.targets.delete(name);
  }

  /**
   * Number of targets in the set.
   */
  get size(): number {
    return this.targets.size;
  }

  /**
   * Base vertex count.
   */
  get vertexCount(): number {
    return this.baseVertexCount;
  }

  /**
   * Clone the entire set.
   */
  clone(): MorphTargetSet {
    const result = new MorphTargetSet(this.baseVertexCount);
    for (const target of this.targets.values()) {
      result.targets.set(target.name, target.clone());
    }
    return result;
  }
}

/**
 * Result of applying morph targets to a mesh.
 */
export interface MorphBlendResult {
  /** The blended mesh */
  mesh: Mesh;
  /** Which targets were applied and at what weights */
  appliedTargets: { name: string; weight: number }[];
}

/**
 * Options for morph target application.
 */
export interface MorphApplyOptions {
  /** Clamp weights to [0, 1] range. Default: false (allows extrapolation) */
  clampWeights?: boolean;
  /** Minimum weight to actually apply (skip very small weights). Default: 0.0001 */
  minWeight?: number;
}

/**
 * Apply morph targets to a base mesh.
 *
 * Blending formula: result[i] = base[i] + sum(targets[j][i] * weights[j])
 *
 * @param base The base mesh to blend from
 * @param targetSet The morph target set
 * @param weights Map of target name to blend weight (0 = base, 1 = fully morphed)
 * @param options Optional blend parameters
 * @returns A new mesh with blended vertex positions
 */
export function applyMorphTargets(
  base: Mesh,
  targetSet: MorphTargetSet,
  weights: Map<string, number> | Record<string, number>,
  options: MorphApplyOptions = {}
): MorphBlendResult {
  // Validate vertex count
  if (base.vertices.length !== targetSet.vertexCount) {
    throw new Error(
      `Mesh vertex count (${base.vertices.length}) doesn't match target set (${targetSet.vertexCount})`
    );
  }

  const {
    clampWeights = false,
    minWeight = 0.0001
  } = options;

  // Convert Record to Map if needed
  const weightMap = weights instanceof Map
    ? weights
    : new Map(Object.entries(weights));

  // Clone the base mesh
  const result = base.clone();
  const appliedTargets: { name: string; weight: number }[] = [];

  // Apply each weighted target
  for (const [name, rawWeight] of weightMap) {
    // Apply weight clamping if requested
    let weight = rawWeight;
    if (clampWeights) {
      weight = Math.max(0, Math.min(1, weight));
    }

    // Skip negligible weights
    if (Math.abs(weight) < minWeight) {
      continue;
    }

    const target = targetSet.getTarget(name);
    if (!target) {
      throw new Error(`MorphTarget "${name}" not found in set`);
    }

    // Apply offsets
    for (const { vertexIndex, offset } of target.offsets) {
      const vertex = result.vertices[vertexIndex];
      vertex.position = vertex.position.add(offset.mul(weight));
    }

    appliedTargets.push({ name, weight });
  }

  return { mesh: result, appliedTargets };
}

/**
 * Create a morph target by computing the delta between two topology-matching meshes.
 *
 * @param base The base mesh
 * @param variant The variant mesh (must have identical topology)
 * @param name Name for the resulting morph target
 * @param threshold Minimum offset magnitude to include (filters noise). Default: 0.0001
 * @returns A MorphTarget containing the position deltas
 * @throws If meshes have different vertex counts or face connectivity
 */
export function createMorphTarget(
  base: Mesh,
  variant: Mesh,
  name: string,
  threshold: number = 0.0001
): MorphTarget {
  // Validate vertex count
  if (base.vertices.length !== variant.vertices.length) {
    throw new Error(
      `Topology mismatch: base has ${base.vertices.length} vertices, variant has ${variant.vertices.length}`
    );
  }

  // Validate face connectivity
  if (base.faces.length !== variant.faces.length) {
    throw new Error(
      `Topology mismatch: base has ${base.faces.length} faces, variant has ${variant.faces.length}`
    );
  }

  for (let i = 0; i < base.faces.length; i++) {
    const baseFace = base.faces[i];
    const variantFace = variant.faces[i];

    if (baseFace.indices.length !== variantFace.indices.length) {
      throw new Error(
        `Topology mismatch at face ${i}: different vertex count (${baseFace.indices.length} vs ${variantFace.indices.length})`
      );
    }

    // Check that face indices are identical (same connectivity)
    for (let j = 0; j < baseFace.indices.length; j++) {
      if (baseFace.indices[j] !== variantFace.indices[j]) {
        throw new Error(
          `Topology mismatch at face ${i}: different vertex indices`
        );
      }
    }
  }

  // Compute position deltas
  const offsets: VertexOffset[] = [];
  for (let i = 0; i < base.vertices.length; i++) {
    const basePos = base.vertices[i].position;
    const variantPos = variant.vertices[i].position;
    const delta = variantPos.sub(basePos);

    // Only store if above threshold
    if (delta.length() > threshold) {
      offsets.push({
        vertexIndex: i,
        offset: delta
      });
    }
  }

  return new MorphTarget(name, offsets, base.vertices.length);
}

/**
 * Create a morph target from inline offset data (for YAML definitions).
 *
 * @param name Target name
 * @param offsets Array of { vertex: index, offset: {x, y, z} } objects
 * @param baseVertexCount Number of vertices in the base mesh
 * @returns A MorphTarget
 */
export function createMorphTargetFromOffsets(
  name: string,
  offsets: Array<{ vertex: number; offset: { x: number; y: number; z: number } }>,
  baseVertexCount: number
): MorphTarget {
  const morphOffsets: VertexOffset[] = offsets.map(o => ({
    vertexIndex: o.vertex,
    offset: new Vec3(o.offset.x, o.offset.y, o.offset.z)
  }));

  return new MorphTarget(name, morphOffsets, baseVertexCount);
}

/**
 * Interpolate between two morph target sets (useful for LOD blending).
 * Both sets must have the same base vertex count.
 *
 * @param setA First target set
 * @param setB Second target set
 * @param t Interpolation factor (0 = setA, 1 = setB)
 * @returns A new set with interpolated targets
 */
export function interpolateMorphTargetSets(
  setA: MorphTargetSet,
  setB: MorphTargetSet,
  t: number
): MorphTargetSet {
  if (setA.vertexCount !== setB.vertexCount) {
    throw new Error(
      `Cannot interpolate sets with different vertex counts (${setA.vertexCount} vs ${setB.vertexCount})`
    );
  }

  const result = new MorphTargetSet(setA.vertexCount);

  // Collect all unique target names
  const allNames = new Set<string>([
    ...setA.getTargetNames(),
    ...setB.getTargetNames()
  ]);

  for (const name of allNames) {
    const targetA = setA.getTarget(name);
    const targetB = setB.getTarget(name);

    if (targetA && targetB) {
      // Interpolate offsets between both targets
      const interpolatedOffsets = interpolateOffsets(
        targetA.offsets,
        targetB.offsets,
        setA.vertexCount,
        t
      );
      result.addTarget(new MorphTarget(name, interpolatedOffsets, setA.vertexCount));
    } else if (targetA) {
      // Only in A: scale down as t increases
      result.addTarget(targetA.scaled(1 - t));
    } else if (targetB) {
      // Only in B: scale up as t increases
      result.addTarget(targetB.scaled(t));
    }
  }

  return result;
}

/**
 * Helper to interpolate sparse offset arrays.
 */
function interpolateOffsets(
  offsetsA: VertexOffset[],
  offsetsB: VertexOffset[],
  _vertexCount: number,
  t: number
): VertexOffset[] {
  // Build maps for O(1) lookup
  const mapA = new Map<number, Vec3>();
  const mapB = new Map<number, Vec3>();

  for (const o of offsetsA) {
    mapA.set(o.vertexIndex, o.offset);
  }
  for (const o of offsetsB) {
    mapB.set(o.vertexIndex, o.offset);
  }

  // Collect all affected vertex indices
  const allIndices = new Set<number>([
    ...mapA.keys(),
    ...mapB.keys()
  ]);

  const result: VertexOffset[] = [];
  for (const idx of allIndices) {
    const a = mapA.get(idx) || new Vec3(0, 0, 0);
    const b = mapB.get(idx) || new Vec3(0, 0, 0);
    const interpolated = a.lerp(b, t);

    // Only include if non-zero
    if (interpolated.length() > 0.0001) {
      result.push({ vertexIndex: idx, offset: interpolated });
    }
  }

  return result;
}
