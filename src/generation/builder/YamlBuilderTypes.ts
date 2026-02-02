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
  tags?: string[];

  // Quality declaration (A1-001) - passthrough metadata for agents/humans
  quality?: YamlQualityDeclaration;

  shared_context?: Record<string, any>;  // Scene-level shared state (P2-M2d-003)
  decisions?: Record<string, YamlDecision>;
  measurements?: Record<string, YamlMeasurement>;
  derived?: Record<string, string>;
  materials?: Record<string, YamlMaterial>;  // Named colors/materials
  profiles?: Record<string, YamlProfile>;    // 2D profile definitions for lathe/sweep
  splines?: Record<string, YamlSpline>;      // 3D spline paths for sweep
  shapes?: Record<string, YamlShape>;        // 2D shape definitions for extrusion (P2-M3)
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
 */
export interface YamlMaterial {
  color: YamlMaterialValue<YamlColorValue>;
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
  | { box: { name: string; center: YamlPosition; size: YamlPosition; color?: string } }
  // Control flow
  | { when: string; geometry: YamlGeometryCommand[] }
  | { repeat: number | string; as: string; geometry: YamlGeometryCommand[] }
  | { if: string; then: YamlGeometryCommand[]; else?: YamlGeometryCommand[] }
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
  | { displace: string; amplitude?: number | string; frequency?: number | string; seed?: number };

// ============================================================================
// COMPOSITION
// ============================================================================

/**
 * Composition definition - embedding other builders
 */
export interface YamlComposition {
  builder: string;
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
