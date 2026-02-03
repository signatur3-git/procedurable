/**
 * YamlBuilderTypes - Type definitions for YAML builder format
 *
 * These types define the schema for YAML builder definitions.
 * Separated from execution logic for clarity and reusability.
 */

// ============================================================================
// TOP-LEVEL DEFINITION
// ============================================================================

/**
 * Complete YAML builder definition
 */
export interface YamlBuilderDefinition {
  version: string;
  name: string;
  description?: string;
  author?: string;
  tags?: Record<string, string>;

  // Quality declaration (A1-001) - passthrough metadata for agents/humans
  quality?: YamlQualityDeclaration;

  // Style reference (F2-001) - inherits from parent if not set
  style?: string;

  // LOD budget (G2-001) - scene-level quality tier for LOD-conditional composition
  // Sub-builders with lod_min > lod_budget are replaced with bounding box placeholders
  lod_budget?: number;

  shared_context?: Record<string, any>;  // Scene-level shared state (P2-M2d-003)
  decisions?: Record<string, YamlDecision>;
  measurements?: Record<string, YamlMeasurement>;
  derived?: Record<string, string>;
  materials?: Record<string, YamlMaterial>;  // Named colors/materials
  profiles?: Record<string, YamlProfile>;    // 2D profile definitions for lathe/sweep
  splines?: Record<string, YamlSpline>;      // 3D spline paths for sweep
  shapes?: Record<string, YamlShape>;        // 2D shape definitions for extrusion (P2-M3)
  ports?: Record<string, YamlPort>;          // Attachment points (B5-001)
  requirements?: Record<string, YamlRequirement>;  // Spatial requirements (B5-002)
  offers?: Record<string, YamlOffer>;              // Offers in response to requirements (B5-002)
  skeleton?: YamlSkeleton;                         // Joint hierarchy for rigging (E1-001)
  weights?: YamlWeights;                           // Vertex weight rules for skinning (E2-001)
  morph_targets?: YamlMorphTargets;                // Morph targets / blend shapes (E3-001)
  constraints?: YamlConstraintRef[];               // Constraint schema references (F1-002)
  connections?: YamlConnection[];                  // F4-002: Assembly connections
  // G3-004: UV atlas behavior for composed scenes.
  // 'auto' (default): detect overlapping UVs after composition and repack if needed
  // true: always repack UVs after composition
  // false: never repack (for builders that intentionally share UV space)
  atlas_uvs?: boolean | 'auto';
  geometry?: YamlGeometryCommand[];
  compose?: Record<string, YamlComposition>;
  placement?: YamlPlacement | YamlPlacement[];  // Constraint-based placement (P2-M2), supports array
}

// ============================================================================
// QUALITY DECLARATION (A1-001)
// ============================================================================

export interface YamlQualityDeclaration {
  target_tier?: number;
  current_tier?: number;
  tier_gaps?: string[];
  parts?: Record<string, { tier: number; notes?: string }>;
  decision_coverage?: {
    geometry_affecting?: string[];
    decorative_only?: string[];
    coverage_percentage?: number;
  };
}

// ============================================================================
// DECISIONS
// ============================================================================

/**
 * Decision types
 */
export type YamlDecision =
  | YamlChoiceDecision
  | YamlNumberDecision
  | YamlBooleanDecision
  | YamlCountDecision;

export interface YamlChoiceDecision {
  type: 'choice';
  options: string[];
  weights?: number[];
  default?: string;
}

export interface YamlNumberDecision {
  type: 'number';
  min: number;
  max: number;
  default?: number;
}

export interface YamlBooleanDecision {
  type: 'boolean';
  probability: number;
}

export interface YamlCountDecision {
  type: 'count';
  min: number;
  max: number;
  condition?: string;
}

// ============================================================================
// MEASUREMENTS
// ============================================================================

/**
 * Measurement types
 */
export interface YamlMeasurement {
  value?: number | string;
  base?: number;
  variation?: string;
  source?: string;
  conditional?: Array<{ if: string; value: number | string }>;
}

// ============================================================================
// MATERIALS
// ============================================================================

/**
 * Material definition (Phase 2 foundation)
 * Supports static values, conditional values, and references
 * F2-003: Can use 'role' to reference style palette instead of explicit color
 */
export interface YamlMaterial {
  /** Explicit color (hex, named, or RGB) - used when role is not specified */
  color?: YamlMaterialValue<YamlColorValue>;
  /** F2-003: Role reference to style palette (e.g., 'primary_wood', 'accent_metal') */
  role?: string;
  /** Fallback color when role is not found in style palette */
  fallback_color?: YamlColorValue;
  roughness?: YamlMaterialValue<number>;
  metalness?: YamlMaterialValue<number>;
}

/**
 * Material property value - can be static or conditional
 */
export type YamlMaterialValue<T> =
  | T  // Static value
  | YamlConditionalValue<T>;  // Conditional value

/**
 * Conditional value with default and when clauses
 */
export interface YamlConditionalValue<T> {
  default: T;
  when?: Array<{
    if: string;  // Condition expression (e.g., "wood_type == walnut")
    value: T;
  }>;
}

/**
 * Color value - can be hex string, named color, or RGB object
 */
export type YamlColorValue =
  | string  // "#8b5a2b" or "wood_brown"
  | { r: number; g: number; b: number };

/**
 * RGB color definition (0-1 range or hex string)
 */
export interface YamlColor {
  r: number;
  g: number;
  b: number;
}

// ============================================================================
// PROFILES & SPLINES (P2-M1b)
// ============================================================================

// ============================================================================
// PORTS (B5-001: Attachment Points)
// ============================================================================

/**
 * Port definition - named attachment point for composition
 */
export interface YamlPort {
  /** Position in local space */
  position: YamlPosition;
  /** Normal direction (outward-facing) */
  normal: YamlPosition;
  /** Optional up vector for full orientation */
  up?: YamlPosition;
  /** Optional reference to a named edge loop */
  loop?: string;
  /** Optional metadata */
  metadata?: Record<string, any>;
}

// ============================================================================
// REQUIREMENTS & OFFERS (B5-002: Request/Offer Negotiation)
// ============================================================================

/**
 * Spatial requirement - what this builder needs from the environment
 */
export interface YamlRequirement {
  /** Type of requirement (e.g., 'terrain_clearance', 'flat_pad') */
  type: string;
  /** Shape of the area needed */
  shape: 'rectangle' | 'circle' | 'polygon';
  /** Position in world space (can be expressions) */
  position: { x: string | number; z: string | number };
  /** Width (for rectangle) */
  width?: string | number;
  /** Depth (for rectangle) */
  depth?: string | number;
  /** Radius (for circle) */
  radius?: string | number;
  /** Maximum allowed slope (0-1) */
  max_slope?: string | number;
  /** Priority (higher = more important) */
  priority?: number;
  /** Custom metadata */
  metadata?: Record<string, any>;
}

/**
 * Offer - response to a requirement from another builder
 */
export interface YamlOffer {
  /** The requirement ID this offer responds to (from another builder) */
  for_requirement: string;
  /** Whether the requirement was fulfilled */
  fulfilled: boolean | string;  // Can be expression
  /** Elevation provided */
  elevation?: string | number;
  /** Slope provided (0-1) */
  slope?: string | number;
  /** Slope direction in radians */
  slope_direction?: string | number;
  /** Name of boundary loop created */
  boundary_loop?: string;
  /** Position of the cleared area */
  position?: YamlPosition;
  /** Custom data */
  data?: Record<string, any>;
}

/**
 * 2D Profile definition for lathe/sweep operations
 * Points are in XY plane (X = radius from axis, Y = height)
 */
export interface YamlProfile {
  type: 'circle' | 'ellipse' | 'rect' | 'polygon' | 'spline';
  // For circle
  radius?: string | number;
  segments?: number;
  // For ellipse
  radiusX?: string | number;
  radiusY?: string | number;
  // For rect
  width?: string | number;
  height?: string | number;
  // For polygon/spline - list of 2D points
  points?: Array<{ x: string | number; y: string | number }>;
  // Is the profile closed (default true)
  closed?: boolean;
}

/**
 * 3D Spline path definition for sweep operations
 */
export interface YamlSpline {
  type: 'catmull-rom' | 'linear';
  points: Array<YamlPosition>;
  tension?: number;  // For catmull-rom (default 0.5)
  closed?: boolean;
}

// ============================================================================
// SHAPES (P2-M3)
// ============================================================================

/**
 * 2D Shape definition for extrusion (P2-M3)
 * Points are in XZ plane (Y=0)
 */
export interface YamlShape {
  type: 'rect' | 'circle' | 'ellipse' | 'polygon' | 'text' | 'path' | 'boolean';
  // For rect
  width?: string | number;
  height?: string | number;
  // For circle
  radius?: string | number;
  segments?: number | string | YamlPathSegment[];
  // For ellipse
  radiusX?: string | number;
  radiusZ?: string | number;
  // For polygon - explicit points
  points?: Array<{ x: string | number; z: string | number }>;
  // For text
  content?: string;
  font?: string;
  size?: string | number;
  spacing?: string | number;
  // For path
  curveSegments?: number | string;
  curveTolerance?: number | string;
  curveMaxSegments?: number | string;
  closed?: boolean;
  // Center position (optional, default 0,0)
  center?: { x?: string | number; z?: string | number };
  // For boolean operations (C1-002)
  operation?: 'union' | 'subtract' | 'intersect';
  subject?: string;  // Reference to another shape
  clip?: string;     // Reference to another shape
  clips?: string[];  // Multiple clip shapes (for subtract with multiple holes)
}

export interface YamlPathPoint {
  x: string | number;
  z: string | number;
}

export type YamlPathSegment =
  | { type: 'moveTo'; point: YamlPathPoint }
  | { type: 'lineTo'; point: YamlPathPoint }
  | { type: 'quadraticCurveTo'; control: YamlPathPoint; end: YamlPathPoint }
  | { type: 'cubicCurveTo'; control1: YamlPathPoint; control2: YamlPathPoint; end: YamlPathPoint }
  | { type: 'closePath' };

// ============================================================================
// POSITIONS
// ============================================================================

/**
 * Position expression
 */
export interface YamlPosition {
  x: string | number;
  y: string | number;
  z: string | number;
}

// ============================================================================
// GEOMETRY COMMANDS
// ============================================================================

/**
 * Geometry commands - all possible geometry operations in YAML builders
 */
export type YamlGeometryCommand =
  // Comments
  | { comment: string }
  // Primitive geometry
  | { vertex: string; position: YamlPosition; tags?: string[] }
  | { circle: string; center: YamlPosition; radius: string | number; segments: number | string; purpose: string; normal: number[]; tags?: string[] }
  | { loop: string; type: string; vertices: string[]; purpose: string; tags?: string[] }
  | { face: string; vertices?: string[]; loop?: string; flip?: boolean; color?: YamlColor; tags?: string[] }
  | { loft: string; from: string; to: string; color?: YamlColor; tags?: string[] }
  | { cap: string; loop: string; flip?: boolean; color?: YamlColor; tags?: string[] }
  // Box primitive
  | { box: { name: string; center: YamlPosition; size: YamlPosition; color?: string; uv_mode?: 'normalized' | 'world_scale' } }
  // Control flow
  | { when: string; geometry: YamlGeometryCommand[] }
  | { repeat: number | string; as: string; geometry: YamlGeometryCommand[] }
  | { for: number | string; as: string; geometry: YamlGeometryCommand[] }
  | { if: string; then: YamlGeometryCommand[]; else?: YamlGeometryCommand[] }
  | { grid: { rows: number | string; cols: number | string; row_var?: string; col_var?: string }; geometry: YamlGeometryCommand[] }
  // Advanced geometry (P2-M1b)
  | { lathe: string; profile: string; segments?: number | string; angle?: number | string; axis?: 'y' | 'x' | 'z'; color?: YamlColor | string }
  | { sweep: string; profile: string; path: string; segments?: number | string; twist?: number | string; scaleStart?: number | string; scaleEnd?: number | string; color?: YamlColor | string }
  | { subdivide: string; mesh?: string; iterations?: number }
  // 2D Extrusion (P2-M3)
  | { extrude2d: string; shape: string; depth: number | string; caps?: 'none' | 'front' | 'back' | 'both'; offset?: number | string; bevel?: { size: number | string; segments: number | string }; color?: YamlColor | string }
  // Radial Array (P2M3-004)
  | { radialArray: string; count: number | string; radius?: number | string; center?: YamlPosition; axis?: 'x' | 'y' | 'z'; geometry: YamlGeometryCommand[] }
  // Edge Bevel (C2-003)
  | { bevel: string; mesh: string; width: number | string; segments?: number | string; angle_threshold?: number | string }
  // Deformers (C5)
  | { displace: string; amplitude?: number | string; frequency?: number | string; seed?: number }
  | { bend: string; axis?: 'x' | 'y' | 'z'; angle?: number | string; center?: { x?: number | string; y?: number | string; z?: number | string } }
  | { twist: string; axis?: 'x' | 'y' | 'z'; angle?: number | string; center?: { x?: number | string; y?: number | string; z?: number | string } }
  | { taper: string; axis?: 'x' | 'y' | 'z'; start_scale?: number | string; end_scale?: number | string; center?: { x?: number | string; y?: number | string; z?: number | string } }
  // Symmetry (C7)
  | { mirror: string; plane?: 'x' | 'y' | 'z' | { point?: { x?: number | string; y?: number | string; z?: number | string }; normal?: { x?: number | string; y?: number | string; z?: number | string } }; weld?: boolean }
  | { mesh_radial_array: string; axis?: 'x' | 'y' | 'z' | { point?: { x?: number | string; y?: number | string; z?: number | string }; direction?: { x?: number | string; y?: number | string; z?: number | string } }; count: number | string; angle?: number | string; include_original?: boolean }
  // Terrain (G1-001)
  | { terrain: { name: string; width: number | string; depth: number | string; segments_x?: number | string; segments_z?: number | string; noise_scale?: number | string; noise_amplitude?: number | string; base_height?: number | string; octaves?: number | string; seed?: number | string; center?: { x: number | string; z: number | string }; flatten?: Array<{ center: { x: number | string; z: number | string }; radius: number | string; elevation: number | string; falloff?: number | string }>; color?: string } }
  // Billboard (G7-001) - camera-facing quads for particles, effects, vegetation
  | { billboard: { name: string; center: YamlPosition; width: number | string; height: number | string; facing?: 'camera' | 'axis_x' | 'axis_y' | 'axis_z'; pivot?: 'center' | 'bottom'; color?: string } };

// ============================================================================
// COMPOSITION
// ============================================================================

/**
 * Composition definition - embedding other builders
 */
export interface YamlComposition {
  /** Explicit builder name (mutually exclusive with role) */
  builder?: string;
  /** F3-001: Role-based builder resolution (e.g., "seating", "lighting") */
  role?: string;
  /** Style override for this child (F2-002) - overrides inherited style */
  style?: string;
  offset?: YamlPosition;
  rotation?: YamlPosition;
  scale?: number;
  overrides?: Record<string, any>;
  /** Constraints to pass to child builder (P2-M2d-002) */
  constraints?: Record<string, any>;
  /** Keys to read from shared context (P2-M2d-003) */
  read_context?: string[];
  /** Key-value pairs to write to shared context after build (P2-M2d-003) */
  write_context?: Record<string, string>;  // key -> expression (e.g., "table_width": "$table_width")
  /** Semantic tags for scene graph (P2-M2d-005) */
  tags?: string[];
  /** Condition for including this composition (e.g., "$has_stretchers", "count > 0") */
  if?: string;
  /** Repeat this composition N times with index variable */
  repeat?: {
    count: number | string;
    as: string;  // Index variable name (e.g., "i")
  };
  /** If true, output as instance data instead of merging mesh (P2-M2c-003) */
  asInstance?: boolean;
  /** Blend zone for transition between this builder and parent (B5-003) */
  blend_zone?: YamlBlendZone;
  /**
   * Port-based attachment (B5-001): snap child port to parent/sibling port
   * Format: "parent_port_name" for parent, or "sibling.port_name" for sibling
   */
  attach_to?: string;
  /**
   * Which port on this (child) builder to use for attachment
   * Default: first port defined, or auto-compute from bounds
   */
  my_port?: string;
  /**
   * Skeleton attachment (E1-002): which parent joint the child skeleton's root connects to
   * If specified, child skeleton is merged into parent skeleton at this joint
   */
  skeleton_attach?: string;

  // ==========================================================================
  // LOD-CONDITIONAL COMPOSITION (G2-001)
  // ==========================================================================

  /**
   * Minimum LOD tier required to include this sub-builder (G2-001)
   * If scene LOD budget is below this value, the sub-builder is replaced with a bounding box placeholder
   */
  lod_min?: number;

  /**
   * Force sub-builder to generate at a specific quality tier (G2-001)
   * Overrides the builder's own target_tier setting
   */
  lod_tier?: number;
}

/**
 * Blend zone configuration for transition geometry (B5-003)
 */
export interface YamlBlendZone {
  /** Name of loop in current builder to blend from */
  my_loop: string;
  /** Loop reference from parent or sibling: "builder_name.loop_name" or just "loop_name" for parent */
  their_loop: string;
  /** Blending method */
  method?: 'loft' | 'bridge';
  /** Number of intermediate segments (default 1 = direct connection) */
  segments?: number | string;
  /** Material for the blend mesh */
  material?: string;
  /** Whether to align loops to minimize twist (default true) */
  align?: boolean;
}

// ============================================================================
// PLACEMENT (P2-M2)
// ============================================================================

/**
 * Placement configuration for constraint-based object arrangement (P2-M2)
 */
export interface YamlPlacement {
  mode: 'around_rectangle' | 'around_circle' | 'scatter_poisson';
  center?: YamlPosition;

  // For around_rectangle and scatter_poisson
  width?: string | number;
  depth?: string | number;

  // For around_circle
  radius?: string | number;

  // Object to place
  builder: string;
  count: string | number;

  // Constraints
  minDistance?: string | number;

  // Allow fewer objects if space runs out
  allowReducedCount?: boolean;

  // Overrides to pass to each placed object
  overrides?: Record<string, any>;

  // Instance name prefix (default: "placed")
  instancePrefix?: string;

  // If true, output as instance data instead of merging mesh (P2-M2c-003)
  asInstance?: boolean;
}

// ============================================================================
// SKELETON (E1-001: Skeleton Declaration)
// ============================================================================

/**
 * Joint constraint types for skeleton rigging
 */
export type YamlJointConstraintType = 'hinge' | 'ball_and_socket' | 'fixed';

/**
 * Joint constraint definition
 */
export interface YamlJointConstraint {
  /** Constraint type */
  type: YamlJointConstraintType;
  /** For hinge constraints: which axis the joint rotates around */
  axis?: 'x' | 'y' | 'z';
  /** Rotation limits in degrees */
  limits?: {
    /** Min/max for single-axis hinge: [min, max] in degrees */
    min?: number;
    max?: number;
    /** For ball_and_socket: per-axis limits in degrees as [min, max] */
    pitch?: [number, number];  // X-axis rotation
    yaw?: [number, number];    // Y-axis rotation
    roll?: [number, number];   // Z-axis rotation
  };
}

/**
 * Joint definition in a skeleton
 */
export interface YamlJoint {
  /** Joint name (unique within skeleton) */
  name: string;
  /** Parent joint name (null or omitted for root joints) */
  parent?: string | null;
  /** Position relative to parent (or world if root) - supports expressions */
  position: YamlPosition;
  /** Orientation as euler angles in degrees (default 0,0,0) - supports expressions */
  orientation?: {
    x?: string | number;
    y?: string | number;
    z?: string | number;
  };
  /** Optional joint constraints for animation */
  constraints?: YamlJointConstraint;
}

/**
 * Skeleton definition for a builder
 */
export type YamlSkeleton = YamlJoint[];

// ============================================================================
// VERTEX WEIGHTS (E2-001: Weight Rules and Assignment)
// ============================================================================

/**
 * Falloff function types for weight calculation
 */
export type YamlWeightFalloff = 'linear' | 'smooth' | 'sharp';

/**
 * Proximity-based weight rule: vertices near a joint get weighted to it
 */
export interface YamlProximityWeightRule {
  type: 'proximity';
  /** Joint name to weight vertices to */
  joint: string;
  /** Maximum distance from joint - vertices beyond this get 0 weight */
  radius: string | number;
  /** Falloff function for weight based on distance */
  falloff?: YamlWeightFalloff;
}

/**
 * Region-based weight rule: vertices in a bounding box get weighted
 */
export interface YamlRegionWeightRule {
  type: 'region';
  /** Joint name to weight vertices to */
  joint: string;
  /** Minimum corner of bounding box */
  min: YamlPosition;
  /** Maximum corner of bounding box */
  max: YamlPosition;
  /** Fixed weight for vertices in region (default 1.0) */
  weight?: string | number;
}

/**
 * Gradient weight rule: linear blend between two joints along an axis
 */
export interface YamlGradientWeightRule {
  type: 'gradient';
  /** First joint (weight 1 at joint_a position along axis) */
  joint_a: string;
  /** Second joint (weight 1 at joint_b position along axis) */
  joint_b: string;
  /** Axis along which to compute gradient */
  axis: 'x' | 'y' | 'z';
}

/**
 * Union of all weight rule types
 */
export type YamlWeightRule = YamlProximityWeightRule | YamlRegionWeightRule | YamlGradientWeightRule;

/**
 * Weight rules array for a builder
 */
export type YamlWeights = YamlWeightRule[];

// ============================================================================
// MORPH TARGETS (E3-001: Morph Target System)
// ============================================================================

/**
 * A single vertex offset in a morph target definition
 */
export interface YamlMorphOffset {
  /** Index of the vertex to offset */
  vertex: number;
  /** Position offset to apply */
  offset: { x: string | number; y: string | number; z: string | number };
}

/**
 * Morph target definition
 */
export interface YamlMorphTarget {
  /** Unique name for this target (e.g., "smile", "stocky", "LOD1") */
  name: string;

  /**
   * Inline offsets: explicit per-vertex position deltas
   * This is the simple approach for small adjustments
   */
  offsets?: YamlMorphOffset[];

  /**
   * Reference-based target: compute delta from another builder's output
   * More powerful but requires topology to match exactly
   */
  from_builder?: {
    /** Name of the builder to use as variant */
    builder: string;
    /** Decision overrides for the variant builder */
    decisions?: Record<string, any>;
  };

  /** Default weight when first applied (0-1, default 0) */
  default_weight?: number;

  /** Description of what this target does */
  description?: string;
}

/**
 * Morph targets section for a builder
 */
export type YamlMorphTargets = YamlMorphTarget[];

// ============================================================================
// CONSTRAINT REFERENCES (F1-002: Constraint Integration with Builders)
// ============================================================================

/**
 * Reference to a constraint schema that should be evaluated during build.
 *
 * The constraint schema is evaluated after decisions and measurements are resolved.
 * Variable bindings are mapped from builder context (measurements, decisions).
 */
export interface YamlConstraintRef {
  /** Key of the constraint schema to reference */
  schema: string;

  /**
   * Mapping from constraint variables to builder values.
   * Keys are constraint variable names, values are expressions or measurement names.
   * Example: { "x": "seat_width", "y": "seat_depth" }
   */
  bindings: Record<string, string>;

  /** Optional description of why this constraint is applied */
  description?: string;

  /**
   * Severity of constraint failure: 'error' (default) or 'warning'
   * Errors fail the build, warnings are recorded but don't fail
   */
  severity?: 'error' | 'warning';
}

// ============================================================================
// CONNECTIONS (F4-002: Assembly Metadata)
// ============================================================================

/**
 * Connection - Non-spatial relationship between parts
 *
 * Used for mechanical assemblies: gear meshing, joints, welds.
 * Connections are serialized to PSD for downstream consumers.
 */
export interface YamlConnection {
  /** Connection type (e.g., "gear_mesh", "axle_joint", "weld") */
  type: string;

  /** Source: prim path or composed instance name */
  from: string;

  /** Target: prim path or composed instance name */
  to: string;

  /** Connection-specific data (e.g., { ratio: 3.5 } for gears) */
  data?: Record<string, any>;

  /** Optional description */
  description?: string;
}
