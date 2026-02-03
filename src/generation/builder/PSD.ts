/**
 * PSD - Procedurable Scene Description v0.1
 *
 * Serializable intermediate representation between builders and consumers
 * (renderers, exporters, agents). Inspired by USD but scoped to what
 * Procedurable needs now.
 *
 * Design:
 * - Flat map of prims with parent references (not nested tree)
 * - USD-like paths: /Root/child/grandchild
 * - Three prim types: Mesh, Instance, Xform
 * - Material slots prepared for C3
 * - Skeleton/weight stubs for Phase 3
 *
 * B2-001, B2-002
 */

import type { TracedOutput, TracedSkeleton, VertexWeights, TracedMorphTargetSet } from './TracedBuilder';
import type { Mesh } from '../../platform/geometry/Mesh';
import type { FaceColor } from '../../platform/geometry/Face';

// ============================================================================
// Scene
// ============================================================================

/**
 * Top-level scene container
 */
export interface PSDScene {
  /** Format version */
  version: '0.1';

  /** Scene name (typically the builder name) */
  name: string;

  /** Generator info: "BuilderName seed=42" */
  generator: string;

  /** Flat map of path → prim. All prims in the scene. */
  prims: Record<string, PSDPrim>;

  /** Scene-wide material definitions, referenced by index from mesh prims */
  materials: PSDMaterial[];

  /** F4-002: Non-spatial connections between prims (gear mesh, joints, etc.) */
  connections?: PSDConnection[];

  /** Optional metadata (build time, quality tier, etc.) */
  metadata?: Record<string, any>;
}

// ============================================================================
// Transforms & Bounds
// ============================================================================

/**
 * 3D transform (position, rotation, scale)
 */
export interface PSDTransform {
  /** Translation [x, y, z] */
  position: [number, number, number];

  /** Euler rotation in radians [x, y, z] */
  rotation: [number, number, number];

  /** Scale [x, y, z] (uniform = same values) */
  scale: [number, number, number];
}

/**
 * Axis-aligned bounding box
 */
export interface PSDBox {
  /** Minimum corner [x, y, z] */
  min: [number, number, number];

  /** Maximum corner [x, y, z] */
  max: [number, number, number];
}

/** Identity transform (no translation, rotation, or scale change) */
export const PSD_IDENTITY_TRANSFORM: PSDTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1]
};

/** Zero-volume bounding box */
export const PSD_EMPTY_BOX: PSDBox = {
  min: [0, 0, 0],
  max: [0, 0, 0]
};

// ============================================================================
// Materials
// ============================================================================

/**
 * PBR material definition
 */
export interface PSDMaterial {
  /** Material name (e.g. "oak_wood", "steel") */
  name: string;

  /** Base color [r, g, b] in 0-1 range */
  color: [number, number, number];

  /** Roughness 0-1 (0 = mirror, 1 = matte). Default: 0.5 */
  roughness: number;

  /** Metalness 0-1 (0 = dielectric, 1 = metal). Default: 0.0 */
  metalness: number;
}

// ============================================================================
// Connections (F4-002: Assembly Metadata)
// ============================================================================

/**
 * Connection - Non-spatial relationship between prims
 *
 * Used for mechanical assemblies, gear meshing, constraints, etc.
 * Example: "gear_a meshes with gear_b at ratio 3.5"
 */
export interface PSDConnection {
  /** Connection type (e.g., "gear_mesh", "axle_joint", "weld", "hinge") */
  type: string;

  /** Source prim path */
  from: string;

  /** Target prim path */
  to: string;

  /** Connection-specific data (e.g., gear ratio, joint limits) */
  data?: Record<string, any>;

  /** Optional description */
  description?: string;
}

// ============================================================================
// Ports (B5-001: Attachment Points)
// ============================================================================

/**
 * Port - Named attachment point for composition
 *
 * Ports define where child builders can attach to parent builders.
 * When composing, a child's port can snap to a parent's port, auto-computing
 * offset and rotation from port alignment.
 */
export interface PSDPort {
  /** Port name (e.g., "table_surface", "lamp_base") */
  name: string;

  /** Position in local space [x, y, z] */
  position: [number, number, number];

  /** Normal direction (outward-facing) [x, y, z] */
  normal: [number, number, number];

  /** Optional up vector for full orientation [x, y, z] */
  up?: [number, number, number];

  /** Optional reference to a named edge loop */
  loop?: string;

  /** Optional metadata (e.g., snap type, constraints) */
  metadata?: Record<string, any>;
}

// ============================================================================
// Skeleton (E1-001: Skeleton Declaration)
// ============================================================================

/**
 * Joint constraint types for skeleton rigging
 */
export type PSDJointConstraintType = 'hinge' | 'ball_and_socket' | 'fixed';

/**
 * Joint constraint definition for animation
 */
export interface PSDJointConstraint {
  /** Constraint type */
  type: PSDJointConstraintType;

  /** For hinge constraints: which axis the joint rotates around */
  axis?: 'x' | 'y' | 'z';

  /** Rotation limits */
  limits?: {
    min?: number;
    max?: number;
    pitch?: [number, number];
    yaw?: [number, number];
    roll?: [number, number];
  };
}

/**
 * Joint in a skeleton hierarchy
 */
export interface PSDJoint {
  /** Joint name (unique within skeleton) */
  name: string;

  /** Parent joint name (null for root joints) */
  parent: string | null;

  /** Rest-pose transform in local space (relative to parent) */
  restTransform: PSDTransform;

  /** Rest-pose world position [x, y, z] */
  worldPosition: [number, number, number];

  /** Optional constraints for animation */
  constraints?: PSDJointConstraint;
}

/**
 * Complete skeleton for a mesh
 */
export interface PSDSkeleton {
  /** All joints in the skeleton */
  joints: PSDJoint[];

  /** Root joint names (joints with no parent) */
  roots: string[];
}

// ============================================================================
// Morph Targets (E3-001, E3-002)
// ============================================================================

/**
 * A single vertex offset in a morph target
 */
export interface PSDMorphOffset {
  /** Index of the vertex to offset */
  vertexIndex: number;
  /** Position offset [dx, dy, dz] */
  offset: [number, number, number];
}

/**
 * Morph target (blend shape) for a mesh
 *
 * Morph targets define per-vertex position offsets that can be blended
 * with a weight (0 = base mesh, 1 = fully morphed). Multiple targets
 * can be combined additively.
 */
export interface PSDMorphTarget {
  /** Target name (e.g., "smile", "stocky", "LOD1") */
  name: string;

  /** Sparse array of vertex offsets (only non-zero deltas stored) */
  offsets: PSDMorphOffset[];

  /** Default blend weight (0-1, typically 0) */
  defaultWeight: number;

  /** Optional description of what this target does */
  description?: string;
}

// ============================================================================
// Geometry
// ============================================================================

/**
 * Mesh geometry data — flat arrays for efficient serialization
 */
export interface PSDGeometry {
  /** Vertex positions, flat: [x,y,z, x,y,z, ...] */
  vertices: number[];

  /** Vertex normals, flat: [nx,ny,nz, ...]. Same length as vertices. */
  normals: number[];

  /** Triangle indices into vertices array (3 per triangle) */
  indices: number[];

  /** UV coordinates, flat: [u,v, ...]. Optional, stub for C4. */
  uvs?: number[];

  /** Per-vertex colors, flat: [r,g,b, ...]. Optional. */
  colors?: number[];
}

// ============================================================================
// Prims
// ============================================================================

/**
 * Base prim — common fields for all prim types
 */
export interface PSDPrimBase {
  /** USD-like path: "/Root/table/leg_0" */
  path: string;

  /** Prim type discriminator */
  type: 'Mesh' | 'Instance' | 'Xform';

  /** Parent prim path, null for root */
  parent: string | null;

  /** Local-space transform relative to parent */
  transform: PSDTransform;

  /** Semantic tags for queries (e.g. ["furniture", "seating"]) */
  tags: string[];

  /** Local-space axis-aligned bounding box */
  bounds: PSDBox;

  /** Builder that created this prim */
  builderName?: string;

  /** Child prim paths (denormalized for convenience) */
  children: string[];
}

/**
 * Mesh prim — contains geometry data
 */
export interface PSDMeshPrim extends PSDPrimBase {
  type: 'Mesh';

  /** Geometry data (vertices, normals, indices) */
  geometry: PSDGeometry;

  /** Per-face material slot index into scene.materials[]. Length = triangle count. */
  materialSlots: number[];

  /** Named attachment points (B5-001) */
  ports?: PSDPort[];

  // ---- Rigging (E1-001, E2-001) ----

  /** Skeleton for this mesh. Undefined if mesh has no skeleton. */
  skeleton?: PSDSkeleton;

  /**
   * Joint weights per vertex (E2-001).
   * Flat array: [v0_j0, v0_w0, v0_j1, v0_w1, ..., v0_jN, v0_wN, v1_j0, v1_w0, ...]
   * Each vertex has up to maxInfluences pairs of (jointIndex, weight).
   * Padded with (-1, 0) if fewer influences.
   */
  jointWeights?: number[];

  /** Number of influences per vertex (typically 4) */
  maxInfluences?: number;

  /** Weight statistics */
  weightStats?: {
    totalVertices: number;
    weightedVertices: number;
    unweightedVertices: number;
  };

  // ---- Morph Targets (E3-001, E3-002) ----

  /**
   * Morph targets (blend shapes) for this mesh.
   * Each target defines vertex position offsets that can be blended.
   */
  morphTargets?: PSDMorphTarget[];
}

/**
 * Instance prim — references a prototype prim (no duplicated geometry)
 */
export interface PSDInstancePrim extends PSDPrimBase {
  type: 'Instance';

  /** Path to the prototype prim (must be a Mesh or Xform with Mesh children) */
  prototype: string;

  /** Decision overrides applied to this instance */
  overrides?: Record<string, any>;

  /** Seed used to generate this instance */
  seed?: number;
}

/**
 * Xform prim — pure transform grouping node (no geometry)
 */
export interface PSDXformPrim extends PSDPrimBase {
  type: 'Xform';
}

/**
 * Union of all prim types
 */
export type PSDPrim = PSDMeshPrim | PSDInstancePrim | PSDXformPrim;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a path is valid PSD format (must start with /)
 */
export function isValidPSDPath(path: string): boolean {
  return path.startsWith('/') && !path.endsWith('/') && path.length > 1;
}

/**
 * Get the parent path from a prim path.
 * E.g. "/Root/table/leg" → "/Root/table"
 */
export function getParentPath(path: string): string | null {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash <= 0) return null;  // root or invalid
  return path.substring(0, lastSlash);
}

/**
 * Get the name (last segment) from a prim path.
 * E.g. "/Root/table/leg" → "leg"
 */
export function getPrimName(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return path.substring(lastSlash + 1);
}

/**
 * Validate parent-child consistency in a PSD scene.
 * Returns array of error messages (empty = valid).
 */
export function validatePSDScene(scene: PSDScene): string[] {
  const errors: string[] = [];

  for (const [path, prim] of Object.entries(scene.prims)) {
    // Path must match key
    if (prim.path !== path) {
      errors.push(`Prim key '${path}' does not match prim.path '${prim.path}'`);
    }

    // Path must be valid
    if (!isValidPSDPath(path)) {
      errors.push(`Invalid prim path: '${path}' (must start with / and not end with /)`);
    }

    // Parent must exist (unless null)
    if (prim.parent !== null && !scene.prims[prim.parent]) {
      errors.push(`Prim '${path}' references non-existent parent '${prim.parent}'`);
    }

    // Children must exist
    for (const childPath of prim.children) {
      if (!scene.prims[childPath]) {
        errors.push(`Prim '${path}' lists non-existent child '${childPath}'`);
      }
    }

    // Children must reference back to this prim as parent
    for (const childPath of prim.children) {
      const child = scene.prims[childPath];
      if (child && child.parent !== path) {
        errors.push(`Child '${childPath}' parent is '${child.parent}', expected '${path}'`);
      }
    }

    // Mesh prims: material indices in bounds
    if (prim.type === 'Mesh') {
      const meshPrim = prim as PSDMeshPrim;
      for (let i = 0; i < meshPrim.materialSlots.length; i++) {
        if (meshPrim.materialSlots[i] < 0 || meshPrim.materialSlots[i] >= scene.materials.length) {
          errors.push(`Prim '${path}' materialSlots[${i}] = ${meshPrim.materialSlots[i]} out of bounds (${scene.materials.length} materials)`);
        }
      }

      // Validate skeleton if present (E1-001)
      if (meshPrim.skeleton) {
        const skeleton = meshPrim.skeleton;
        const jointNames = new Set(skeleton.joints.map(j => j.name));

        // Check for duplicate joint names
        if (jointNames.size !== skeleton.joints.length) {
          errors.push(`Prim '${path}' skeleton has duplicate joint names`);
        }

        // Check parent references
        for (const joint of skeleton.joints) {
          if (joint.parent !== null && !jointNames.has(joint.parent)) {
            errors.push(`Prim '${path}' skeleton joint '${joint.name}' references non-existent parent '${joint.parent}'`);
          }
        }

        // Check roots array
        for (const root of skeleton.roots) {
          if (!jointNames.has(root)) {
            errors.push(`Prim '${path}' skeleton roots references non-existent joint '${root}'`);
          }
        }
      }
    }

    // Instance prims: prototype must exist
    if (prim.type === 'Instance') {
      const instPrim = prim as PSDInstancePrim;
      if (!scene.prims[instPrim.prototype]) {
        errors.push(`Instance '${path}' references non-existent prototype '${instPrim.prototype}'`);
      }
    }
  }

  return errors;
}

/**
 * Create an empty PSD scene
 */
export function createEmptyPSDScene(name: string, generator: string): PSDScene {
  return {
    version: '0.1',
    name,
    generator,
    prims: {},
    materials: []
  };
}

// ============================================================================
// Serialization (B2-002)
// ============================================================================

/**
 * Color key for deduplication (rounded to avoid floating point mismatches)
 */
function colorKey(c: FaceColor): string {
  return `${Math.round(c.r * 1000)},${Math.round(c.g * 1000)},${Math.round(c.b * 1000)}`;
}

/**
 * Extract unique materials from a mesh's face colors.
 * Returns the materials list and per-face (triangulated) material slot indices.
 */
export function extractMaterials(mesh: Mesh): { materials: PSDMaterial[]; slots: number[] } {
  const defaultColor: FaceColor = { r: 0.545, g: 0.353, b: 0.169 };
  const colorMap = new Map<string, number>(); // colorKey → material index
  const materials: PSDMaterial[] = [];
  const slots: number[] = [];

  // Triangulate first to match per-triangle material slots
  const triangulated = mesh.triangulate();

  for (const face of triangulated.faces) {
    const c = face.color || defaultColor;
    const key = colorKey(c);

    let idx = colorMap.get(key);
    if (idx === undefined) {
      idx = materials.length;
      colorMap.set(key, idx);
      materials.push({
        name: `material_${idx}`,
        color: [c.r, c.g, c.b],
        roughness: 0.5,
        metalness: 0.0
      });
    }
    slots.push(idx);
  }

  return { materials, slots };
}

/**
 * Serialize a Mesh to PSD geometry (flat arrays, unrolled for flat shading).
 */
function serializeMeshGeometry(mesh: Mesh): PSDGeometry {
  const triangulated = mesh.triangulate();
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  let hasColors = false;
  let hasUVs = false;

  const defaultColor: FaceColor = { r: 0.545, g: 0.353, b: 0.169 };
  let vertIdx = 0;

  for (const face of triangulated.faces) {
    const vert0 = triangulated.vertices[face.indices[0]];
    const vert1 = triangulated.vertices[face.indices[1]];
    const vert2 = triangulated.vertices[face.indices[2]];

    const v0 = vert0.position;
    const v1 = vert1.position;
    const v2 = vert2.position;

    // Face normal for flat shading
    const edge1x = v1.x - v0.x, edge1y = v1.y - v0.y, edge1z = v1.z - v0.z;
    const edge2x = v2.x - v0.x, edge2y = v2.y - v0.y, edge2z = v2.z - v0.z;
    let nx = edge1y * edge2z - edge1z * edge2y;
    let ny = edge1z * edge2x - edge1x * edge2z;
    let nz = edge1x * edge2y - edge1y * edge2x;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) { nx /= len; ny /= len; nz /= len; }

    // Unroll 3 vertices per triangle
    vertices.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    indices.push(vertIdx, vertIdx + 1, vertIdx + 2);

    const c = face.color || defaultColor;
    if (face.color) hasColors = true;
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);

    // UVs (if present on vertices)
    const uv0 = vert0.attributes.uv || [0, 0];
    const uv1 = vert1.attributes.uv || [0, 0];
    const uv2 = vert2.attributes.uv || [0, 0];
    if (vert0.attributes.uv || vert1.attributes.uv || vert2.attributes.uv) {
      hasUVs = true;
    }
    uvs.push(uv0[0], uv0[1], uv1[0], uv1[1], uv2[0], uv2[1]);

    vertIdx += 3;
  }

  const geom: PSDGeometry = { vertices, normals, indices };
  if (hasColors) geom.colors = colors;
  if (hasUVs) geom.uvs = uvs;
  return geom;
}

/**
 * Compute PSD bounding box from a TracedOutput's validation bounds.
 */
function boundsToBox(bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }): PSDBox {
  return {
    min: [bounds.min.x, bounds.min.y, bounds.min.z],
    max: [bounds.max.x, bounds.max.y, bounds.max.z]
  };
}

/**
 * Convert a TracedSkeleton to PSDSkeleton format (E1-001)
 */
function tracedSkeletonToPSD(skeleton: TracedSkeleton): PSDSkeleton {
  const joints: PSDJoint[] = skeleton.joints.map(joint => ({
    name: joint.name,
    parent: joint.parent,
    restTransform: {
      position: [joint.position.x, joint.position.y, joint.position.z],
      rotation: [joint.orientation.x, joint.orientation.y, joint.orientation.z],
      scale: [1, 1, 1]
    },
    worldPosition: [joint.worldPosition.x, joint.worldPosition.y, joint.worldPosition.z],
    constraints: joint.constraints ? {
      type: joint.constraints.type,
      axis: joint.constraints.axis,
      limits: joint.constraints.limits
    } : undefined
  }));

  return {
    joints,
    roots: skeleton.roots
  };
}

/**
 * Convert VertexWeights to flat array format for PSD (E2-001)
 *
 * Format: flat array where each vertex has maxInfluences pairs of (jointIndex, weight)
 * Vertices without weights are padded with (-1, 0) pairs
 */
function vertexWeightsToPSD(
  weights: VertexWeights,
  totalVertices: number
): { data: number[]; maxInfluences: number } {
  const maxInfluences = weights.maxInfluences;
  const data: number[] = [];

  for (let vi = 0; vi < totalVertices; vi++) {
    const vw = weights.weights.get(vi) ?? [];

    for (let i = 0; i < maxInfluences; i++) {
      if (i < vw.length) {
        data.push(vw[i].jointIndex, vw[i].weight);
      } else {
        // Pad with invalid joint index and zero weight
        data.push(-1, 0);
      }
    }
  }

  return { data, maxInfluences };
}

/**
 * Convert TracedMorphTargetSet to PSD format (E3-002)
 */
function tracedMorphTargetsToPSD(morphTargets: TracedMorphTargetSet): PSDMorphTarget[] {
  return morphTargets.targets.map(target => ({
    name: target.name,
    offsets: target.offsets.map(o => ({
      vertexIndex: o.vertexIndex,
      offset: [o.offset.x, o.offset.y, o.offset.z] as [number, number, number]
    })),
    defaultWeight: target.defaultWeight,
    description: target.description
  }));
}

/**
 * Serialize a TracedOutput into a PSDScene.
 *
 * Structure:
 *   /{builderName}                          (Xform — root)
 *   /{builderName}/mesh                     (Mesh — merged geometry, if any)
 *   /{builderName}/__prototypes__            (Xform — prototype group, if instances)
 *   /{builderName}/__prototypes__/{name}    (Mesh — prototype mesh)
 *   /{builderName}/{instanceId}             (Instance — references prototype)
 */
export function serializeToPSD(output: TracedOutput): PSDScene {
  const rootPath = `/${output.builderName}`;
  const scene = createEmptyPSDScene(output.builderName, `${output.builderName} seed=${output.seed}`);

  scene.metadata = {
    buildTime: output.buildTime,
    seed: output.seed,
    vertexCount: output.validation.vertexCount,
    faceCount: output.validation.faceCount
  };

  const rootChildren: string[] = [];

  // ---- Materials (from merged mesh) ----
  const hasMergedGeometry = output.mesh.vertices.length > 0;
  let mergedSlots: number[] = [];

  if (hasMergedGeometry) {
    const extracted = extractMaterials(output.mesh);
    scene.materials = extracted.materials;
    mergedSlots = extracted.slots;
  }

  // ---- Merged Mesh Prim ----
  if (hasMergedGeometry) {
    const meshPath = `${rootPath}/mesh`;
    rootChildren.push(meshPath);

    // Convert ports from TracedOutput (B5-001)
    const ports: PSDPort[] = [];
    if (output.ports) {
      for (const [_name, port] of output.ports) {
        ports.push({
          name: port.name,
          position: [port.position.x, port.position.y, port.position.z],
          normal: [port.normal.x, port.normal.y, port.normal.z],
          up: port.up ? [port.up.x, port.up.y, port.up.z] : undefined,
          loop: port.loop,
          metadata: port.metadata
        });
      }
    }

    // Convert vertex weights if present
    let jointWeights: number[] | undefined;
    let maxInfluences: number | undefined;
    let weightStats: { totalVertices: number; weightedVertices: number; unweightedVertices: number } | undefined;

    if (output.vertexWeights) {
      const converted = vertexWeightsToPSD(output.vertexWeights, output.mesh.vertices.length);
      jointWeights = converted.data;
      maxInfluences = converted.maxInfluences;
      weightStats = {
        totalVertices: output.vertexWeights.stats.totalVertices,
        weightedVertices: output.vertexWeights.stats.weightedVertices,
        unweightedVertices: output.vertexWeights.stats.unweightedVertices
      };
    }

    const meshPrim: PSDMeshPrim = {
      path: meshPath,
      type: 'Mesh',
      parent: rootPath,
      transform: { ...PSD_IDENTITY_TRANSFORM },
      tags: [],
      bounds: boundsToBox(output.validation.bounds),
      builderName: output.builderName,
      children: [],
      geometry: serializeMeshGeometry(output.mesh),
      materialSlots: mergedSlots,
      ports: ports.length > 0 ? ports : undefined,
      skeleton: output.skeleton ? tracedSkeletonToPSD(output.skeleton) : undefined,
      jointWeights,
      maxInfluences,
      weightStats,
      morphTargets: output.morphTargets ? tracedMorphTargetsToPSD(output.morphTargets) : undefined
    };
    scene.prims[meshPath] = meshPrim;
  }

  // ---- Merged Sub-Builder Prims (H3-001: Semantic prims for composed-but-merged sub-builders) ----
  // Create Xform prims for sub-builders that were merged (not asInstance), so they can be queried by tag.
  if (output.subBuilders.size > 0) {
    const instanceIds = new Set((output.instances ?? []).map(i => i.id));
    for (const [instanceName, subOutput] of output.subBuilders) {
      // Skip sub-builders that are already represented as instance prims
      if (instanceIds.has(instanceName)) continue;
      // Skip if no tags — not worth adding an empty prim
      if (!subOutput.tags || Object.keys(subOutput.tags).length === 0) continue;

      const subPrimPath = `${rootPath}/${instanceName}`;
      const subTags: string[] = Object.entries(subOutput.tags).map(([k, v]) => `${k}:${v}`);

      // Get compose offset from trace
      const composeTrace = output.traces.get(`compose:${instanceName}`);
      const offset = composeTrace?.details?.offset as { x: number; y: number; z: number } | undefined;

      const subXform: PSDXformPrim = {
        path: subPrimPath,
        type: 'Xform',
        parent: rootPath,
        transform: {
          position: offset ? [offset.x, offset.y, offset.z] : [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        },
        tags: subTags,
        bounds: boundsToBox(subOutput.validation.bounds),
        children: []
      };
      scene.prims[subPrimPath] = subXform;
      rootChildren.push(subPrimPath);
    }
  }

  // ---- Instances ----
  if (output.instances && output.instances.length > 0) {
    // Collect unique prototypes
    const prototypeBuilders = new Map<string, TracedOutput>();
    for (const inst of output.instances) {
      if (!prototypeBuilders.has(inst.builderName)) {
        // Find the sub-builder output for this prototype
        const subOutput = output.subBuilders.get(inst.id);
        if (subOutput) {
          prototypeBuilders.set(inst.builderName, subOutput);
        }
      }
    }

    // Create prototypes group if we have any
    if (prototypeBuilders.size > 0) {
      const protosPath = `${rootPath}/__prototypes__`;
      rootChildren.push(protosPath);
      const protoChildren: string[] = [];

      for (const [builderName, subOutput] of prototypeBuilders) {
        const protoPath = `${protosPath}/${builderName}`;
        protoChildren.push(protoPath);

        // Extract materials from prototype and merge into scene materials
        const protoExtracted = extractMaterials(subOutput.mesh);
        const materialOffset = scene.materials.length;
        scene.materials.push(...protoExtracted.materials);
        const protoSlots = protoExtracted.slots.map(s => s + materialOffset);

        // Convert vertex weights for prototype if present
        let protoJointWeights: number[] | undefined;
        let protoMaxInfluences: number | undefined;
        let protoWeightStats: { totalVertices: number; weightedVertices: number; unweightedVertices: number } | undefined;

        if (subOutput.vertexWeights) {
          const converted = vertexWeightsToPSD(subOutput.vertexWeights, subOutput.mesh.vertices.length);
          protoJointWeights = converted.data;
          protoMaxInfluences = converted.maxInfluences;
          protoWeightStats = {
            totalVertices: subOutput.vertexWeights.stats.totalVertices,
            weightedVertices: subOutput.vertexWeights.stats.weightedVertices,
            unweightedVertices: subOutput.vertexWeights.stats.unweightedVertices
          };
        }

        const protoPrim: PSDMeshPrim = {
          path: protoPath,
          type: 'Mesh',
          parent: protosPath,
          transform: { ...PSD_IDENTITY_TRANSFORM },
          tags: [],
          bounds: boundsToBox(subOutput.validation.bounds),
          builderName,
          children: [],
          geometry: serializeMeshGeometry(subOutput.mesh),
          materialSlots: protoSlots,
          skeleton: subOutput.skeleton ? tracedSkeletonToPSD(subOutput.skeleton) : undefined,
          jointWeights: protoJointWeights,
          maxInfluences: protoMaxInfluences,
          weightStats: protoWeightStats,
          morphTargets: subOutput.morphTargets ? tracedMorphTargetsToPSD(subOutput.morphTargets) : undefined
        };
        scene.prims[protoPath] = protoPrim;
      }

      const protosXform: PSDXformPrim = {
        path: protosPath,
        type: 'Xform',
        parent: rootPath,
        transform: { ...PSD_IDENTITY_TRANSFORM },
        tags: ['prototype_group'],
        bounds: { ...PSD_EMPTY_BOX },
        children: protoChildren
      };
      scene.prims[protosPath] = protosXform;
    }

    // Create instance prims
    for (const inst of output.instances) {
      const instPath = `${rootPath}/${inst.id}`;
      rootChildren.push(instPath);

      const pos = inst.transform.position;
      const rot = inst.transform.rotation || { x: 0, y: 0, z: 0 };
      const scl = inst.transform.scale;
      const sclArr: [number, number, number] = typeof scl === 'number'
        ? [scl, scl, scl]
        : scl ? [scl.x, scl.y, scl.z] : [1, 1, 1];

      // Propagate sub-builder tags to instance prim (H3-001)
      const subBuilderOutput = output.subBuilders.get(inst.id);
      const instTags: string[] = [];
      if (subBuilderOutput?.tags) {
        for (const [k, v] of Object.entries(subBuilderOutput.tags)) {
          instTags.push(`${k}:${v}`);
        }
      }

      const instPrim: PSDInstancePrim = {
        path: instPath,
        type: 'Instance',
        parent: rootPath,
        transform: {
          position: [pos.x, pos.y, pos.z],
          rotation: [rot.x, rot.y, rot.z],
          scale: sclArr
        },
        tags: instTags,
        bounds: { ...PSD_EMPTY_BOX },  // Instance bounds computed from prototype + transform
        children: [],
        prototype: `${rootPath}/__prototypes__/${inst.builderName}`,
        overrides: inst.overrides,
        seed: inst.seed
      };
      scene.prims[instPath] = instPrim;
    }
  }

  // ---- Root Xform ----
  const rootPrim: PSDXformPrim = {
    path: rootPath,
    type: 'Xform',
    parent: null,
    transform: { ...PSD_IDENTITY_TRANSFORM },
    tags: [],
    bounds: boundsToBox(output.validation.bounds),
    builderName: output.builderName,
    children: rootChildren
  };
  scene.prims[rootPath] = rootPrim;

  // ---- F4-002: Assembly Connections ----
  if (output.connections && output.connections.length > 0) {
    scene.connections = output.connections.map(conn => ({
      type: conn.type,
      from: conn.from,
      to: conn.to,
      data: conn.data,
      description: conn.description
    }));
  }

  return scene;
}

// ============================================================================
// Deserialization (B2-002)
// ============================================================================

/**
 * Deserialized PSD data — renderable form
 */
export interface DeserializedPSD {
  /** Merged geometry (from all Mesh prims, combined) */
  vertices: number[];
  normals: number[];
  colors: number[];
  uvs: number[];
  triangleCount: number;

  /** Instance data for non-merged geometry */
  instances: Array<{
    prototypePath: string;
    prototypeVertices: number[];
    prototypeNormals: number[];
    prototypeColors: number[];
    prototypeTriangleCount: number;
    transform: PSDTransform;
    seed?: number;
  }>;

  /** All materials in the scene */
  materials: PSDMaterial[];

  /** Metadata */
  name: string;
  primCount: number;
}

/**
 * Deserialize a PSDScene back into renderable data.
 */
export function deserializePSD(scene: PSDScene): DeserializedPSD {
  const vertices: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  let triangleCount = 0;

  const instances: DeserializedPSD['instances'] = [];

  for (const prim of Object.values(scene.prims)) {
    if (prim.type === 'Mesh') {
      // Skip prototypes — they are rendered via instances
      if (prim.path.includes('/__prototypes__/')) continue;

      const geom = prim.geometry;
      vertices.push(...geom.vertices);
      normals.push(...geom.normals);

      // UVs (if present)
      if (geom.uvs) {
        uvs.push(...geom.uvs);
      } else {
        // Fill with zeros for missing UVs (2 per vertex, 3 vertices per triangle)
        const vertexCount = geom.vertices.length / 3;
        for (let i = 0; i < vertexCount; i++) {
          uvs.push(0, 0);
        }
      }

      // Reconstruct colors from materialSlots
      const meshPrim = prim as PSDMeshPrim;
      for (let t = 0; t < meshPrim.materialSlots.length; t++) {
        const mat = scene.materials[meshPrim.materialSlots[t]];
        if (mat) {
          // 3 vertices per triangle
          colors.push(mat.color[0], mat.color[1], mat.color[2]);
          colors.push(mat.color[0], mat.color[1], mat.color[2]);
          colors.push(mat.color[0], mat.color[1], mat.color[2]);
        }
      }

      triangleCount += geom.indices.length / 3;
    }

    if (prim.type === 'Instance') {
      const instPrim = prim as PSDInstancePrim;
      const proto = scene.prims[instPrim.prototype];
      if (proto && proto.type === 'Mesh') {
        const protoMesh = proto as PSDMeshPrim;
        const protoColors: number[] = [];
        for (let t = 0; t < protoMesh.materialSlots.length; t++) {
          const mat = scene.materials[protoMesh.materialSlots[t]];
          if (mat) {
            protoColors.push(mat.color[0], mat.color[1], mat.color[2]);
            protoColors.push(mat.color[0], mat.color[1], mat.color[2]);
            protoColors.push(mat.color[0], mat.color[1], mat.color[2]);
          }
        }

        instances.push({
          prototypePath: instPrim.prototype,
          prototypeVertices: [...protoMesh.geometry.vertices],
          prototypeNormals: [...protoMesh.geometry.normals],
          prototypeColors: protoColors,
          prototypeTriangleCount: protoMesh.geometry.indices.length / 3,
          transform: instPrim.transform,
          seed: instPrim.seed
        });
      }
    }
  }

  return {
    vertices,
    normals,
    colors,
    uvs,
    triangleCount,
    instances,
    materials: scene.materials,
    name: scene.name,
    primCount: Object.keys(scene.prims).length
  };
}

// ============================================================================
// Scene Queries (B2-003)
// ============================================================================

/**
 * Collect all tags from a prim and all its descendants (recursive).
 * Returns a unique set of tags.
 */
export function collectAggregatedTags(scene: PSDScene, primPath: string): string[] {
  const prim = scene.prims[primPath];
  if (!prim) return [];

  const tagSet = new Set<string>(prim.tags);

  for (const childPath of prim.children) {
    const childTags = collectAggregatedTags(scene, childPath);
    childTags.forEach(t => tagSet.add(t));
  }

  return Array.from(tagSet);
}

/**
 * Find all prims that have a specific tag (or whose descendants have it).
 * Returns array of prim paths.
 */
export function queryByTag(scene: PSDScene, tag: string): string[] {
  const results: string[] = [];

  // Support two query forms:
  //   "key:value" → exact match against "key:value" tag strings
  //   "key" → match any tag string that starts with "key:" or equals "key"
  const isKeyValue = tag.includes(':');

  for (const path of Object.keys(scene.prims)) {
    // Check if this prim or any of its descendants has the tag
    const aggregatedTags = collectAggregatedTags(scene, path);
    const matched = isKeyValue
      ? aggregatedTags.includes(tag)
      : aggregatedTags.some(t => t === tag || t.startsWith(`${tag}:`));
    if (matched) {
      results.push(path);
    }
  }

  return results;
}

/**
 * Get the AABB bounds for a prim.
 */
export function getPrimBounds(scene: PSDScene, primPath: string): PSDBox | null {
  const prim = scene.prims[primPath];
  if (!prim) return null;
  return prim.bounds;
}

/**
 * Get the center point of a prim's bounding box.
 */
export function getPrimCenter(bounds: PSDBox): [number, number, number] {
  return [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2
  ];
}

/**
 * Get all root prims (prims with parent === null).
 */
export function getRootPrims(scene: PSDScene): string[] {
  return Object.values(scene.prims)
    .filter(p => p.parent === null)
    .map(p => p.path);
}

/**
 * Get hierarchy list of all prims with depth information.
 */
export interface PrimHierarchyEntry {
  path: string;
  type: 'Mesh' | 'Instance' | 'Xform';
  depth: number;
  childCount: number;
  tags: string[];
}

export function listPrimsHierarchy(scene: PSDScene): PrimHierarchyEntry[] {
  const results: PrimHierarchyEntry[] = [];

  function visit(path: string, depth: number) {
    const prim = scene.prims[path];
    if (!prim) return;

    results.push({
      path: prim.path,
      type: prim.type,
      depth,
      childCount: prim.children.length,
      tags: prim.tags
    });

    for (const childPath of prim.children) {
      visit(childPath, depth + 1);
    }
  }

  // Start from root prims
  const roots = getRootPrims(scene);
  for (const root of roots) {
    visit(root, 0);
  }

  return results;
}

/**
 * Get overview of top-level prims with aggregated metadata.
 */
export interface PrimOverview {
  path: string;
  type: 'Mesh' | 'Instance' | 'Xform';
  childCount: number;
  descendantCount: number;
  combinedBounds: PSDBox;
  aggregatedTags: string[];
}

function countDescendants(scene: PSDScene, primPath: string): number {
  const prim = scene.prims[primPath];
  if (!prim) return 0;

  let count = prim.children.length;
  for (const childPath of prim.children) {
    count += countDescendants(scene, childPath);
  }
  return count;
}

function combineBounds(scene: PSDScene, primPath: string): PSDBox {
  const prim = scene.prims[primPath];
  if (!prim) return { ...PSD_EMPTY_BOX };

  // Start with this prim's bounds
  let minX = prim.bounds.min[0], minY = prim.bounds.min[1], minZ = prim.bounds.min[2];
  let maxX = prim.bounds.max[0], maxY = prim.bounds.max[1], maxZ = prim.bounds.max[2];

  // Recursively combine with children
  for (const childPath of prim.children) {
    const childBounds = combineBounds(scene, childPath);
    minX = Math.min(minX, childBounds.min[0]);
    minY = Math.min(minY, childBounds.min[1]);
    minZ = Math.min(minZ, childBounds.min[2]);
    maxX = Math.max(maxX, childBounds.max[0]);
    maxY = Math.max(maxY, childBounds.max[1]);
    maxZ = Math.max(maxZ, childBounds.max[2]);
  }

  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

export function getOverview(scene: PSDScene): PrimOverview[] {
  const roots = getRootPrims(scene);
  return roots.map(path => {
    const prim = scene.prims[path];
    return {
      path,
      type: prim.type,
      childCount: prim.children.length,
      descendantCount: countDescendants(scene, path),
      combinedBounds: combineBounds(scene, path),
      aggregatedTags: collectAggregatedTags(scene, path)
    };
  });
}

/**
 * Inspect a specific prim — returns its direct children details.
 */
export interface PrimInspection {
  path: string;
  type: 'Mesh' | 'Instance' | 'Xform';
  tags: string[];
  bounds: PSDBox;
  transform: PSDTransform;
  children: Array<{
    path: string;
    type: 'Mesh' | 'Instance' | 'Xform';
    tags: string[];
    childCount: number;
  }>;
  // Additional details based on type
  materialSlots?: number[];
  triangleCount?: number;
  prototype?: string;
}

export function inspectPrim(scene: PSDScene, primPath: string): PrimInspection | null {
  const prim = scene.prims[primPath];
  if (!prim) return null;

  const result: PrimInspection = {
    path: prim.path,
    type: prim.type,
    tags: prim.tags,
    bounds: prim.bounds,
    transform: prim.transform,
    children: prim.children.map(cp => {
      const child = scene.prims[cp];
      return {
        path: cp,
        type: child?.type || 'Xform',
        tags: child?.tags || [],
        childCount: child?.children.length || 0
      };
    })
  };

  if (prim.type === 'Mesh') {
    const meshPrim = prim as PSDMeshPrim;
    result.materialSlots = meshPrim.materialSlots;
    result.triangleCount = meshPrim.geometry.indices.length / 3;
  }

  if (prim.type === 'Instance') {
    const instPrim = prim as PSDInstancePrim;
    result.prototype = instPrim.prototype;
  }

  return result;
}

/**
 * Get all materials used in the scene.
 */
export interface MaterialAssignment {
  material: PSDMaterial;
  usedBy: string[];  // prim paths
  triangleCount: number;
}

export function getMaterialAssignments(scene: PSDScene): MaterialAssignment[] {
  const assignments: MaterialAssignment[] = scene.materials.map(m => ({
    material: m,
    usedBy: [],
    triangleCount: 0
  }));

  for (const prim of Object.values(scene.prims)) {
    if (prim.type === 'Mesh') {
      const meshPrim = prim as PSDMeshPrim;
      const usedMaterials = new Set<number>();
      for (const slot of meshPrim.materialSlots) {
        usedMaterials.add(slot);
        if (assignments[slot]) {
          assignments[slot].triangleCount++;
        }
      }
      for (const matIdx of usedMaterials) {
        if (assignments[matIdx]) {
          assignments[matIdx].usedBy.push(prim.path);
        }
      }
    }
  }

  return assignments;
}

/**
 * Calculate distance between two prims.
 * Returns both center-to-center and approximate surface-to-surface distance.
 */
export interface PrimDistance {
  primA: string;
  primB: string;
  centerToCenter: number;
  surfaceToSurface: number;  // approximation using bounding boxes
}

function distance3D(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function boxRadius(bounds: PSDBox): number {
  // Approximate radius as half-diagonal of bounding box
  const dx = bounds.max[0] - bounds.min[0];
  const dy = bounds.max[1] - bounds.min[1];
  const dz = bounds.max[2] - bounds.min[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz) / 2;
}

export function calculateDistance(scene: PSDScene, pathA: string, pathB: string): PrimDistance | null {
  const primA = scene.prims[pathA];
  const primB = scene.prims[pathB];
  if (!primA || !primB) return null;

  const centerA = getPrimCenter(primA.bounds);
  const centerB = getPrimCenter(primB.bounds);

  const centerToCenter = distance3D(centerA, centerB);

  // Surface-to-surface is approximate: center distance minus the radii
  const radiusA = boxRadius(primA.bounds);
  const radiusB = boxRadius(primB.bounds);
  const surfaceToSurface = Math.max(0, centerToCenter - radiusA - radiusB);

  return {
    primA: pathA,
    primB: pathB,
    centerToCenter,
    surfaceToSurface
  };
}

/**
 * Find prims within a radius of a given prim.
 * Uses bounding box center for distance calculation.
 */
export function findPrimsWithin(scene: PSDScene, centerPath: string, radius: number): string[] {
  const centerPrim = scene.prims[centerPath];
  if (!centerPrim) return [];

  const center = getPrimCenter(centerPrim.bounds);
  const results: string[] = [];

  for (const [path, prim] of Object.entries(scene.prims)) {
    if (path === centerPath) continue;  // Skip self

    const primCenter = getPrimCenter(prim.bounds);
    const dist = distance3D(center, primCenter);

    // Check if bounding boxes could possibly intersect with the search sphere
    const primRadius = boxRadius(prim.bounds);
    if (dist - primRadius <= radius) {
      results.push(path);
    }
  }

  return results;
}
