/**
 * Instance - Representation for non-merged scene objects
 *
 * For large scenes with many similar objects (trees, rocks, clutter),
 * merging all geometry into a single mesh is inefficient. Instead,
 * we represent them as instances - references to a base mesh with
 * transforms applied.
 *
 * Benefits:
 * - GPU instancing (render 1000s of objects efficiently)
 * - Lower memory usage (one mesh, many transforms)
 * - Faster generation (no mesh merging)
 * - Easier updates (modify instance without rebuilding mesh)
 *
 * Use cases:
 * - Forest with 1000s of trees
 * - Rock scatter across terrain
 * - Grass/vegetation
 * - Clutter on surfaces
 * - Crowd simulation
 */

/**
 * Transform for an instance in 3D space
 */
export interface InstanceTransform {
  /** Position in world space */
  position: { x: number; y: number; z: number };

  /** Rotation in Euler angles (degrees) */
  rotation?: { x: number; y: number; z: number };

  /** Scale (uniform or per-axis) */
  scale?: number | { x: number; y: number; z: number };
}

/**
 * Instance metadata - references a builder with a transform
 */
export interface Instance {
  /** Unique identifier for this instance */
  id: string;

  /** Name of the builder to instantiate */
  builderName: string;

  /** Transform (position, rotation, scale) */
  transform: InstanceTransform;

  /** Decision/measurement overrides for this instance */
  overrides?: Record<string, any>;

  /** Seed for this specific instance (optional, derived from position if not provided) */
  seed?: number;

  /** Optional tags for querying/filtering */
  tags?: string[];

  /** Optional metadata (user-defined) */
  metadata?: Record<string, any>;
}

/**
 * Instance group - multiple instances of the same builder
 * Optimized for GPU instancing
 */
export interface InstanceGroup {
  /** Builder name for all instances in this group */
  builderName: string;

  /** Base seed (individual instances may vary) */
  seed: number;

  /** Shared overrides applied to all instances */
  sharedOverrides?: Record<string, any>;

  /** Array of instances */
  instances: Instance[];

  /** Total count */
  count: number;
}

/**
 * Scene output with instancing support
 *
 * A scene can contain:
 * 1. Merged geometry (traditional approach)
 * 2. Instance groups (for efficient rendering)
 * 3. Both (hybrid approach)
 */
export interface InstancedSceneOutput {
  /** Scene name */
  name: string;

  /** Seed used to generate this scene */
  seed: number;

  /** Merged geometry (if any) */
  mergedMesh?: {
    vertices: Array<{ x: number; y: number; z: number }>;
    faces: Array<{ indices: number[]; color?: { r: number; g: number; b: number } }>;
  };

  /** Instance groups (by builder) */
  instanceGroups: Map<string, InstanceGroup>;

  /** Metadata */
  metadata?: {
    bounds?: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
    builderCount?: number;
    instanceCount?: number;
  };
}

/**
 * Options for instance generation
 */
export interface InstanceOptions {
  /** Whether to merge instances into mesh (default: false) */
  merge?: boolean;

  /** Whether to include instance data in output (default: true) */
  includeInstances?: boolean;

  /** Maximum instances per group before splitting */
  maxInstancesPerGroup?: number;
}

/**
 * Helper: Create instance from scatter point
 */
export function createInstanceFromPoint(
  point: { x: number; z: number },
  builderName: string,
  options: {
    yOffset?: number;
    rotation?: { x: number; y: number; z: number };
    scale?: number;
    seed?: number;
    overrides?: Record<string, any>;
  } = {}
): Instance {
  const id = `${builderName}_${point.x.toFixed(2)}_${point.z.toFixed(2)}`;

  return {
    id,
    builderName,
    transform: {
      position: { x: point.x, y: options.yOffset ?? 0, z: point.z },
      rotation: options.rotation,
      scale: options.scale
    },
    overrides: options.overrides,
    seed: options.seed
  };
}

/**
 * Helper: Create instance group from scatter points
 */
export function createInstanceGroupFromScatter(
  points: Array<{ x: number; z: number }>,
  builderName: string,
  baseSeed: number,
  options: {
    yOffset?: number;
    randomRotation?: boolean;
    scaleVariation?: number;
    sharedOverrides?: Record<string, any>;
  } = {}
): InstanceGroup {
  const instances: Instance[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const instanceSeed = baseSeed + i;

    // Random Y rotation for natural look
    const rotation = options.randomRotation
      ? { x: 0, y: Math.random() * 360, z: 0 }
      : undefined;

    // Scale variation for natural look
    const scale = options.scaleVariation
      ? 1.0 + (Math.random() - 0.5) * options.scaleVariation
      : undefined;

    const instance = createInstanceFromPoint(point, builderName, {
      yOffset: options.yOffset,
      rotation,
      scale,
      seed: instanceSeed,
      overrides: options.sharedOverrides
    });

    instances.push(instance);
  }

  return {
    builderName,
    seed: baseSeed,
    sharedOverrides: options.sharedOverrides,
    instances,
    count: instances.length
  };
}

