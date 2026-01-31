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
  source: 'random' | 'override' | 'default';
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
  type: 'measurement' | 'vertex' | 'loop' | 'face' | 'loft' | 'modifier';
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
  private mesh: Mesh;
  public traces: Map<string, TraceEntry>;  // Public for YAML parser access
  public measurements: Map<string, { value: number; source?: string }>;  // Public for YAML parser access
  public decisions: Map<string, TracedDecision>;  // Public for YAML parser access
  private decisionOverrides: Map<string, any>;
  private constraints: Map<string, any>;  // Constraints from parent builder (P2-M2d-002)
  private vertices: Map<string, number>;  // name → index
  private loops: Map<string, { indices: number[]; purpose: LoopPurpose }>;
  private subBuilders: Map<string, TracedOutput>;  // Composed sub-builders
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
    this.vertices = new Map();
    this.loops = new Map();
    this.subBuilders = new Map();
    this.instances = [];
    this.startTime = Date.now();

    // Extract constraints from overrides (P2-M2d-002)
    if (overrides && overrides.__constraints__) {
      this.constraints = new Map(Object.entries(overrides.__constraints__));
      // Remove __constraints__ from decision overrides
      delete overrides.__constraints__;
      this.decisionOverrides = new Map(Object.entries(overrides));
    }
  }

  // ==========================================================================
  // DECISION MAKING (Virtual Artist Choices)
  // ==========================================================================

  /**
   * Make a decision by choosing from options (traced)
   * If overridden, uses override value instead of random
   */
  decide<T>(name: string, options: T[], weights?: number[]): T {
    // Check for override
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
   */
  decideNumber(name: string, min: number, max: number, defaultValue?: number): number {
    // Check for override
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

    // If default provided and no override, use default
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
   */
  decideCount(name: string, min: number, max: number): number {
    // Check for override
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
      const index = this.mesh.addVertex(new Vertex(pos));
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
  // FACES
  // ==========================================================================

  /**
   * Create a face from named vertices (traced)
   * @param color Optional RGB color in 0-1 range
   */
  createFace(name: string, vertexNames: string[], color?: { r: number; g: number; b: number }): this {
    const indices = vertexNames.map(vn => {
      const idx = this.vertices.get(vn);
      if (idx === undefined) {
        throw new Error(`Vertex '${vn}' not found for face '${name}'`);
      }
      return idx;
    });

    this.mesh.addFace(new Face(indices, color));

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
  loftLoops(name: string, loopName1: string, loopName2: string, color?: { r: number; g: number; b: number }): this {
    const loop1 = this.loops.get(loopName1);
    const loop2 = this.loops.get(loopName2);

    if (!loop1) throw new Error(`Loop '${loopName1}' not found for loft '${name}'`);
    if (!loop2) throw new Error(`Loop '${loopName2}' not found for loft '${name}'`);
    if (loop1.indices.length !== loop2.indices.length) {
      throw new Error(`Loops '${loopName1}' and '${loopName2}' have different vertex counts`);
    }

    const n = loop1.indices.length;
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      // Face winding: loop1[i] -> loop2[i] -> loop2[next] -> loop1[next]
      // This creates outward-facing normals when both loops wind counter-clockwise
      // and loop1 is above loop2
      this.mesh.addFace(new Face([
        loop1.indices[i],
        loop2.indices[i],
        loop2.indices[next],
        loop1.indices[next]
      ], color));
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
  capLoop(name: string, loopName: string, reverse: boolean = false, color?: { r: number; g: number; b: number }): this {
    const loop = this.loops.get(loopName);
    if (!loop) throw new Error(`Loop '${loopName}' not found for cap '${name}'`);

    const indices = reverse ? [...loop.indices].reverse() : loop.indices;
    this.mesh.addFace(new Face(indices, color));

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

      const newIndex = this.mesh.addVertex(new Vertex(pos));
      vertexMap.set(i, newIndex);

      // Register vertex with prefixed name
      this.vertices.set(`${instanceName}_v${i}`, newIndex);
    }

    // Add all faces with remapped indices
    for (const face of subOutput.mesh.faces) {
      const newIndices = face.indices.map(idx => vertexMap.get(idx)!);
      this.mesh.addFace(new Face(newIndices));
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
  mergeMesh(name: string, externalMesh: Mesh, color?: { r: number; g: number; b: number }): void {
    // Track vertex index mapping
    const vertexMap = new Map<number, number>();

    // Add all vertices from external mesh
    for (let i = 0; i < externalMesh.vertices.length; i++) {
      const v = externalMesh.vertices[i];
      const newIndex = this.mesh.addVertex(new Vertex(v.position.clone()));
      vertexMap.set(i, newIndex);
    }

    // Add all faces with remapped indices and optional color
    for (const face of externalMesh.faces) {
      const newIndices = face.indices.map(idx => vertexMap.get(idx)!);
      this.mesh.addFace(new Face(newIndices, color));
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

