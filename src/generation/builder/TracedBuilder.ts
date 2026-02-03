/**
 * TracedBuilder - Core infrastructure for measurement-based modeling with full tracing
 *
 * This is the API that both:
 * - Hardcoded builders call directly (prototype phase)
 * - DSL parser generates calls to (production phase)
 *
 * Every operation is traced so we can link output geometry to source definitions.
 *
 * SEEDED RANDOMNESS:
 * All "virtual artist" decisions use deterministic pseudo-random numbers.
 * Same seed → identical output. Decisions can be overridden explicitly.
 */

import { Mesh } from '../../platform/geometry/Mesh';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { Vec3 } from '../../platform/math/Vec3';
import { evaluate as mathEvaluate } from '../../platform/math/MathService';

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR (Mulberry32)
// ============================================================================

/**
 * Mulberry32 - Fast, high-quality 32-bit PRNG
 * Deterministic: same seed always produces same sequence
 */
export class SeededRandom {
  private state: number;
  private callCount: number = 0;

  constructor(seed: number) {
    this.state = seed >>> 0; // Ensure unsigned 32-bit
    if (this.state === 0) this.state = 1; // Avoid zero state
  }

  /**
   * Get next random number in [0, 1)
   */
  next(): number {
    this.callCount++;
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Get random number in range [min, max]
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Get random integer in range [min, max] inclusive
   */
  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Pick random element from array
   */
  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }

  /**
   * Pick random element with weights
   */
  pickWeighted<T>(choices: Array<{ value: T; weight: number }>): T {
    const totalWeight = choices.reduce((sum, c) => sum + c.weight, 0);
    let r = this.next() * totalWeight;
    for (const choice of choices) {
      r -= choice.weight;
      if (r <= 0) return choice.value;
    }
    return choices[choices.length - 1].value;
  }

  /**
   * Boolean with probability
   */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /**
   * Get current call count (for debugging/tracing)
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Fork a new RNG from current state (for sub-builders)
   */
  fork(): SeededRandom {
    return new SeededRandom(Math.floor(this.next() * 0xffffffff));
  }
}

// ============================================================================
// DECISION TRACKING
// ============================================================================

/**
 * A traced decision - records what choice was made and why
 */
export interface TracedDecision {
  name: string;
  value: any;
  source: 'random' | 'override' | 'default' | 'style';  // F2-001: Added 'style' source
  options?: any[];        // Available choices
  weights?: number[];     // Weights if applicable
  randomCall?: number;    // Which RNG call produced this
  expression?: string;    // For numeric ranges
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * A traced value - knows the expression that produced it
 */
export interface TracedValue {
  expression: string;
  value: number;
  dependencies: string[];  // Which measurements were used
}

/**
 * A traced position - each component is traced
 */
export interface TracedPosition {
  x: TracedValue | number;
  y: TracedValue | number;
  z: TracedValue | number;
}

/**
 * Source location for tracing
 */
export interface SourceLocation {
  line?: number;
  column?: number;
  expression?: string;
  builderName?: string;
}

/**
 * Trace entry - links output to source
 */
export interface TraceEntry {
  type: 'measurement' | 'vertex' | 'loop' | 'face' | 'loft' | 'modifier' | 'port' | 'weights' | 'morph_targets' | 'joint' | 'skeleton';
  name: string;
  source: SourceLocation;
  details: Record<string, any>;
}

/**
 * Validation issue
 */
export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  source?: TraceEntry;
  suggestion?: string;
}

/**
 * Loop purpose - semantic meaning for animation/rigging
 */
export type LoopPurpose = 'structural' | 'animation_joint' | 'seam' | 'detail';

/**
 * Loop parameters
 */
export interface LoopParams {
  type: 'circle' | 'rect' | 'custom';
  center?: TracedPosition;
  radius?: TracedValue | number;
  width?: TracedValue | number;
  height?: TracedValue | number;
  segments?: number;
  vertices?: string[];  // For custom loops
  purpose: LoopPurpose;
  normal?: Vec3;
}

/**
 * Traced port - Named attachment point for composition (B5-001)
 */
export interface TracedPort {
  name: string;
  position: Vec3;
  normal: Vec3;
  up?: Vec3;
  loop?: string;  // Reference to a named loop
  metadata?: Record<string, any>;
}

// ============================================================================
// SKELETON (E1-001: Skeleton Declaration)
// ============================================================================

/**
 * Joint constraint types
 */
export type JointConstraintType = 'hinge' | 'ball_and_socket' | 'fixed';

/**
 * Joint constraint definition
 */
export interface JointConstraint {
  type: JointConstraintType;
  axis?: 'x' | 'y' | 'z';
  limits?: {
    min?: number;
    max?: number;
    pitch?: [number, number];
    yaw?: [number, number];
    roll?: [number, number];
  };
}

/**
 * Traced joint - a joint in a skeleton hierarchy
 */
export interface TracedJoint {
  /** Joint name (unique within skeleton) */
  name: string;
  /** Parent joint name (null for root joints) */
  parent: string | null;
  /** Position in local space (relative to parent) */
  position: Vec3;
  /** Orientation as euler angles in radians */
  orientation: Vec3;
  /** Rest-pose world transform (computed from hierarchy) */
  worldPosition: Vec3;
  /** Rest-pose world orientation (computed from hierarchy) */
  worldOrientation: Vec3;
  /** Optional constraints for animation */
  constraints?: JointConstraint;
}

/**
 * Traced skeleton - complete joint hierarchy for a builder
 */
export interface TracedSkeleton {
  /** All joints in the skeleton */
  joints: TracedJoint[];
  /** Quick lookup by joint name */
  jointMap: Map<string, TracedJoint>;
  /** Root joint names (joints with no parent) */
  roots: string[];
}

// ============================================================================
// VERTEX WEIGHTS (E2-001: Weight Rules and Assignment)
// ============================================================================

/**
 * Single joint influence on a vertex
 */
export interface VertexWeight {
  /** Index of joint in skeleton.joints array */
  jointIndex: number;
  /** Weight value (0-1) */
  weight: number;
}

/**
 * Vertex weights for an entire mesh
 * Sparse representation: only stores vertices with weights
 * Each vertex can have up to MAX_INFLUENCES joints (typically 4)
 */
export interface VertexWeights {
  /** Weights per vertex index (sparse - missing indices have no weights) */
  weights: Map<number, VertexWeight[]>;
  /** Maximum number of influences per vertex (standard: 4) */
  maxInfluences: number;
  /** Statistics */
  stats: {
    totalVertices: number;
    weightedVertices: number;
    unweightedVertices: number;
    maxInfluencesUsed: number;
  };
}

// ============================================================================
// MORPH TARGETS (E3-001: Morph Target System)
// ============================================================================

/**
 * Traced morph target - named vertex offset set
 */
export interface TracedMorphTarget {
  /** Unique name for this target */
  name: string;
  /** Sparse array of vertex offsets */
  offsets: Array<{ vertexIndex: number; offset: Vec3 }>;
  /** Default weight (0-1, default 0) */
  defaultWeight: number;
  /** Optional description */
  description?: string;
}

/**
 * Complete morph target set for a builder
 */
export interface TracedMorphTargetSet {
  /** Base vertex count (for validation) */
  baseVertexCount: number;
  /** Named morph targets */
  targets: TracedMorphTarget[];
}

/**
 * Complete traced output
 */
export interface TracedOutput {
  builderName: string;
  seed: number;
  mesh: Mesh;
  traces: Map<string, TraceEntry>;
  measurements: Map<string, { value: number; source?: string }>;
  decisions: Map<string, TracedDecision>;  // All "virtual artist" choices
  loops: Map<string, { indices: number[]; purpose: LoopPurpose }>;
  ports: Map<string, TracedPort>;  // Named attachment points (B5-001)
  skeleton?: TracedSkeleton;        // Joint hierarchy for rigging (E1-001)
  vertexWeights?: VertexWeights;    // Vertex weights for skinning (E2-001)
  morphTargets?: TracedMorphTargetSet;  // Morph targets / blend shapes (E3-001)
  constraintResults?: Array<{       // Constraint evaluation results (F1-002)
    schema: string;
    passed: boolean;
    severity: 'error' | 'warning';
    results: Array<{ type: string; passed: boolean; message: string }>;
  }>;
  connections?: Array<{             // F4-002: Assembly connections
    type: string;
    from: string;
    to: string;
    data?: Record<string, any>;
    description?: string;
  }>;
  tags?: Record<string, string>;            // Evaluated semantic tags (from YAML tags: section)
  subBuilders: Map<string, TracedOutput>;  // Composed sub-builders
  instances?: Array<{  // NEW: Instance data for efficient rendering
    id: string;
    builderName: string;
    transform: {
      position: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number };
      scale?: number | { x: number; y: number; z: number };
    };
    overrides?: Record<string, any>;
    seed?: number;
  }>;
  sceneGraph?: any;  // SceneGraph - Semantic scene representation (P2-M2d-005)
  qualityGateResult?: any;  // QualityGateResult from evaluateQualityTier (A2-001)
  validation: {
    issues: ValidationIssue[];
    bounds: { min: Vec3; max: Vec3; center: Vec3; size: Vec3 };
    vertexCount: number;
    faceCount: number;
  };
  buildTime: number;
}

// ============================================================================
// EXPRESSION CONTEXT
// ============================================================================

/**
 * Context for evaluating expressions
 */
export class ExpressionContext {
  private measurements: Map<string, number> = new Map();
  private derived: Map<string, number> = new Map();

  setMeasurement(name: string, value: number): void {
    this.measurements.set(name, value);
  }

  setDerived(name: string, value: number): void {
    this.derived.set(name, value);
  }

  get(name: string): number | undefined {
    return this.measurements.get(name) ?? this.derived.get(name);
  }

  has(name: string): boolean {
    return this.measurements.has(name) || this.derived.has(name);
  }

  /**
   * Get all variables as a plain object (for MathService integration)
   */
  toObject(): Record<string, number> {
    const obj: Record<string, number> = {};
    for (const [k, v] of this.measurements) {
      obj[k] = v;
    }
    for (const [k, v] of this.derived) {
      obj[k] = v;
    }
    return obj;
  }

  /**
   * Evaluate an expression using MathService
   * Supports: +, -, *, /, parentheses, variable names, numbers, trig functions, pi, etc.
   */
  evaluate(expression: string): TracedValue {
    // Get all variables for evaluation
    const variables = this.toObject();

    // Find dependencies (variables used in expression)
    const dependencies: string[] = [];
    const varPattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
    let match;
    while ((match = varPattern.exec(expression)) !== null) {
      const varName = match[0];
      // Skip known function names and constants
      const reserved = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
                        'abs', 'sqrt', 'pow', 'exp', 'log', 'floor', 'ceil', 'round', 'min', 'max',
                        'pi', 'PI', 'e', 'E', 'tau', 'TAU'];
      if (this.has(varName) && !dependencies.includes(varName) && !reserved.includes(varName)) {
        dependencies.push(varName);
      }
    }

    try {
      const result = mathEvaluate(expression, variables);
      return { expression, value: result.value, dependencies };
    } catch (e: any) {
      throw new Error(`Failed to evaluate expression '${expression}': ${e.message}`);
    }
  }
}

// ============================================================================
// TRACED BUILDER
// ============================================================================

/**
 * TracedBuilder - Build meshes with full tracing and seeded randomness
 *
 * "Virtual Artist" decisions use deterministic PRNG.
 * Same seed → identical output. All decisions can be overridden.
 */
export class TracedBuilder {
  private name: string;
  private seed: number;
  private rng: SeededRandom;
  public context: ExpressionContext;  // Public for YAML parser access
  public mesh: Mesh;  // Public for material slot access from commands
  public traces: Map<string, TraceEntry>;  // Public for YAML parser access
  public measurements: Map<string, { value: number; source?: string }>;  // Public for YAML parser access
  public decisions: Map<string, TracedDecision>;  // Public for YAML parser access
  private decisionOverrides: Map<string, any>;
  private constraints: Map<string, any>;  // Constraints from parent builder (P2-M2d-002)
  private styleDefaults: Map<string, any>;  // Style decision defaults (F2-001)
  private vertices: Map<string, number>;  // name → index
  public loops: Map<string, { indices: number[]; purpose: LoopPurpose }>;  // Public for B5-003
  private ports: Map<string, TracedPort>;  // Named attachment points (B5-001)
  private skeleton: TracedSkeleton | null;  // Joint hierarchy (E1-001)
  private vertexWeights: VertexWeights | null;  // Vertex weights for skinning (E2-001)
  private morphTargets: TracedMorphTargetSet | null;  // Morph targets (E3-001)
  private connections: Array<{  // F4-002: Assembly connections
    type: string;
    from: string;
    to: string;
    data?: Record<string, any>;
    description?: string;
  }>;
  public subBuilders: Map<string, TracedOutput>;  // Composed sub-builders (public for B5-003 blend zones)
  private instances: Array<{  // Instance data for non-merged compositions (P2-M2c-003)
    id: string;
    builderName: string;
    transform: {
      position: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number };
      scale?: number | { x: number; y: number; z: number };
    };
    overrides?: Record<string, any>;
    seed?: number;
  }>;
  private startTime: number;
  private externalIssues: ValidationIssue[] = [];  // F1-002: Issues added during build

  constructor(name: string, seed?: number, overrides?: Record<string, any>) {
    this.name = name;
    this.seed = seed ?? Math.floor(Math.random() * 0xffffffff);
    this.rng = new SeededRandom(this.seed);
    this.context = new ExpressionContext();
    this.mesh = new Mesh();
    this.traces = new Map();
    this.measurements = new Map();
    this.decisions = new Map();
    this.decisionOverrides = new Map(Object.entries(overrides ?? {}));
    this.constraints = new Map();
    this.styleDefaults = new Map();  // F2-001: Style defaults
    this.vertices = new Map();
    this.loops = new Map();
    this.ports = new Map();  // B5-001: Attachment points
    this.skeleton = null;    // E1-001: Skeleton (null until populated)
    this.vertexWeights = null;  // E2-001: Vertex weights (null until computed)
    this.morphTargets = null;   // E3-001: Morph targets (null until registered)
    this.connections = [];      // F4-002: Assembly connections
    this.subBuilders = new Map();
    this.instances = [];
    this.startTime = Date.now();
    this.externalIssues = [];  // F1-002

    // Extract constraints from overrides (P2-M2d-002)
    if (overrides && overrides.__constraints__) {
      this.constraints = new Map(Object.entries(overrides.__constraints__));
      // Remove __constraints__ from decision overrides
      delete overrides.__constraints__;
      this.decisionOverrides = new Map(Object.entries(overrides));
    }
  }

  /**
   * Set style decision defaults (F2-001)
   * These are used when a decision is not explicitly overridden
   */
  setStyleDefaults(defaults: Record<string, any>): void {
    this.styleDefaults = new Map(Object.entries(defaults));
  }

  /**
   * Get style defaults (F2-001)
   */
  getStyleDefaults(): Map<string, any> {
    return this.styleDefaults;
  }

  /**
   * Add a validation issue during build (F1-002)
   */
  addValidationIssue(issue: ValidationIssue): void {
    this.externalIssues.push(issue);
  }

  /**
   * Add an assembly connection (F4-002)
   * Connections define non-spatial relationships between parts.
   */
  addConnection(connection: {
    type: string;
    from: string;
    to: string;
    data?: Record<string, any>;
    description?: string;
  }): void {
    this.connections.push(connection);
  }

  /**
   * Get all connections (F4-002)
   */
  getConnections(): Array<{
    type: string;
    from: string;
    to: string;
    data?: Record<string, any>;
    description?: string;
  }> {
    return [...this.connections];
  }

  // ==========================================================================
  // DECISION MAKING (Virtual Artist Choices)
  // ==========================================================================

  /**
   * Make a decision by choosing from options (traced)
   * Resolution order: override > style default > random
   */
  decide<T>(name: string, options: T[], weights?: number[]): T {
    // Check for explicit override
    if (this.decisionOverrides.has(name)) {
      const override = this.decisionOverrides.get(name);
      const decision: TracedDecision = {
        name,
        value: override,
        source: 'override',
        options: options as any[],
        weights
      };
      this.decisions.set(name, decision);
      this.traces.set(`decision:${name}`, {
        type: 'modifier',
        name,
        source: { builderName: this.name },
        details: decision
      });
      return override;
    }

    // F2-001: Check for style default
    if (this.styleDefaults.has(name)) {
      const styleDefault = this.styleDefaults.get(name);
      // Verify the style default is a valid option
      if (options.includes(styleDefault)) {
        const decision: TracedDecision = {
          name,
          value: styleDefault,
          source: 'style',
          options: options as any[],
          weights
        };
        this.decisions.set(name, decision);
        this.traces.set(`decision:${name}`, {
          type: 'modifier',
          name,
          source: { builderName: this.name },
          details: decision
        });
        return styleDefault;
      }
      // Style default not in options, fall through to random
    }

    // Make random choice
    const callNumber = this.rng.getCallCount() + 1;
    let value: T;

    if (weights && weights.length === options.length) {
      const weighted = options.map((v, i) => ({ value: v, weight: weights[i] }));
      value = this.rng.pickWeighted(weighted);
    } else {
      value = this.rng.pick(options);
    }

    const decision: TracedDecision = {
      name,
      value,
      source: 'random',
      options: options as any[],
      weights,
      randomCall: callNumber
    };
    this.decisions.set(name, decision);
    this.traces.set(`decision:${name}`, {
      type: 'modifier',
      name,
      source: { builderName: this.name },
      details: decision
    });

    return value;
  }

  /**
   * Make a numeric decision within a range (traced)
   * Resolution order: override > style default > builder default > random
   */
  decideNumber(name: string, min: number, max: number, defaultValue?: number): number {
    // Check for explicit override
    if (this.decisionOverrides.has(name)) {
      const override = this.decisionOverrides.get(name);
      const decision: TracedDecision = {
        name,
        value: override,
        source: 'override',
        expression: `[${min}, ${max}]`
      };
      this.decisions.set(name, decision);
      this.traces.set(`decision:${name}`, {
        type: 'modifier',
        name,
        source: { builderName: this.name },
        details: decision
      });
      return override;
    }

    // F2-001: Check for style default
    if (this.styleDefaults.has(name)) {
      const styleDefault = this.styleDefaults.get(name);
      if (typeof styleDefault === 'number' && styleDefault >= min && styleDefault <= max) {
        const decision: TracedDecision = {
          name,
          value: styleDefault,
          source: 'style',
          expression: `[${min}, ${max}]`
        };
        this.decisions.set(name, decision);
        this.traces.set(`decision:${name}`, {
          type: 'modifier',
          name,
          source: { builderName: this.name },
          details: decision
        });
        return styleDefault;
      }
    }

    // If builder default provided and no override/style, use default
    if (defaultValue !== undefined) {
      const decision: TracedDecision = {
        name,
        value: defaultValue,
        source: 'default',
        expression: `[${min}, ${max}], default=${defaultValue}`
      };
      this.decisions.set(name, decision);
      this.traces.set(`decision:${name}`, {
        type: 'modifier',
        name,
        source: { builderName: this.name },
        details: decision
      });
      return defaultValue;
    }

    // Make random choice
    const callNumber = this.rng.getCallCount() + 1;
    const value = this.rng.range(min, max);

    const decision: TracedDecision = {
      name,
      value,
      source: 'random',
      expression: `[${min}, ${max}]`,
      randomCall: callNumber
    };
    this.decisions.set(name, decision);
    this.traces.set(`decision:${name}`, {
      type: 'modifier',
      name,
      source: { builderName: this.name },
      details: decision
    });

    return value;
  }

  /**
   * Make a boolean decision (traced)
   */
  decideBoolean(name: string, probability: number = 0.5): boolean {
    // Check for override
    if (this.decisionOverrides.has(name)) {
      const override = this.decisionOverrides.get(name);
      const decision: TracedDecision = {
        name,
        value: override,
        source: 'override',
        expression: `chance(${probability})`
      };
      this.decisions.set(name, decision);
      this.traces.set(`decision:${name}`, {
        type: 'modifier',
        name,
        source: { builderName: this.name },
        details: decision
      });
      return override;
    }

    // F2-001: Check for style default
    if (this.styleDefaults.has(name)) {
      const styleDefault = this.styleDefaults.get(name);
      if (typeof styleDefault === 'boolean') {
        const decision: TracedDecision = {
          name,
          value: styleDefault,
          source: 'style',
          expression: `chance(${probability})`
        };
        this.decisions.set(name, decision);
        this.traces.set(`decision:${name}`, {
          type: 'modifier',
          name,
          source: { builderName: this.name },
          details: decision
        });
        return styleDefault;
      }
    }

    const callNumber = this.rng.getCallCount() + 1;
    const value = this.rng.chance(probability);

    const decision: TracedDecision = {
      name,
      value,
      source: 'random',
      expression: `chance(${probability})`,
      randomCall: callNumber
    };
    this.decisions.set(name, decision);
    this.traces.set(`decision:${name}`, {
      type: 'modifier',
      name,
      source: { builderName: this.name },
      details: decision
    });

    return value;
  }

  /**
   * Make a count decision (integer in range)
   * Resolution order: override > style default > random
   */
  decideCount(name: string, min: number, max: number): number {
    // Check for explicit override
    if (this.decisionOverrides.has(name)) {
      const override = this.decisionOverrides.get(name);
      const decision: TracedDecision = {
        name,
        value: override,
        source: 'override',
        expression: `int[${min}, ${max}]`
      };
      this.decisions.set(name, decision);
      this.traces.set(`decision:${name}`, {
        type: 'modifier',
        name,
        source: { builderName: this.name },
        details: decision
      });
      return override;
    }

    // F2-001: Check for style default
    if (this.styleDefaults.has(name)) {
      const styleDefault = this.styleDefaults.get(name);
      if (typeof styleDefault === 'number' &&
          Number.isInteger(styleDefault) &&
          styleDefault >= min &&
          styleDefault <= max) {
        const decision: TracedDecision = {
          name,
          value: styleDefault,
          source: 'style',
          expression: `int[${min}, ${max}]`
        };
        this.decisions.set(name, decision);
        this.traces.set(`decision:${name}`, {
          type: 'modifier',
          name,
          source: { builderName: this.name },
          details: decision
        });
        return styleDefault;
      }
    }

    const callNumber = this.rng.getCallCount() + 1;
    const value = this.rng.rangeInt(min, max);

    const decision: TracedDecision = {
      name,
      value,
      source: 'random',
      expression: `int[${min}, ${max}]`,
      randomCall: callNumber
    };
    this.decisions.set(name, decision);
    this.traces.set(`decision:${name}`, {
      type: 'modifier',
      name,
      source: { builderName: this.name },
      details: decision
    });

    return value;
  }

  /**
   * Fork the RNG for a sub-builder (maintains determinism)
   */
  forkRng(): SeededRandom {
    return this.rng.fork();
  }

  /**
   * Get current seed (for reproducibility)
   */
  getSeed(): number {
    return this.seed;
  }

  // ==========================================================================
  // CONSTRAINTS (P2-M2d-002)
  // ==========================================================================

  /**
   * Query constraint passed from parent builder
   * Returns undefined if constraint doesn't exist
   *
   * Example: builder.getConstraint('max_height') → 0.9
   */
  getConstraint<T = any>(key: string): T | undefined {
    return this.constraints.get(key);
  }

  /**
   * Check if a constraint exists
   */
  hasConstraint(key: string): boolean {
    return this.constraints.has(key);
  }

  /**
   * Get all constraints
   */
  getConstraints(): Record<string, any> {
    return Object.fromEntries(this.constraints);
  }

  // ==========================================================================
  // MEASUREMENTS
  // ==========================================================================

  /**
   * Define a measurement (traced)
   */
  defineMeasurement(name: string, value: number, options?: { source?: string }): this {
    this.context.setMeasurement(name, value);
    this.measurements.set(name, { value, source: options?.source });

    this.traces.set(`measurement:${name}`, {
      type: 'measurement',
      name,
      source: { expression: `${name} = ${value}`, builderName: this.name },
      details: { value, source: options?.source }
    });

    return this;
  }

  /**
   * Define a derived value (calculated from measurements)
   */
  defineDerived(name: string, expression: string): this {
    const traced = this.context.evaluate(expression);
    this.context.setDerived(name, traced.value);

    this.traces.set(`derived:${name}`, {
      type: 'measurement',
      name,
      source: { expression: `${name} = ${expression}`, builderName: this.name },
      details: {
        expression,
        value: traced.value,
        dependencies: traced.dependencies
      }
    });

    return this;
  }

  // ==========================================================================
  // VERTICES
  // ==========================================================================

  /**
   * Place a vertex at a calculated position (traced)
   */
  placeVertex(name: string, position: { x: string; y: string; z: string }): this {
    const xTraced = this.context.evaluate(position.x);
    const yTraced = this.context.evaluate(position.y);
    const zTraced = this.context.evaluate(position.z);

    const pos = new Vec3(xTraced.value, yTraced.value, zTraced.value);
    const index = this.mesh.addVertex(new Vertex(pos));
    this.vertices.set(name, index);

    this.traces.set(`vertex:${name}`, {
      type: 'vertex',
      name,
      source: {
        expression: `(${position.x}, ${position.y}, ${position.z})`,
        builderName: this.name
      },
      details: {
        position: { x: xTraced.value, y: yTraced.value, z: zTraced.value },
        expressions: { x: position.x, y: position.y, z: position.z },
        dependencies: [...new Set([
          ...xTraced.dependencies,
          ...yTraced.dependencies,
          ...zTraced.dependencies
        ])]
      }
    });

    return this;
  }

  /**
   * Place multiple vertices in a pattern
   */
  placeVertices(baseName: string, positions: Array<{ suffix: string; x: string; y: string; z: string }>): this {
    for (const pos of positions) {
      this.placeVertex(`${baseName}_${pos.suffix}`, { x: pos.x, y: pos.y, z: pos.z });
    }
    return this;
  }

  // ==========================================================================
  // LOOPS
  // ==========================================================================

  /**
   * Create a circular edge loop (traced)
   * Note: Winding order is always counter-clockwise when viewed from +Y,
   * regardless of normal direction. This ensures consistent lofting.
   */
  createCircleLoop(
    name: string,
    center: { x: string; y: string; z: string },
    radiusExpr: string,
    segments: number,
    purpose: LoopPurpose,
    normal: Vec3 | { x: number; y: number; z: number } = new Vec3(0, 1, 0)
  ): this {
    const cx = this.context.evaluate(center.x);
    const cy = this.context.evaluate(center.y);
    const cz = this.context.evaluate(center.z);
    const radius = this.context.evaluate(radiusExpr);

    const centerVec = new Vec3(cx.value, cy.value, cz.value);
    const indices: number[] = [];

    // Ensure normal is a Vec3
    const normalVec = normal instanceof Vec3 ? normal : new Vec3(normal.x, normal.y, normal.z);

    // Calculate tangent vectors - always use consistent orientation for horizontal circles
    // This ensures loops can be lofted without twisting
    let tangent1: Vec3;
    let tangent2: Vec3;

    if (Math.abs(normalVec.y) > 0.999) {
      // Vertical normal (pointing up or down) - circle in XZ plane
      // Always wind counter-clockwise when viewed from +Y
      tangent1 = new Vec3(1, 0, 0);  // X axis
      tangent2 = new Vec3(0, 0, 1);  // Z axis
    } else {
      // Non-vertical normal - compute tangents from normal
      const up = new Vec3(0, 1, 0);
      tangent1 = normalVec.cross(up).normalize();
      tangent2 = normalVec.cross(tangent1).normalize();
    }

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius.value;
      const z = Math.sin(angle) * radius.value;
      const pos = centerVec.add(tangent1.mul(x)).add(tangent2.mul(z));

      const vertexName = `${name}_v${i}`;
      // Assign UV: u = circumferential position [0,1], v = 0 (placeholder, updated by loftLoops)
      const u = i / segments;
      const index = this.mesh.addVertex(new Vertex(pos, { uv: [u, 0], smoothGroup: 1 }));
      this.vertices.set(vertexName, index);
      indices.push(index);
    }

    this.loops.set(name, { indices, purpose });

    this.traces.set(`loop:${name}`, {
      type: 'loop',
      name,
      source: {
        expression: `circle(center: (${center.x}, ${center.y}, ${center.z}), radius: ${radiusExpr})`,
        builderName: this.name
      },
      details: {
        type: 'circle',
        center: { x: cx.value, y: cy.value, z: cz.value },
        radius: radius.value,
        segments,
        purpose,
        vertexCount: segments
      }
    });

    return this;
  }

  /**
   * Create a rectangular loop from 4 vertices
   */
  createRectLoop(name: string, vertexNames: [string, string, string, string], purpose: LoopPurpose): this {
    const indices = vertexNames.map(vn => {
      const idx = this.vertices.get(vn);
      if (idx === undefined) {
        throw new Error(`Vertex '${vn}' not found for loop '${name}'`);
      }
      return idx;
    });

    this.loops.set(name, { indices, purpose });

    this.traces.set(`loop:${name}`, {
      type: 'loop',
      name,
      source: {
        expression: `rect([${vertexNames.join(', ')}])`,
        builderName: this.name
      },
      details: {
        type: 'rect',
        vertices: vertexNames,
        purpose
      }
    });

    return this;
  }

  // ==========================================================================
  // PORTS (B5-001: Attachment Points)
  // ==========================================================================

  /**
   * Register a named attachment point (port) for composition
   *
   * Ports define where child builders can attach. A port has:
   * - position: Location in local space
   * - normal: Outward-facing direction (for alignment)
   * - up: Optional up vector for full orientation
   * - loop: Optional reference to a named edge loop
   */
  registerPort(
    name: string,
    position: Vec3,
    normal: Vec3,
    options?: { up?: Vec3; loop?: string; metadata?: Record<string, any> }
  ): this {
    const port: TracedPort = {
      name,
      position,
      normal,
      up: options?.up,
      loop: options?.loop,
      metadata: options?.metadata
    };

    this.ports.set(name, port);

    this.traces.set(`port:${name}`, {
      type: 'port',
      name,
      source: { builderName: this.name },
      details: {
        position: { x: position.x, y: position.y, z: position.z },
        normal: { x: normal.x, y: normal.y, z: normal.z },
        up: options?.up ? { x: options.up.x, y: options.up.y, z: options.up.z } : undefined,
        loop: options?.loop,
        metadata: options?.metadata
      }
    });

    return this;
  }

  /**
   * Get a registered port by name
   */
  getPort(name: string): TracedPort | undefined {
    return this.ports.get(name);
  }

  /**
   * Get all registered ports
   */
  getPorts(): Map<string, TracedPort> {
    return this.ports;
  }

  // ==========================================================================
  // SKELETON (E1-001: Skeleton Declaration)
  // ==========================================================================

  /**
   * Register a skeleton with joints
   *
   * Validates the skeleton hierarchy:
   * - No duplicate joint names
   * - Parent references are valid
   * - No cycles in hierarchy
   *
   * Computes world transforms for each joint.
   */
  registerSkeleton(joints: Array<{
    name: string;
    parent: string | null;
    position: Vec3;
    orientation: Vec3;
    constraints?: JointConstraint;
  }>): this {
    // Validate: no duplicate names
    const names = new Set<string>();
    for (const joint of joints) {
      if (names.has(joint.name)) {
        throw new Error(`Duplicate joint name: '${joint.name}'`);
      }
      names.add(joint.name);
    }

    // Validate: parent references are valid
    for (const joint of joints) {
      if (joint.parent !== null && !names.has(joint.parent)) {
        throw new Error(`Joint '${joint.name}' references non-existent parent '${joint.parent}'`);
      }
    }

    // Validate: no cycles (using topological sort approach)
    const visited = new Set<string>();
    const inPath = new Set<string>();
    const jointMap = new Map(joints.map(j => [j.name, j]));

    const hasCycle = (name: string): boolean => {
      if (inPath.has(name)) return true;
      if (visited.has(name)) return false;

      visited.add(name);
      inPath.add(name);

      const joint = jointMap.get(name)!;
      if (joint.parent !== null && hasCycle(joint.parent)) {
        return true;
      }

      inPath.delete(name);
      return false;
    };

    for (const joint of joints) {
      if (hasCycle(joint.name)) {
        throw new Error(`Cycle detected in skeleton hierarchy involving joint '${joint.name}'`);
      }
    }

    // Build TracedJoints with world transforms
    const tracedJoints: TracedJoint[] = [];
    const tracedMap = new Map<string, TracedJoint>();
    const roots: string[] = [];

    // Process in order that ensures parents are processed before children
    const processed = new Set<string>();
    const toProcess = [...joints];

    while (toProcess.length > 0) {
      const nextBatch: typeof toProcess = [];

      for (const joint of toProcess) {
        // Can process if root or parent already processed
        if (joint.parent === null || processed.has(joint.parent)) {
          let worldPosition: Vec3;
          let worldOrientation: Vec3;

          if (joint.parent === null) {
            // Root joint: world transform equals local transform
            worldPosition = joint.position.clone();
            worldOrientation = joint.orientation.clone();
            roots.push(joint.name);
          } else {
            // Child joint: world transform = parent world + local
            const parent = tracedMap.get(joint.parent)!;
            // Apply parent rotation to local position
            worldPosition = parent.worldPosition.add(
              this.rotatePoint(joint.position, {
                x: parent.worldOrientation.x,
                y: parent.worldOrientation.y,
                z: parent.worldOrientation.z
              })
            );
            // Combine orientations (simplified: additive for euler angles)
            worldOrientation = new Vec3(
              parent.worldOrientation.x + joint.orientation.x,
              parent.worldOrientation.y + joint.orientation.y,
              parent.worldOrientation.z + joint.orientation.z
            );
          }

          const tracedJoint: TracedJoint = {
            name: joint.name,
            parent: joint.parent,
            position: joint.position,
            orientation: joint.orientation,
            worldPosition,
            worldOrientation,
            constraints: joint.constraints
          };

          tracedJoints.push(tracedJoint);
          tracedMap.set(joint.name, tracedJoint);
          processed.add(joint.name);
        } else {
          // Parent not yet processed, defer to next batch
          nextBatch.push(joint);
        }
      }

      if (nextBatch.length === toProcess.length) {
        // No progress made, shouldn't happen after cycle detection
        throw new Error('Failed to process skeleton hierarchy');
      }

      toProcess.length = 0;
      toProcess.push(...nextBatch);
    }

    this.skeleton = {
      joints: tracedJoints,
      jointMap: tracedMap,
      roots
    };

    // Add traces for each joint
    for (const joint of tracedJoints) {
      this.traces.set(`joint:${joint.name}`, {
        type: 'measurement',  // Reuse measurement type for now
        name: joint.name,
        source: { builderName: this.name },
        details: {
          parent: joint.parent,
          position: { x: joint.position.x, y: joint.position.y, z: joint.position.z },
          orientation: { x: joint.orientation.x, y: joint.orientation.y, z: joint.orientation.z },
          worldPosition: { x: joint.worldPosition.x, y: joint.worldPosition.y, z: joint.worldPosition.z },
          constraints: joint.constraints
        }
      });
    }

    return this;
  }

  /**
   * Get the skeleton (null if not defined)
   */
  getSkeleton(): TracedSkeleton | null {
    return this.skeleton;
  }

  /**
   * Get a specific joint by name
   */
  getJoint(name: string): TracedJoint | undefined {
    return this.skeleton?.jointMap.get(name);
  }

  /**
   * Adopt a child skeleton as this builder's skeleton (H1-001)
   *
   * Used when the parent builder has no skeleton and the first composed builder
   * brings a skeleton that should become the parent's skeleton.
   *
   * @param instanceName - Prefix for joint names (optional, can be empty for primary component)
   * @param childSkeleton - The child builder's skeleton to adopt
   * @param transform - Composition transform (offset, rotation, scale)
   */
  adoptSkeleton(
    instanceName: string,
    childSkeleton: TracedSkeleton,
    transform: { offset?: { x: number; y: number; z: number }; rotation?: { x: number; y: number; z: number }; scale?: number }
  ): void {
    const offset = transform.offset ?? { x: 0, y: 0, z: 0 };
    const scale = transform.scale ?? 1;

    // Create new skeleton from child skeleton
    this.skeleton = {
      joints: [],
      jointMap: new Map(),
      roots: []
    };

    // Process each joint from the child skeleton
    for (const childJoint of childSkeleton.joints) {
      // Transform the position
      let pos = childJoint.position.clone();

      if (scale !== 1) {
        pos = pos.mul(scale);
      }

      if (transform.rotation) {
        pos = this.rotatePoint(pos, transform.rotation);
      }

      pos = pos.add(new Vec3(offset.x, offset.y, offset.z));

      // Transform world position
      let worldPos = childJoint.worldPosition.clone();

      if (scale !== 1) {
        worldPos = worldPos.mul(scale);
      }

      if (transform.rotation) {
        worldPos = this.rotatePoint(worldPos, transform.rotation);
      }

      worldPos = worldPos.add(new Vec3(offset.x, offset.y, offset.z));

      // Create the adopted joint
      const adoptedJoint: TracedJoint = {
        name: childJoint.name, // Keep original names since this is the primary skeleton
        parent: childJoint.parent,
        position: pos,
        orientation: childJoint.orientation.clone(),
        worldPosition: worldPos,
        worldOrientation: childJoint.worldOrientation.clone(),
        constraints: childJoint.constraints
      };

      this.skeleton.joints.push(adoptedJoint);
      this.skeleton.jointMap.set(adoptedJoint.name, adoptedJoint);

      if (childJoint.parent === null) {
        this.skeleton.roots.push(adoptedJoint.name);
      }
    }

    this.traces.set(`skeleton:adopted`, {
      type: 'skeleton',
      name: 'adopted',
      source: { builderName: this.name },
      details: {
        fromInstance: instanceName,
        jointCount: this.skeleton.joints.length,
        roots: this.skeleton.roots
      }
    });
  }

  // Track whether composed builders brought weights
  hasComposedWeights: boolean = false;

  /**
   * Merge a child skeleton into this builder's skeleton (E1-002)
   *
   * The child skeleton's root joints are re-parented to the specified parent joint.
   * All child joint names are prefixed with the instance name to avoid conflicts.
   * Child joint positions are adjusted by the composition transform.
   *
   * @param instanceName - Prefix for child joint names (e.g., "wing_L")
   * @param childSkeleton - The child builder's skeleton to merge
   * @param parentJointName - Name of the joint in this skeleton to attach to
   * @param transform - Composition transform (offset, rotation, scale)
   */
  mergeSkeleton(
    instanceName: string,
    childSkeleton: TracedSkeleton,
    parentJointName: string,
    transform: { offset?: { x: number; y: number; z: number }; rotation?: { x: number; y: number; z: number }; scale?: number }
  ): void {
    if (!this.skeleton) {
      throw new Error(`Cannot merge skeleton: parent builder has no skeleton`);
    }

    const parentJoint = this.skeleton.jointMap.get(parentJointName);
    if (!parentJoint) {
      throw new Error(`Cannot merge skeleton: parent joint '${parentJointName}' not found`);
    }

    const offset = transform.offset ?? { x: 0, y: 0, z: 0 };
    const scale = transform.scale ?? 1;

    // Process each child joint
    for (const childJoint of childSkeleton.joints) {
      // Prefix the joint name with instance name
      const prefixedName = `${instanceName}.${childJoint.name}`;

      // Determine the new parent
      let newParent: string | null;
      if (childJoint.parent === null) {
        // Root joints in child skeleton attach to the specified parent joint
        newParent = parentJointName;
      } else {
        // Non-root joints keep their parent, but prefixed
        newParent = `${instanceName}.${childJoint.parent}`;
      }

      // Transform the position by the composition transform
      let pos = childJoint.position.clone();

      // Apply scale
      if (scale !== 1) {
        pos = pos.mul(scale);
      }

      // Apply rotation
      if (transform.rotation) {
        pos = this.rotatePoint(pos, transform.rotation);
      }

      // For root joints, add the composition offset
      if (childJoint.parent === null) {
        pos = pos.add(new Vec3(offset.x, offset.y, offset.z));
      }

      // Compute new world position
      let worldPosition: Vec3;
      if (childJoint.parent === null) {
        // Root of child attaches to parent joint
        worldPosition = parentJoint.worldPosition.add(
          this.rotatePoint(pos, {
            x: parentJoint.worldOrientation.x,
            y: parentJoint.worldOrientation.y,
            z: parentJoint.worldOrientation.z
          })
        );
      } else {
        // Find the already-merged parent joint
        const mergedParent = this.skeleton.jointMap.get(newParent);
        if (mergedParent) {
          worldPosition = mergedParent.worldPosition.add(
            this.rotatePoint(pos, {
              x: mergedParent.worldOrientation.x,
              y: mergedParent.worldOrientation.y,
              z: mergedParent.worldOrientation.z
            })
          );
        } else {
          // Parent not yet processed (shouldn't happen with ordered processing)
          worldPosition = pos;
        }
      }

      // Combine orientations
      let worldOrientation = childJoint.worldOrientation.clone();
      if (transform.rotation) {
        worldOrientation = new Vec3(
          worldOrientation.x + transform.rotation.x,
          worldOrientation.y + transform.rotation.y,
          worldOrientation.z + transform.rotation.z
        );
      }

      const mergedJoint: TracedJoint = {
        name: prefixedName,
        parent: newParent,
        position: pos,
        orientation: childJoint.orientation.clone(),
        worldPosition,
        worldOrientation,
        constraints: childJoint.constraints
      };

      this.skeleton.joints.push(mergedJoint);
      this.skeleton.jointMap.set(prefixedName, mergedJoint);

      // Add trace
      this.traces.set(`joint:${prefixedName}`, {
        type: 'measurement',
        name: prefixedName,
        source: { builderName: this.name },
        details: {
          parent: newParent,
          position: { x: pos.x, y: pos.y, z: pos.z },
          orientation: { x: mergedJoint.orientation.x, y: mergedJoint.orientation.y, z: mergedJoint.orientation.z },
          worldPosition: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z },
          mergedFrom: instanceName,
          originalJoint: childJoint.name,
          constraints: childJoint.constraints
        }
      });
    }
  }

  // ==========================================================================
  // VERTEX WEIGHTS (E2-001)
  // ==========================================================================

  /** Maximum number of joint influences per vertex (standard for real-time) */
  static readonly MAX_INFLUENCES = 4;

  /**
   * Compute vertex weights from a set of rules
   *
   * @param rules Array of weight rules (proximity, region, gradient)
   */
  computeWeights(rules: Array<{
    type: 'proximity' | 'region' | 'gradient';
    joint?: string;
    joint_a?: string;
    joint_b?: string;
    radius?: number;
    falloff?: 'linear' | 'smooth' | 'sharp';
    min?: Vec3;
    max?: Vec3;
    weight?: number;
    axis?: 'x' | 'y' | 'z';
  }>): void {
    if (!this.skeleton) {
      throw new Error('Cannot compute weights: no skeleton defined');
    }

    const weights = new Map<number, VertexWeight[]>();
    const jointIndexMap = new Map<string, number>();

    // Build joint index lookup
    this.skeleton.joints.forEach((joint, index) => {
      jointIndexMap.set(joint.name, index);
    });

    // Process each vertex
    for (let vi = 0; vi < this.mesh.vertices.length; vi++) {
      const vertex = this.mesh.vertices[vi];
      const pos = vertex.position;
      const vertexWeights: VertexWeight[] = [];

      // Apply each rule
      for (const rule of rules) {
        if (rule.type === 'proximity') {
          const jointIndex = jointIndexMap.get(rule.joint!);
          if (jointIndex === undefined) continue;

          const joint = this.skeleton.joints[jointIndex];
          const distance = pos.sub(joint.worldPosition).length();
          const radius = rule.radius ?? 1;

          if (distance <= radius) {
            const t = distance / radius;
            let weight: number;

            switch (rule.falloff ?? 'linear') {
              case 'smooth':
                // Smooth falloff: 1 at center, 0 at edge, smooth curve
                weight = 1 - (3 * t * t - 2 * t * t * t);
                break;
              case 'sharp':
                // Sharp falloff: drops quickly near edge
                weight = 1 - t * t;
                break;
              case 'linear':
              default:
                weight = 1 - t;
            }

            if (weight > 0) {
              vertexWeights.push({ jointIndex, weight });
            }
          }
        } else if (rule.type === 'region') {
          const jointIndex = jointIndexMap.get(rule.joint!);
          if (jointIndex === undefined) continue;

          const min = rule.min!;
          const max = rule.max!;

          if (pos.x >= min.x && pos.x <= max.x &&
              pos.y >= min.y && pos.y <= max.y &&
              pos.z >= min.z && pos.z <= max.z) {
            vertexWeights.push({
              jointIndex,
              weight: rule.weight ?? 1
            });
          }
        } else if (rule.type === 'gradient') {
          const jointAIndex = jointIndexMap.get(rule.joint_a!);
          const jointBIndex = jointIndexMap.get(rule.joint_b!);
          if (jointAIndex === undefined || jointBIndex === undefined) continue;

          const jointA = this.skeleton.joints[jointAIndex];
          const jointB = this.skeleton.joints[jointBIndex];
          const axis = rule.axis ?? 'y';

          // Get position along axis
          const posVal = axis === 'x' ? pos.x : axis === 'y' ? pos.y : pos.z;
          const aVal = axis === 'x' ? jointA.worldPosition.x : axis === 'y' ? jointA.worldPosition.y : jointA.worldPosition.z;
          const bVal = axis === 'x' ? jointB.worldPosition.x : axis === 'y' ? jointB.worldPosition.y : jointB.worldPosition.z;

          // Compute blend factor (0 = joint_a, 1 = joint_b)
          const range = bVal - aVal;
          if (Math.abs(range) < 0.0001) continue;

          const t = Math.max(0, Math.min(1, (posVal - aVal) / range));

          if (1 - t > 0.001) {
            vertexWeights.push({ jointIndex: jointAIndex, weight: 1 - t });
          }
          if (t > 0.001) {
            vertexWeights.push({ jointIndex: jointBIndex, weight: t });
          }
        }
      }

      // Merge duplicate joint weights
      const merged = new Map<number, number>();
      for (const vw of vertexWeights) {
        merged.set(vw.jointIndex, (merged.get(vw.jointIndex) ?? 0) + vw.weight);
      }

      // Sort by weight and take top MAX_INFLUENCES
      const sortedWeights = Array.from(merged.entries())
        .map(([jointIndex, weight]) => ({ jointIndex, weight }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, TracedBuilder.MAX_INFLUENCES);

      // Normalize weights to sum to 1
      if (sortedWeights.length > 0) {
        const total = sortedWeights.reduce((sum, w) => sum + w.weight, 0);
        if (total > 0) {
          for (const w of sortedWeights) {
            w.weight /= total;
          }
          weights.set(vi, sortedWeights);
        }
      }
    }

    // Compute statistics
    const totalVertices = this.mesh.vertices.length;
    const weightedVertices = weights.size;
    let maxInfluencesUsed = 0;
    for (const vw of weights.values()) {
      maxInfluencesUsed = Math.max(maxInfluencesUsed, vw.length);
    }

    this.vertexWeights = {
      weights,
      maxInfluences: TracedBuilder.MAX_INFLUENCES,
      stats: {
        totalVertices,
        weightedVertices,
        unweightedVertices: totalVertices - weightedVertices,
        maxInfluencesUsed
      }
    };

    // Add trace
    this.traces.set('weights:computed', {
      type: 'modifier',
      name: 'weights',
      source: { builderName: this.name },
      details: {
        ruleCount: rules.length,
        ...this.vertexWeights.stats
      }
    });
  }

  /**
   * Get the computed vertex weights (null if not computed)
   */
  getVertexWeights(): VertexWeights | null {
    return this.vertexWeights;
  }

  /**
   * Get weights for a specific vertex
   */
  getWeightsForVertex(vertexIndex: number): VertexWeight[] {
    return this.vertexWeights?.weights.get(vertexIndex) ?? [];
  }

  // ==========================================================================
  // MORPH TARGETS (E3-001: Morph Target System)
  // ==========================================================================

  /**
   * Register morph targets for this builder
   *
   * Each target is a named set of vertex position offsets.
   * Used for character variation, facial expressions, LOD blending, etc.
   *
   * @param targets Array of morph target definitions
   */
  registerMorphTargets(targets: Array<{
    name: string;
    offsets: Array<{ vertexIndex: number; offset: Vec3 }>;
    defaultWeight?: number;
    description?: string;
  }>): this {
    const baseVertexCount = this.mesh.vertices.length;

    // Validate all targets
    const names = new Set<string>();
    for (const target of targets) {
      // Check for duplicate names
      if (names.has(target.name)) {
        throw new Error(`Duplicate morph target name: '${target.name}'`);
      }
      names.add(target.name);

      // Validate vertex indices
      for (const offset of target.offsets) {
        if (offset.vertexIndex < 0 || offset.vertexIndex >= baseVertexCount) {
          throw new Error(
            `Morph target '${target.name}': vertex index ${offset.vertexIndex} out of bounds (0-${baseVertexCount - 1})`
          );
        }
      }
    }

    // Store the morph targets
    this.morphTargets = {
      baseVertexCount,
      targets: targets.map(t => ({
        name: t.name,
        offsets: t.offsets.map(o => ({
          vertexIndex: o.vertexIndex,
          offset: o.offset.clone()
        })),
        defaultWeight: t.defaultWeight ?? 0,
        description: t.description
      }))
    };

    // Add trace entry
    this.traces.set('morph_targets', {
      type: 'morph_targets',
      name: 'morph_targets',
      source: { expression: 'registerMorphTargets()', builderName: this.name },
      details: {
        targetCount: targets.length,
        targetNames: targets.map(t => t.name)
      }
    });

    return this;
  }

  /**
   * Add a single morph target computed from another mesh (variant)
   *
   * @param name Name for the morph target
   * @param variantMesh The variant mesh (must have identical topology)
   * @param defaultWeight Default blend weight (0-1)
   * @param description Optional description
   * @param threshold Minimum offset magnitude to include (default 0.0001)
   */
  addMorphTargetFromMesh(
    name: string,
    variantMesh: Mesh,
    defaultWeight: number = 0,
    description?: string,
    threshold: number = 0.0001
  ): this {
    const base = this.mesh;

    // Validate topology match
    if (base.vertices.length !== variantMesh.vertices.length) {
      throw new Error(
        `Topology mismatch: base has ${base.vertices.length} vertices, variant has ${variantMesh.vertices.length}`
      );
    }

    if (base.faces.length !== variantMesh.faces.length) {
      throw new Error(
        `Topology mismatch: base has ${base.faces.length} faces, variant has ${variantMesh.faces.length}`
      );
    }

    // Compute position deltas
    const offsets: Array<{ vertexIndex: number; offset: Vec3 }> = [];
    for (let i = 0; i < base.vertices.length; i++) {
      const basePos = base.vertices[i].position;
      const variantPos = variantMesh.vertices[i].position;
      const delta = variantPos.sub(basePos);

      if (delta.length() > threshold) {
        offsets.push({ vertexIndex: i, offset: delta });
      }
    }

    // Initialize or add to existing set
    if (!this.morphTargets) {
      this.morphTargets = {
        baseVertexCount: base.vertices.length,
        targets: []
      };
    }

    // Check for duplicate name
    if (this.morphTargets.targets.some(t => t.name === name)) {
      throw new Error(`Morph target '${name}' already exists`);
    }

    this.morphTargets.targets.push({
      name,
      offsets,
      defaultWeight,
      description
    });

    return this;
  }

  /**
   * Get the morph targets (null if not defined)
   */
  getMorphTargets(): TracedMorphTargetSet | null {
    return this.morphTargets;
  }

  /**
   * Get a specific morph target by name
   */
  getMorphTarget(name: string): TracedMorphTarget | undefined {
    return this.morphTargets?.targets.find(t => t.name === name);
  }

  /**
   * Get all morph target names
   */
  getMorphTargetNames(): string[] {
    return this.morphTargets?.targets.map(t => t.name) ?? [];
  }

  // ==========================================================================
  // FACES
  // ==========================================================================

  /**
   * Create a face from named vertices (traced)
   * @param color Optional RGB color in 0-1 range
   */
  createFace(name: string, vertexNames: string[], color?: { r: number; g: number; b: number }, materialSlotIndex?: number): this {
    const indices = vertexNames.map(vn => {
      const idx = this.vertices.get(vn);
      if (idx === undefined) {
        throw new Error(`Vertex '${vn}' not found for face '${name}'`);
      }
      return idx;
    });

    // Assign planar UV projection if vertices don't already have UVs
    const faceVerts = indices.map(i => this.mesh.vertices[i]);
    const hasExistingUVs = faceVerts.some(v => v.attributes.uv);
    if (!hasExistingUVs && faceVerts.length >= 3) {
      // Compute face plane and project vertices to get UVs
      const positions = faceVerts.map(v => v.position);
      const edge1 = positions[1].sub(positions[0]);
      const edge2 = positions[positions.length - 1].sub(positions[0]);
      const normal = edge1.cross(edge2).normalize();

      // Create tangent frame on face plane
      let tangentU = edge1.normalize();
      let tangentV = normal.cross(tangentU).normalize();

      // Project all positions onto tangent frame
      const projected = positions.map(p => ({
        u: p.dot(tangentU),
        v: p.dot(tangentV)
      }));

      // Normalize to [0, 1]
      const minU = Math.min(...projected.map(p => p.u));
      const maxU = Math.max(...projected.map(p => p.u));
      const minV = Math.min(...projected.map(p => p.v));
      const maxV = Math.max(...projected.map(p => p.v));
      const rangeU = maxU - minU || 1;
      const rangeV = maxV - minV || 1;

      for (let i = 0; i < faceVerts.length; i++) {
        faceVerts[i].attributes.uv = [
          (projected[i].u - minU) / rangeU,
          (projected[i].v - minV) / rangeV
        ];
      }
    }

    this.mesh.addFace(new Face(indices, color, materialSlotIndex));

    this.traces.set(`face:${name}`, {
      type: 'face',
      name,
      source: {
        expression: `[${vertexNames.join(', ')}]`,
        builderName: this.name
      },
      details: {
        vertices: vertexNames,
        indices,
        color
      }
    });

    return this;
  }

  // ==========================================================================
  // LOFTING
  // ==========================================================================

  /**
   * Loft between two loops (traced)
   */
  /**
   * Loft between two loops (traced)
   * @param color Optional RGB color for all generated faces
   *
   * Creates quad faces connecting corresponding vertices of two loops.
   * Face winding ensures outward-facing normals when loop1 is "above" loop2
   * (i.e., lofting from top to bottom of a cylinder).
   */
  loftLoops(name: string, loopName1: string, loopName2: string, color?: { r: number; g: number; b: number }, materialSlotIndex?: number): this {
    const loop1 = this.loops.get(loopName1);
    const loop2 = this.loops.get(loopName2);

    if (!loop1) throw new Error(`Loop '${loopName1}' not found for loft '${name}'`);
    if (!loop2) throw new Error(`Loop '${loopName2}' not found for loft '${name}'`);
    if (loop1.indices.length !== loop2.indices.length) {
      throw new Error(`Loops '${loopName1}' and '${loopName2}' have different vertex counts`);
    }

    const n = loop1.indices.length;

    // Update UV v-coordinates: loop2 vertices get v=1 (loop1 stays at v=0 from createCircleLoop)
    for (let i = 0; i < n; i++) {
      const v2 = this.mesh.vertices[loop2.indices[i]];
      if (v2.attributes.uv) {
        v2.attributes.uv = [v2.attributes.uv[0], 1];
      }
    }

    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      // Face winding: loop1[i] -> loop2[i] -> loop2[next] -> loop1[next]
      // Circles wind CW from above (+Y), so this quad has its normal pointing
      // outward (away from the cylinder axis). Compatible with capLoop convention:
      // - loop1 (bottom/from) cap: flip=false  → normal points down (-Y)
      // - loop2 (top/to) cap:    flip=true   → normal points up (+Y)
      this.mesh.addFace(new Face([
        loop1.indices[i],
        loop2.indices[i],
        loop2.indices[next],
        loop1.indices[next]
      ], color, materialSlotIndex));
    }

    this.traces.set(`loft:${name}`, {
      type: 'loft',
      name,
      source: {
        expression: `loft(${loopName1}, ${loopName2})`,
        builderName: this.name
      },
      details: {
        loops: [loopName1, loopName2],
        faceCount: n,
        color
      }
    });

    return this;
  }

  /**
   * Cap a loop with a face (traced)
   * @param color Optional RGB color for the cap face
   */
  capLoop(name: string, loopName: string, reverse: boolean = false, color?: { r: number; g: number; b: number }, materialSlotIndex?: number): this {
    const loop = this.loops.get(loopName);
    if (!loop) throw new Error(`Loop '${loopName}' not found for cap '${name}'`);

    // Create new vertices for the cap with radial UVs (don't reuse loft vertices — need separate UVs)
    // Cap vertices get a different smoothGroup than body to produce hard edges at the cap boundary
    const loopLen = loop.indices.length;
    const capIndices: number[] = [];
    // Use a high smoothGroup ID to avoid collisions with body smoothGroups
    const capSmoothGroup = 100 + this.mesh.faces.length;
    for (let i = 0; i < loopLen; i++) {
      const angle = (i / loopLen) * Math.PI * 2;
      const origVertex = this.mesh.vertices[loop.indices[i]];
      const capVertex = origVertex.clone();
      capVertex.attributes.uv = [0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5];
      capVertex.attributes.smoothGroup = capSmoothGroup;
      capIndices.push(this.mesh.addVertex(capVertex));
    }

    const indices = reverse ? [...capIndices].reverse() : capIndices;
    this.mesh.addFace(new Face(indices, color, materialSlotIndex));

    this.traces.set(`face:${name}`, {
      type: 'face',
      name,
      source: {
        expression: `cap(${loopName}${reverse ? ', reverse' : ''})`,
        builderName: this.name
      },
      details: {
        loop: loopName,
        reversed: reverse
      }
    });

    return this;
  }

  // ==========================================================================
  // COMPOSITION (Sub-Builders)
  // ==========================================================================

  /**
   * Compose a sub-builder into this builder's mesh
   *
   * The sub-builder runs with a forked RNG for determinism.
   * By default, merges sub-builder mesh into this mesh with transform.
   * With asInstance=true, stores as instance data without merging (P2-M2c-003).
   * Sub-builder decisions are prefixed with the instance name.
   *
   * @param instanceName - Unique name for this instance (e.g., "head", "left_arm")
   * @param builderFn - Function that creates the sub-builder output
   * @param options - Transform and override options
   */
  async compose(
    instanceName: string,
    builderFn: (seed: number, overrides?: Record<string, any>) => TracedOutput | Promise<TracedOutput>,
    options: {
      offset?: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number };  // Euler angles in radians
      scale?: number;
      overrides?: Record<string, any>;
      constraints?: Record<string, any>;  // Constraints to pass to child builder (P2-M2d-002)
      asInstance?: boolean;  // If true, don't merge mesh, output as instance (P2-M2c-003)
    } = {}
  ): Promise<this> {
    // Fork RNG for deterministic sub-builder seed
    const subSeed = Math.floor(this.rng.next() * 0xffffffff);

    // Merge constraints into overrides as __constraints__ (P2-M2d-002)
    const finalOverrides = { ...options.overrides };
    if (options.constraints) {
      finalOverrides.__constraints__ = options.constraints;
    }

    // Run the sub-builder (await if it's async)
    const subOutput = await builderFn(subSeed, finalOverrides);

    // Store the sub-builder output for inspection
    this.subBuilders.set(instanceName, subOutput);

    const offset = options.offset ?? { x: 0, y: 0, z: 0 };
    const scale = options.scale ?? 1;

    // If asInstance=true, store instance data instead of merging mesh (P2-M2c-003)
    if (options.asInstance) {
      this.instances.push({
        id: instanceName,
        builderName: subOutput.builderName,
        transform: {
          position: { x: offset.x, y: offset.y, z: offset.z },
          rotation: options.rotation,
          scale: scale !== 1 ? scale : undefined
        },
        overrides: options.overrides,
        seed: subSeed
      });

      // Add composition trace (no mesh merge)
      this.traces.set(`compose:${instanceName}`, {
        type: 'modifier',
        name: instanceName,
        source: { builderName: this.name },
        details: {
          subBuilder: subOutput.builderName,
          subSeed,
          offset,
          rotation: options.rotation,
          scale,
          asInstance: true,
          verticesAdded: 0,
          facesAdded: 0
        }
      });

      return this;
    }

    // Default behavior: merge sub-builder mesh into this mesh with transform

    // Track vertex index mapping (sub-builder index → parent index)
    const vertexMap = new Map<number, number>();

    // Add all vertices from sub-builder with transform
    for (let i = 0; i < subOutput.mesh.vertices.length; i++) {
      const v = subOutput.mesh.vertices[i];
      let pos = v.position.clone();

      // Apply scale
      if (scale !== 1) {
        pos = pos.mul(scale);
      }

      // Apply rotation (simple Euler rotation: Y then X then Z)
      if (options.rotation) {
        pos = this.rotatePoint(pos, options.rotation);
      }

      // Apply offset
      pos = pos.add(new Vec3(offset.x, offset.y, offset.z));

      // Clone vertex to preserve attributes (UVs, normals, colors), then update position
      const newVertex = v.clone();
      newVertex.position = pos;
      const newIndex = this.mesh.addVertex(newVertex);
      vertexMap.set(i, newIndex);

      // Register vertex with prefixed name
      this.vertices.set(`${instanceName}_v${i}`, newIndex);
    }

    // Merge material slots from child to parent and create index mapping
    const materialSlotMap = new Map<number, number>();
    for (let i = 0; i < subOutput.mesh.materialSlots.length; i++) {
      const childSlot = subOutput.mesh.materialSlots[i];
      // Add slot to parent (or get existing index if same name)
      const parentIndex = this.mesh.addMaterialSlot(childSlot);
      materialSlotMap.set(i, parentIndex);
    }

    // Add all faces with remapped indices and material slot
    for (const face of subOutput.mesh.faces) {
      const newIndices = face.indices.map(idx => vertexMap.get(idx)!);
      // Remap material slot index if present
      const newMaterialSlotIndex = face.materialSlotIndex !== undefined
        ? materialSlotMap.get(face.materialSlotIndex)
        : undefined;
      this.mesh.addFace(new Face(newIndices, face.color, newMaterialSlotIndex));
    }

    // Merge loops with prefixed names
    for (const [loopName, loop] of subOutput.loops) {
      const newIndices = loop.indices.map(idx => vertexMap.get(idx)!);
      this.loops.set(`${instanceName}.${loopName}`, { indices: newIndices, purpose: loop.purpose });
    }

    // Merge decisions with prefixed names
    for (const [decName, decision] of subOutput.decisions) {
      const prefixedName = `${instanceName}.${decName}`;
      this.decisions.set(prefixedName, { ...decision, name: prefixedName });
    }

    // Merge measurements with prefixed names
    for (const [measName, meas] of subOutput.measurements) {
      this.measurements.set(`${instanceName}.${measName}`, meas);
    }

    // Add composition trace
    this.traces.set(`compose:${instanceName}`, {
      type: 'modifier',
      name: instanceName,
      source: { builderName: this.name },
      details: {
        subBuilder: subOutput.builderName,
        subSeed,
        offset,
        rotation: options.rotation,
        scale,
        verticesAdded: subOutput.mesh.vertices.length,
        facesAdded: subOutput.mesh.faces.length
      }
    });

    return this;
  }

  /**
   * Rotate a point using Euler angles (Y-X-Z order)
   */
  private rotatePoint(p: Vec3, rotation: { x: number; y: number; z: number }): Vec3 {
    let { x, y, z } = { x: p.x, y: p.y, z: p.z };

    // Rotate around Y axis
    if (rotation.y !== 0) {
      const cosY = Math.cos(rotation.y);
      const sinY = Math.sin(rotation.y);
      const newX = x * cosY + z * sinY;
      const newZ = -x * sinY + z * cosY;
      x = newX;
      z = newZ;
    }

    // Rotate around X axis
    if (rotation.x !== 0) {
      const cosX = Math.cos(rotation.x);
      const sinX = Math.sin(rotation.x);
      const newY = y * cosX - z * sinX;
      const newZ = y * sinX + z * cosX;
      y = newY;
      z = newZ;
    }

    // Rotate around Z axis
    if (rotation.z !== 0) {
      const cosZ = Math.cos(rotation.z);
      const sinZ = Math.sin(rotation.z);
      const newX = x * cosZ - y * sinZ;
      const newY = x * sinZ + y * cosZ;
      x = newX;
      y = newY;
    }

    return new Vec3(x, y, z);
  }

  /**
   * Get a sub-builder output by name
   */
  getSubBuilder(instanceName: string): TracedOutput | undefined {
    return this.subBuilders.get(instanceName);
  }

  /**
   * Get all sub-builder outputs
   */
  getAllSubBuilders(): Map<string, TracedOutput> {
    return this.subBuilders;
  }

  // ==========================================================================
  // MESH MANIPULATION (P2-M1b)
  // ==========================================================================

  /**
   * Get the current mesh (for subdivision, etc.)
   */
  getMesh(): Mesh {
    return this.mesh;
  }

  /**
   * Replace the entire mesh (used after subdivision)
   */
  replaceMesh(newMesh: Mesh): void {
    this.mesh = newMesh;
  }

  /**
   * Merge an external mesh into this builder's mesh
   * Used for lathe, sweep, and other geometry operations
   */
  mergeMesh(name: string, externalMesh: Mesh, color?: { r: number; g: number; b: number }, materialSlotIndex?: number): void {
    // Track vertex index mapping
    const vertexMap = new Map<number, number>();

    // Add all vertices from external mesh (preserving attributes like UVs)
    for (let i = 0; i < externalMesh.vertices.length; i++) {
      const v = externalMesh.vertices[i];
      const newIndex = this.mesh.addVertex(v.clone());
      vertexMap.set(i, newIndex);
    }

    // Add all faces with remapped indices and optional color/slot
    for (const face of externalMesh.faces) {
      const newIndices = face.indices.map(idx => vertexMap.get(idx)!);
      this.mesh.addFace(new Face(newIndices, color, materialSlotIndex));
    }

    // Add trace
    this.traces.set(`mesh:${name}`, {
      type: 'modifier',
      name,
      source: { builderName: this.name },
      details: {
        verticesAdded: externalMesh.vertices.length,
        facesAdded: externalMesh.faces.length,
        color
      }
    });
  }

  /**
   * Add a custom trace entry
   */
  trace(key: string, details: Record<string, any>): void {
    this.traces.set(key, {
      type: 'modifier',
      name: key,
      source: { builderName: this.name },
      details
    });
  }

  // ==========================================================================
  // BUILD
  // ==========================================================================

  /**
   * Build and return traced output
   */
  build(): TracedOutput {
    const buildTime = Date.now() - this.startTime;
    const bounds = this.mesh.getBounds();
    const issues = this.validate();

    return {
      builderName: this.name,
      seed: this.seed,
      mesh: this.mesh,
      traces: this.traces,
      measurements: this.measurements,
      decisions: this.decisions,
      loops: this.loops,
      ports: this.ports,  // B5-001: Attachment points
      skeleton: this.skeleton ?? undefined,  // E1-001: Skeleton
      vertexWeights: this.vertexWeights ?? undefined,  // E2-001: Vertex Weights
      morphTargets: this.morphTargets ?? undefined,  // E3-001: Morph Targets
      connections: this.connections.length > 0 ? this.connections : undefined,  // F4-002: Assembly connections
      subBuilders: this.subBuilders,
      instances: this.instances.length > 0 ? this.instances : undefined,  // Include if any instances
      validation: {
        issues,
        bounds,
        vertexCount: this.mesh.vertices.length,
        faceCount: this.mesh.faces.length
      },
      buildTime
    };
  }

  /**
   * Validate the mesh
   */
  private validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check: All vertices used in faces?
    const usedVertices = new Set<number>();
    for (const face of this.mesh.faces) {
      for (const idx of face.indices) {
        usedVertices.add(idx);
      }
    }

    for (const [name, index] of this.vertices) {
      if (!usedVertices.has(index)) {
        issues.push({
          severity: 'warning',
          message: `Vertex '${name}' defined but never used in a face`,
          source: this.traces.get(`vertex:${name}`),
          suggestion: 'Either use this vertex in a face or remove it'
        });
      }
    }

    // Check: Mesh has content?
    if (this.mesh.vertices.length === 0) {
      issues.push({
        severity: 'error',
        message: 'Mesh has no vertices',
        suggestion: 'Add vertices using placeVertex() or createCircleLoop()'
      });
    }

    if (this.mesh.faces.length === 0 && this.mesh.vertices.length > 0) {
      issues.push({
        severity: 'warning',
        message: 'Mesh has vertices but no faces',
        suggestion: 'Add faces using createFace(), loftLoops(), or capLoop()'
      });
    }

    // Check: Bounds reasonable?
    const bounds = this.mesh.getBounds();
    if (bounds.size.x > 100 || bounds.size.y > 100 || bounds.size.z > 100) {
      issues.push({
        severity: 'warning',
        message: `Mesh is very large: ${bounds.size.x.toFixed(2)} x ${bounds.size.y.toFixed(2)} x ${bounds.size.z.toFixed(2)}m`,
        suggestion: 'Check measurement units (expected meters)'
      });
    }

    // F1-002: Include external issues (from constraint validation, etc.)
    issues.push(...this.externalIssues);

    return issues;
  }

  // ==========================================================================
  // DEBUG
  // ==========================================================================

  /**
   * Get debug info for a specific part
   */
  getTrace(key: string): TraceEntry | undefined {
    return this.traces.get(key);
  }

  /**
   * Get all traces
   */
  getAllTraces(): Map<string, TraceEntry> {
    return this.traces;
  }

  /**
   * Print debug summary
   */
  debugSummary(): string {
    const lines: string[] = [
      `=== Builder: ${this.name} ===`,
      '',
      'Measurements:'
    ];

    for (const [name, { value, source }] of this.measurements) {
      lines.push(`  ${name}: ${value}${source ? ` (from: ${source})` : ''}`);
    }

    lines.push('', 'Vertices:');
    for (const [name] of this.vertices) {
      const trace = this.traces.get(`vertex:${name}`);
      const pos = trace?.details?.position;
      if (pos) {
        lines.push(`  ${name}: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`);
      }
    }

    lines.push('', 'Loops:');
    for (const [name, { indices, purpose }] of this.loops) {
      lines.push(`  ${name}: ${indices.length} vertices, purpose: ${purpose}`);
    }

    lines.push('', `Faces: ${this.mesh.faces.length}`);
    lines.push(`Vertices total: ${this.mesh.vertices.length}`);

    return lines.join('\n');
  }
}

