/**
 * YamlBuilderParser - Parse YAML builder definitions and execute them
 *
 * Converts declarative YAML to TracedBuilder method calls.
 */

import { TracedBuilder, TracedOutput, ExpressionContext } from './TracedBuilder';
import { Vec3 } from '../core/Vec3';
import { Random } from '../core/Random';
import { evaluate as mathEvaluate } from '../core/MathService';
import { lathe as latheGeometry, sweep as sweepGeometry, Profile, Profiles } from '../geometry/Sweep';
import { Spline } from '../core/Spline';
import { subdivideCatmullClark } from '../geometry/Subdivision';
import { placeAroundRectangle, placeAroundCircle } from './Placement';
import { poissonDiskSample, ScatterBounds } from '../core/Scatter';
import { SharedContext } from './SharedContext';
import { SceneGraph } from './SceneGraph';
import { Shape2D } from '../geometry/Shape2D';
import { extrude2D } from '../geometry/Extrude';
import { Mesh } from '../geometry/Mesh';
import { Vertex } from '../geometry/Vertex';
import { Face } from '../geometry/Face';
import * as MeshTransform from '../geometry/MeshTransform';
import {
  EvaluationContext,
  createContext,
  evaluateNumeric as exprEvalNumeric,
  evaluateCondition as exprEvalCondition,
  evaluatePosition as exprEvalPosition
} from './ExpressionService';
// ============================================================================
// PARSING CONTEXT (for better error messages)
// ============================================================================

/**
 * Tracks current location in YAML for better error messages
 */
class ParsingContext {
  private stack: string[] = [];

  push(path: string): void {
    this.stack.push(path);
  }

  pop(): void {
    this.stack.pop();
  }

  getPath(): string {
    return this.stack.join('.');
  }

  /**
   * Wrap an error with the current YAML path
   */
  wrapError(error: Error): Error {
    const path = this.getPath();
    if (path) {
      return new Error(`Error at ${path}: ${error.message}`);
    }
    return error;
  }

  /**
   * Execute a function within a context
   */
  within<T>(path: string, fn: () => T): T {
    this.push(path);
    try {
      return fn();
    } catch (err: any) {
      throw this.wrapError(err);
    } finally {
      this.pop();
    }
  }
}

// ============================================================================
// YAML SCHEMA TYPES
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

/**
 * 2D Shape definition for extrusion (P2-M3)
 * Points are in XZ plane (Y=0)
 */
export interface YamlShape {
  type: 'rect' | 'circle' | 'ellipse' | 'polygon' | 'text';
  // For rect
  width?: string | number;
  height?: string | number;
  // For circle
  radius?: string | number;
  segments?: number | string;
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
  // Center position (optional, default 0,0)
  center?: { x?: string | number; z?: string | number };
}

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

/**
 * Position expression
 */
export interface YamlPosition {
  x: string | number;
  y: string | number;
  z: string | number;
}

/**
 * RGB color definition (0-1 range or hex string)
 */
export interface YamlColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Geometry commands
 */
export type YamlGeometryCommand =
  | { comment: string }
  | { vertex: string; position: YamlPosition; tags?: string[] }
  | { circle: string; center: YamlPosition; radius: string | number; segments: number | string; purpose: string; normal: number[]; tags?: string[] }
  | { loop: string; type: string; vertices: string[]; purpose: string; tags?: string[] }
  | { face: string; vertices?: string[]; loop?: string; flip?: boolean; color?: YamlColor; tags?: string[] }
  | { loft: string; from: string; to: string; color?: YamlColor; tags?: string[] }
  | { cap: string; loop: string; flip?: boolean; color?: YamlColor; tags?: string[] }
  | { when: string; geometry: YamlGeometryCommand[] }
  // Control flow constructs
  | { repeat: number | string; as: string; geometry: YamlGeometryCommand[] }
  | { if: string; then: YamlGeometryCommand[]; else?: YamlGeometryCommand[] }
  // Advanced geometry commands (P2-M1b)
  | { lathe: string; profile: string; segments?: number | string; angle?: number | string; axis?: 'y' | 'x' | 'z'; color?: YamlColor | string }
  | { sweep: string; profile: string; path: string; segments?: number | string; twist?: number | string; scaleStart?: number | string; scaleEnd?: number | string; color?: YamlColor | string }
  | { subdivide: string; mesh?: string; iterations?: number }
  // 2D Extrusion (P2-M3)
  | { extrude2d: string; shape: string; depth: number | string; caps?: 'none' | 'front' | 'back' | 'both'; offset?: number | string; bevel?: { size: number | string; segments: number | string }; color?: YamlColor | string }
  // Radial Array (P2M3-004)
  | { radialArray: string; count: number | string; radius?: number | string; center?: YamlPosition; axis?: 'x' | 'y' | 'z'; geometry: YamlGeometryCommand[] };

/**
 * Composition definition
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
// PARSER
// ============================================================================

export interface ParseOptions {
  seed?: number;
  overrides?: Record<string, any>;
  builderResolver?: (name: string) => ((seed: number, overrides?: Record<string, any>) => TracedOutput | Promise<TracedOutput>) | null;
  sharedContext?: SharedContext;  // Scene-level shared state (P2-M2d-003)
}

/**
 * Parse and execute a YAML builder definition
 */
export async function parseAndExecuteBuilder(
  yaml: YamlBuilderDefinition,
  options?: ParseOptions
): Promise<TracedOutput> {
  const seed = options?.seed;
  const overrides = options?.overrides ?? {};

  const builder = new TracedBuilder(yaml.name, seed, overrides);

  // Create parsing context for better error messages
  const ctx = new ParsingContext();

  // Track decision values for conditional logic
  const decisionValues = new Map<string, any>();

  // ==========================================================================
  // PHASE 0: Initialize Shared Context (P2-M2d-003)
  // ==========================================================================

  // Create or use provided shared context
  let sharedContext = options?.sharedContext;
  if (!sharedContext && yaml.shared_context) {
    sharedContext = new SharedContext(yaml.shared_context);
  }

  // Initialize scene graph (P2-M2d-005)
  const sceneGraph = new SceneGraph();

  // ==========================================================================
  // PHASE 1: Process Decisions
  // ==========================================================================

  if (yaml.decisions) {
    for (const [name, decision] of Object.entries(yaml.decisions)) {
      try {
        ctx.push(`decisions.${name}`);

        let value: any;

        // Check condition for count decisions
        if (decision.type === 'count' && decision.condition) {
          if (!evaluateCondition(decision.condition, decisionValues)) {
            continue; // Skip this decision
          }
        }

        switch (decision.type) {
          case 'choice':
            value = builder.decide(
              name,
              decision.options,
              decision.weights ?? decision.options.map(() => 1)
            );
            break;

          case 'number':
            // Validate constraints
            if (decision.min > decision.max) {
              throw new Error(`min (${decision.min}) must be <= max (${decision.max})`);
            }
            value = builder.decideNumber(name, decision.min, decision.max, decision.default);
            break;

          case 'boolean':
            value = builder.decideBoolean(name, decision.probability);
            break;

          case 'count':
            // Validate constraints
            if (decision.min > decision.max) {
              throw new Error(`min (${decision.min}) must be <= max (${decision.max})`);
            }
            value = builder.decideCount(name, decision.min, decision.max);
            break;
        }

        decisionValues.set(name, value);
      } catch (err: any) {
        throw ctx.wrapError(err);
      } finally {
        ctx.pop();
      }
    }
  }

  // ==========================================================================
  // PHASE 2: Process Measurements
  // ==========================================================================

  if (yaml.measurements) {
    for (const [name, measurement] of Object.entries(yaml.measurements)) {
      try {
        ctx.push(`measurements.${name}`);

        let value: number;

        // Check if this measurement has an override (P2-M2d-002 fix)
        if (overrides[name] !== undefined && typeof overrides[name] === 'number') {
          value = overrides[name];
        } else if (measurement.value !== undefined) {
          // Fixed or expression value
          value = typeof measurement.value === 'number'
            ? measurement.value
            : evaluateExpression(measurement.value, decisionValues, builder);
        } else if (measurement.base !== undefined) {
          // Base + variation
          value = measurement.base;
          if (measurement.variation) {
            const variation = decisionValues.get(measurement.variation) ?? 0;
            value += variation;
          }
        } else {
          throw new Error(`Measurement '${name}' has no value or base`);
        }

        // Apply conditionals (only if not overridden)
        if (!overrides[name] && measurement.conditional) {
          for (const cond of measurement.conditional) {
            if (evaluateCondition(cond.if, decisionValues)) {
              value = typeof cond.value === 'number'
                ? cond.value
                : evaluateExpression(cond.value, decisionValues, builder);
              break;
            }
          }
        }

        builder.defineMeasurement(name, value, {
          source: measurement.source
        });
      } catch (err: any) {
        throw ctx.wrapError(err);
      } finally {
        ctx.pop();
      }
    }
  }

  // ==========================================================================
  // PHASE 2.5: Process Materials (after decisions, before geometry)
  // ==========================================================================

  // Resolve materials based on decision values - this handles conditional colors
  const materials = resolveMaterials(yaml.materials, decisionValues);

  // ==========================================================================
  // PHASE 2.6: Store Profiles and Splines (P2-M1b)
  // ==========================================================================

  // Store profiles on builder for geometry commands to reference
  if (yaml.profiles) {
    (builder as any)._yamlProfiles = new Map(Object.entries(yaml.profiles));
  } else {
    (builder as any)._yamlProfiles = new Map();
  }

  // Store splines on builder for geometry commands to reference
  if (yaml.splines) {
    (builder as any)._yamlSplines = new Map(Object.entries(yaml.splines));
  } else {
    (builder as any)._yamlSplines = new Map();
  }

  // Store shapes on builder for geometry commands to reference (P2-M3)
  if (yaml.shapes) {
    (builder as any)._yamlShapes = new Map(Object.entries(yaml.shapes));
  } else {
    (builder as any)._yamlShapes = new Map();
  }

  // ==========================================================================
  // PHASE 3: Process Derived Values
  // ==========================================================================

  if (yaml.derived) {
    for (const [name, expression] of Object.entries(yaml.derived)) {
      try {
        ctx.push(`derived.${name}`);

        // Evaluate expression with access to decision values, measurements, and previous derived values
        const value = evaluateExpression(expression, decisionValues, builder);

        // Store in builder context (for use in subsequent expressions)
        builder.context.setDerived(name, value);

        // ALSO add to measurements Map so it's accessible via builder.measurements command
        builder.measurements.set(name, { value, source: `derived: ${expression}` });

        // Add trace
        builder.traces.set(`derived:${name}`, {
          type: 'measurement',
          name,
          source: { expression: `${name} = ${expression}`, builderName: yaml.name },
          details: {
            expression,
            value,
            dependencies: [] // TODO: track dependencies if needed
          }
        });
      } catch (err: any) {
        throw ctx.wrapError(err);
      } finally {
        ctx.pop();
      }
    }
  }

  // ==========================================================================
  // PHASE 4: Process Geometry
  // ==========================================================================

  if (yaml.geometry) {
    try {
      ctx.push('geometry');
      await processGeometry(yaml.geometry, builder, decisionValues, materials, ctx);
    } catch (err: any) {
      throw ctx.wrapError(err);
    } finally {
      ctx.pop();
    }
  }

  // ==========================================================================
  // PHASE 5: Process Compositions
  // ==========================================================================

  if (yaml.compose && options?.builderResolver) {
    for (const [instanceName, composition] of Object.entries(yaml.compose)) {
      try {
        ctx.push(`compose.${instanceName}`);

        // Check conditional - skip if condition is false
        if (composition.if !== undefined) {
          const shouldInclude = evaluateCompositionCondition(composition.if, decisionValues, builder);
          if (!shouldInclude) {
            continue; // Skip this composition
          }
        }

        // Handle repeat - compose multiple instances
        if (composition.repeat) {
          const repeatCount = typeof composition.repeat.count === 'number'
            ? composition.repeat.count
            : evaluateExpression(String(composition.repeat.count), decisionValues, builder);
          const indexVar = composition.repeat.as;

          for (let i = 0; i < repeatCount; i++) {
            // Set index in context for expression evaluation
            const originalValue = builder.context.get(indexVar);
            builder.context.setMeasurement(indexVar, i);
            decisionValues.set(indexVar, i);

            // Generate unique instance name
            const iterInstanceName = `${instanceName}_${i}`;

          // Compose this instance
          await composeInstance(iterInstanceName, composition, builder, decisionValues, options);

          // Restore context
          if (originalValue !== undefined) {
            builder.context.setMeasurement(indexVar, originalValue);
          }
          decisionValues.delete(indexVar);
        }
      } else {
        // Single composition (no repeat)
        await composeInstance(instanceName, composition, builder, decisionValues, options);
      }
      } catch (err: any) {
        throw ctx.wrapError(err);
      } finally {
        ctx.pop();
      }
    }
  }

  // Helper function to compose a single instance
  async function composeInstance(
    instanceName: string,
    composition: YamlComposition,
    builder: TracedBuilder,
    decisionValues: Map<string, any>,
    options: ParseOptions
  ): Promise<void> {
    const subBuilderFn = options.builderResolver!(composition.builder);
    if (!subBuilderFn) {
      throw new Error(`Composed builder not found: ${composition.builder}`);
    }

    // Resolve overrides (replace $references with parent values)
    const resolvedOverrides: Record<string, any> = {};
    if (composition.overrides) {
      for (const [key, value] of Object.entries(composition.overrides)) {
        if (typeof value === 'string' && value.startsWith('$')) {
          const parentKey = value.slice(1);
          // First check decisions, then try evaluating as expression (for measurements/derived)
          if (decisionValues.has(parentKey)) {
            resolvedOverrides[key] = decisionValues.get(parentKey);
          } else {
            // Try to evaluate as expression (for measurements and derived values)
            try {
              const evaluated = builder.context.evaluate(parentKey);
              resolvedOverrides[key] = evaluated.value;
            } catch {
              // If evaluation fails, pass through as-is
              resolvedOverrides[key] = value;
            }
          }
        } else {
          resolvedOverrides[key] = value;
        }
      }
    }

    // Forward prefixed decision overrides to child (P2-M2d-002 fix)
    // If parent has overrides like "chair.constrained", forward as "constrained" to chair
    if (options.overrides) {
      const prefix = `${instanceName}.`;
      for (const [key, value] of Object.entries(options.overrides)) {
        if (key.startsWith(prefix)) {
          const childKey = key.slice(prefix.length);
          resolvedOverrides[childKey] = value;
        }
      }
    }

    // Resolve constraints (replace $references with parent values) (P2-M2d-002)
    let resolvedConstraints: Record<string, any> | undefined;
    if (composition.constraints) {
      resolvedConstraints = {};
      for (const [key, value] of Object.entries(composition.constraints)) {
        if (typeof value === 'string' && value.startsWith('$')) {
          const parentKey = value.slice(1);
          // First check decisions, then try evaluating as expression (for measurements/derived)
          if (decisionValues.has(parentKey)) {
            resolvedConstraints[key] = decisionValues.get(parentKey);
          } else {
            // Try to evaluate as expression (for measurements and derived values)
            try {
              const evaluated = builder.context.evaluate(parentKey);
              resolvedConstraints[key] = evaluated.value;
            } catch {
              // If evaluation fails, pass through as-is
              resolvedConstraints[key] = value;
            }
          }
        } else {
          resolvedConstraints[key] = value;
        }
      }
    }

    // Evaluate offset expressions
    let offset: { x: number; y: number; z: number } | undefined;
    if (composition.offset) {
      offset = {
        x: evaluatePositionComponent(composition.offset.x, builder),
        y: evaluatePositionComponent(composition.offset.y, builder),
        z: evaluatePositionComponent(composition.offset.z, builder)
      };
    }

    let rotation: { x: number; y: number; z: number } | undefined;
    if (composition.rotation) {
      rotation = {
        x: evaluatePositionComponent(composition.rotation.x, builder),
        y: evaluatePositionComponent(composition.rotation.y, builder),
        z: evaluatePositionComponent(composition.rotation.z, builder)
      };
    }

    // Read from shared context (P2-M2d-003)
    if (composition.read_context && sharedContext) {
      const contextData = sharedContext.getMultiple(composition.read_context);
      // Inject context data as overrides (flattened)
      for (const [key, value] of Object.entries(contextData)) {
        // If value is an object, flatten it with dot notation
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          for (const [subKey, subValue] of Object.entries(value)) {
            resolvedOverrides[`${key}_${subKey}`] = subValue;
          }
        } else {
          resolvedOverrides[key] = value;
        }
      }
    }

    // Run sub-builder
    await builder.compose(instanceName, subBuilderFn, {
      offset,
      rotation,
      scale: composition.scale,
      overrides: resolvedOverrides,
      constraints: resolvedConstraints,  // Pass resolved constraints (P2-M2d-002)
      asInstance: composition.asInstance
    });

    // Write to shared context (P2-M2d-003)
    if (composition.write_context && sharedContext) {
      const subBuilder = builder.getSubBuilder(instanceName);
      if (subBuilder) {
        for (const [contextKey, expression] of Object.entries(composition.write_context)) {
          // Resolve expression from child builder's context
          if (expression.startsWith('$')) {
            const measurementKey = expression.slice(1);
            const measurement = subBuilder.measurements.get(measurementKey);
            if (measurement) {
              sharedContext.set(contextKey, measurement.value);
            }
          } else {
            // Evaluate expression in child's context
            try {
              const childContext = new ExpressionContext();
              for (const [name, meas] of subBuilder.measurements.entries()) {
                childContext.setMeasurement(name, meas.value);
              }
              const evaluated = childContext.evaluate(expression);
              sharedContext.set(contextKey, evaluated.value);
            } catch (err) {
              console.warn(`Failed to evaluate write_context expression '${expression}': ${err}`);
            }
          }
        }
      }
    }
  }

  // ==========================================================================
  // PHASE 6: Constraint-Based Placement (P2-M2)
  // ==========================================================================

  if (yaml.placement && options?.builderResolver) {
    // Handle both single placement and array of placements
    const placements = Array.isArray(yaml.placement) ? yaml.placement : [yaml.placement];

    for (const placement of placements) {
      const subBuilderFn = options.builderResolver(placement.builder);

      if (!subBuilderFn) {
        throw new Error(`Placement builder not found: ${placement.builder}`);
      }

      // Resolve placement parameters using evaluateExpression (has access to decisionValues)
      const count = typeof placement.count === 'string'
        ? evaluateExpression(placement.count, decisionValues, builder)
        : placement.count;

      const minDistance = typeof placement.minDistance === 'string'
        ? evaluateExpression(placement.minDistance, decisionValues, builder)
        : (placement.minDistance ?? 0.1);

      const instancePrefix = placement.instancePrefix ?? 'placed';

      // Resolve overrides once (all placed objects get same overrides)
      const resolvedOverrides: Record<string, any> = {};
      if (placement.overrides) {
        for (const [key, value] of Object.entries(placement.overrides)) {
          if (typeof value === 'string' && value.startsWith('$')) {
            const parentKey = value.slice(1);
            if (decisionValues.has(parentKey)) {
              resolvedOverrides[key] = decisionValues.get(parentKey);
            } else {
              try {
                const evaluated = builder.context.evaluate(parentKey);
                resolvedOverrides[key] = evaluated.value;
              } catch {
                resolvedOverrides[key] = value;
              }
            }
          } else {
            resolvedOverrides[key] = value;
          }
        }
      }

      // Build one instance to get the AABB (for collision detection)
      const sampleOutput = await subBuilderFn(seed ?? 1, resolvedOverrides);
      if (!sampleOutput || !sampleOutput.mesh) {
        throw new Error(`Placement builder ${placement.builder} returned invalid output`);
      }
      const objectAABB = sampleOutput.mesh.getAABB();


      let placementResult: any;

      if (placement.mode === 'around_rectangle') {
      const width = typeof placement.width === 'string'
        ? evaluateExpression(placement.width, decisionValues, builder)
        : (placement.width ?? 1);
      const depth = typeof placement.depth === 'string'
        ? evaluateExpression(placement.depth, decisionValues, builder)
        : (placement.depth ?? 1);

      const center = placement.center ? new Vec3(
        evaluatePositionComponent(placement.center.x, builder),
        evaluatePositionComponent(placement.center.y, builder),
        evaluatePositionComponent(placement.center.z, builder)
      ) : new Vec3(0, 0, 0);

      placementResult = placeAroundRectangle(
        center,
        width,
        depth,
        objectAABB,
        count,
        {
          minDistance,
          maxAttempts: 10,
          allowReducedCount: placement.allowReducedCount ?? true,
          seed: seed ?? 1
        }
      );
    } else if (placement.mode === 'around_circle') {
      const radius = typeof placement.radius === 'string'
        ? evaluateExpression(placement.radius, decisionValues, builder)
        : (placement.radius ?? 1);

      const center = placement.center ? new Vec3(
        evaluatePositionComponent(placement.center.x, builder),
        evaluatePositionComponent(placement.center.y, builder),
        evaluatePositionComponent(placement.center.z, builder)
      ) : new Vec3(0, 0, 0);

      placementResult = placeAroundCircle(
        center,
        radius,
        objectAABB,
        count,
        {
          minDistance,
          maxAttempts: 10,
          allowReducedCount: placement.allowReducedCount ?? true,
          seed: seed ?? 1
        }
      );
    } else if (placement.mode === 'scatter_poisson') {
      const width = typeof placement.width === 'string'
        ? evaluateExpression(placement.width, decisionValues, builder)
        : (placement.width ?? 1);
      const depth = typeof placement.depth === 'string'
        ? evaluateExpression(placement.depth, decisionValues, builder)
        : (placement.depth ?? 1);

      const center = placement.center ? new Vec3(
        evaluatePositionComponent(placement.center.x, builder),
        evaluatePositionComponent(placement.center.y, builder),
        evaluatePositionComponent(placement.center.z, builder)
      ) : new Vec3(0, 0, 0);

      // Define scatter bounds
      const bounds: ScatterBounds = {
        minX: center.x - width / 2,
        maxX: center.x + width / 2,
        minZ: center.z - depth / 2,
        maxZ: center.z + depth / 2
      };

      // Use Poisson disk sampling to generate scatter points
      const scatterPoints = poissonDiskSample(bounds, {
        seed: seed ?? 1,
        minDistance
      });

      // Create deterministic random for rotations (using different seed offset)
      const rotationRandom = new Random((seed ?? 1) + 12345);

      // Convert scatter points to placement results
      placementResult = {
        placements: scatterPoints.slice(0, count).map(point => ({
          position: new Vec3(point.x, center.y, point.z),
          rotation: { x: 0, y: rotationRandom.next() * Math.PI * 2, z: 0 }, // Deterministic random Y rotation
          scale: 1,
          aabb: objectAABB.translated(new Vec3(point.x, center.y, point.z))
        })),
        rejected: Math.max(0, count - scatterPoints.length)
      };
      }

      // Compose each placed object
      if (placementResult && placementResult.placements) {
        for (let i = 0; i < placementResult.placements.length; i++) {
          const p = placementResult.placements[i];
          const instanceName = `${instancePrefix}_${i + 1}`;

          await builder.compose(instanceName, subBuilderFn, {
            offset: { x: p.position.x, y: p.position.y, z: p.position.z },
            rotation: { x: 0, y: p.rotation.y, z: 0 },  // Use p.rotation.y instead of p.rotation
            overrides: resolvedOverrides,
            asInstance: placement.asInstance
          });
        }

        // TODO: Add placement trace for debugging once TracedBuilder supports custom trace types
        // For now, placement info is visible via the composed instances (chair_1, chair_2, etc.)
      }
    } // End of placements loop
  }

  // Build output
  const output = builder.build();

  // Attach scene graph (P2-M2d-005)
  output.sceneGraph = sceneGraph;

  return output;
}

// ============================================================================
// MATERIAL RESOLUTION
// ============================================================================

import { NAMED_COLORS, hexToRgb, RGBColor } from './MaterialLibrary';

/**
 * Resolve a color value to RGB using the MaterialLibrary
 */
function resolveColor(color: YamlColorValue): RGBColor {
  if (typeof color === 'object') {
    return color;
  }

  // Hex string: "#8b5a2b"
  if (color.startsWith('#')) {
    return hexToRgb(color);
  }

  // Named color from library
  return NAMED_COLORS[color] || NAMED_COLORS.wood_oak;
}

/**
 * Check if a value is a conditional value (has 'default' and optionally 'when')
 */
function isConditionalValue<T>(value: any): value is YamlConditionalValue<T> {
  return value !== null &&
         typeof value === 'object' &&
         'default' in value &&
         !('r' in value);  // Not an RGB color object
}

/**
 * Resolve a conditional material property based on decision values
 */
function resolveConditionalValue<T>(
  value: YamlMaterialValue<T>,
  decisionValues: Map<string, any>
): T {
  // Static value - return as-is
  if (!isConditionalValue<T>(value)) {
    return value;
  }

  // Conditional value - check 'when' clauses
  if (value.when) {
    for (const clause of value.when) {
      if (evaluateCondition(clause.if, decisionValues)) {
        return clause.value;
      }
    }
  }

  // No condition matched - return default
  return value.default;
}

/**
 * Resolve all materials based on decision values
 * Returns a map of material name -> resolved RGB color
 */
function resolveMaterials(
  yamlMaterials: Record<string, YamlMaterial> | undefined,
  decisionValues: Map<string, any>
): Map<string, RGBColor> {
  const resolved = new Map<string, RGBColor>();

  if (!yamlMaterials) return resolved;

  for (const [name, material] of Object.entries(yamlMaterials)) {
    // Resolve the color (may be conditional)
    const colorValue = resolveConditionalValue(material.color, decisionValues);
    const color = resolveColor(colorValue);
    resolved.set(name, color);
  }

  return resolved;
}

// ============================================================================
// PROFILE & SPLINE RESOLUTION (P2-M1b)
// ============================================================================

/**
 * Resolve a profile definition to a Profile object
 */
function resolveProfile(
  profileDef: YamlProfile,
  builder: TracedBuilder
): Profile {
  const evalNum = (v: string | number): number => {
    if (typeof v === 'number') return v;
    return evaluatePositionComponent(v, builder);
  };

  switch (profileDef.type) {
    case 'circle': {
      const radius = evalNum(profileDef.radius ?? 0.1);
      const segments = profileDef.segments ?? 8;
      return Profiles.circle(radius, segments);
    }

    case 'ellipse': {
      const rx = evalNum(profileDef.radiusX ?? 0.1);
      const ry = evalNum(profileDef.radiusY ?? 0.1);
      const segments = profileDef.segments ?? 8;
      return Profiles.ellipse(rx, ry, segments);
    }

    case 'rect': {
      const w = evalNum(profileDef.width ?? 0.1);
      const h = evalNum(profileDef.height ?? 0.1);
      return Profiles.rectangle(w, h);
    }

    case 'polygon':
    case 'spline': {
      if (!profileDef.points || profileDef.points.length < 2) {
        throw new Error('Polygon/spline profile requires at least 2 points');
      }
      const points = profileDef.points.map(p => ({
        x: evalNum(p.x),
        y: evalNum(p.y)
      }));
      return {
        points,
        closed: profileDef.closed ?? true
      };
    }

    default:
      throw new Error(`Unknown profile type: ${profileDef.type}`);
  }
}

/**
 * Resolve a spline definition to a Spline object
 */
function resolveSpline(
  splineDef: YamlSpline,
  builder: TracedBuilder
): Spline {
  const evalNum = (v: string | number): number => {
    if (typeof v === 'number') return v;
    return evaluatePositionComponent(v, builder);
  };

  const points = splineDef.points.map(p => new Vec3(
    evalNum(p.x),
    evalNum(p.y),
    evalNum(p.z)
  ));

  const tension = splineDef.tension ?? 0.5;

  // Use the unified Spline factory method
  return Spline.catmullRom(points, tension);
}

/**
 * Resolve a color reference in geometry commands
 * Handles: direct color object, $material_name reference, or named color string
 */
function resolveGeometryColor(
  colorDef: YamlColor | string | undefined,
  materials: Map<string, RGBColor>
): RGBColor | undefined {
  if (!colorDef) return undefined;

  // Direct RGB object
  if (typeof colorDef === 'object') {
    return colorDef;
  }

  // Material reference: $wood_dark
  if (colorDef.startsWith('$')) {
    const materialName = colorDef.slice(1);
    return materials.get(materialName);
  }

  // Named color or hex string
  return resolveColor(colorDef);
}

async function processGeometry(
  commands: YamlGeometryCommand[],
  builder: TracedBuilder,
  decisionValues: Map<string, any>,
  materials: Map<string, { r: number; g: number; b: number }> = new Map(),
  ctx: ParsingContext = new ParsingContext()
): Promise<void> {
  for (let cmdIndex = 0; cmdIndex < commands.length; cmdIndex++) {
    const cmd = commands[cmdIndex];

    try {
      // Comment - skip
      if ('comment' in cmd) {
        continue;
      }

      // Conditional geometry (legacy 'when' syntax)
      if ('when' in cmd) {
        const evalCtx = createContext(builder, decisionValues);
        if (exprEvalCondition(cmd.when, evalCtx)) {
          processGeometry(cmd.geometry, builder, decisionValues, materials, ctx);
        }
        continue;
      }

      // If/else block - mutually exclusive geometry
      if ('if' in cmd) {
        const ifCmd = cmd as { if: string; then: YamlGeometryCommand[]; else?: YamlGeometryCommand[] };
        const evalCtx = createContext(builder, decisionValues);
        if (exprEvalCondition(ifCmd.if, evalCtx)) {
          processGeometry(ifCmd.then, builder, decisionValues, materials, ctx);
        } else if (ifCmd.else) {
          processGeometry(ifCmd.else, builder, decisionValues, materials, ctx);
        }
        continue;
      }

      // Repeat block - iterate geometry N times with index variable
      if ('repeat' in cmd) {
        const repeatCmd = cmd as { repeat: number | string; as: string; geometry: YamlGeometryCommand[] };

        // Get repeat count (can be number or expression/variable reference)
        let count: number;
        if (typeof repeatCmd.repeat === 'number') {
          count = repeatCmd.repeat;
        } else {
          // Evaluate as expression (could be a decision value like "leg_count")
          if (decisionValues.has(repeatCmd.repeat)) {
            count = decisionValues.get(repeatCmd.repeat);
          } else {
            const vars = builder.context.toObject();
            const result = mathEvaluate(repeatCmd.repeat, vars);
            count = Math.round(result.value);
          }
        }

        const indexVar = repeatCmd.as;

        // Execute geometry for each iteration
        for (let i = 0; i < count; i++) {
          // Add index to context temporarily
          const originalValue = builder.context.get(indexVar);
          builder.context.setMeasurement(indexVar, i);

          // Also add to decisionValues for condition evaluation
          const originalDecision = decisionValues.get(indexVar);
          decisionValues.set(indexVar, i);

          // Process geometry with index available
          processGeometry(repeatCmd.geometry, builder, decisionValues, materials, ctx);

          // Restore original values
          if (originalValue !== undefined) {
            builder.context.setMeasurement(indexVar, originalValue);
          }
          if (originalDecision !== undefined) {
            decisionValues.set(indexVar, originalDecision);
          } else {
            decisionValues.delete(indexVar);
          }
        }
        continue;
      }

      // Radial Array - duplicate geometry around a center point (P2M3-004)
      if ('radialArray' in cmd) {
        const arrayCmd = cmd as {
          radialArray: string;
          count: number | string;
          radius?: number | string;
          center?: YamlPosition;
          axis?: 'x' | 'y' | 'z';
          geometry: YamlGeometryCommand[];
        };

        // Get count
        let count: number;
        if (typeof arrayCmd.count === 'number') {
          count = arrayCmd.count;
        } else {
          if (decisionValues.has(arrayCmd.count)) {
            count = decisionValues.get(arrayCmd.count);
          } else {
            const vars = builder.context.toObject();
            const result = mathEvaluate(arrayCmd.count, vars);
            count = Math.round(result.value);
          }
        }

        // Get radius (default 0 = no offset, just rotation)
        let radius = 0;
        if (arrayCmd.radius !== undefined) {
          if (typeof arrayCmd.radius === 'number') {
            radius = arrayCmd.radius;
          } else {
            const evalCtx = createContext(builder, decisionValues);
            radius = exprEvalNumeric(arrayCmd.radius, evalCtx);
          }
        }

        // Get center (default 0,0,0)
        const evalCtx = createContext(builder, decisionValues);
        const centerX = arrayCmd.center?.x !== undefined
          ? (typeof arrayCmd.center.x === 'number' ? arrayCmd.center.x : exprEvalNumeric(String(arrayCmd.center.x), evalCtx))
          : 0;
        const centerY = arrayCmd.center?.y !== undefined
          ? (typeof arrayCmd.center.y === 'number' ? arrayCmd.center.y : exprEvalNumeric(String(arrayCmd.center.y), evalCtx))
          : 0;
        const centerZ = arrayCmd.center?.z !== undefined
          ? (typeof arrayCmd.center.z === 'number' ? arrayCmd.center.z : exprEvalNumeric(String(arrayCmd.center.z), evalCtx))
          : 0;

        // Get axis (default 'y')
        const axis = arrayCmd.axis || 'y';

        // Store current mesh state
        const baseMesh = builder.getMesh().clone();

        // Execute geometry for each radial position
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2; // Radians

          // Calculate offset based on axis and radius
          let offsetX = 0, offsetY = 0, offsetZ = 0;
          if (axis === 'y') {
            // Rotate around Y axis (XZ plane)
            offsetX = Math.cos(angle) * radius;
            offsetZ = Math.sin(angle) * radius;
          } else if (axis === 'x') {
            // Rotate around X axis (YZ plane)
            offsetY = Math.cos(angle) * radius;
            offsetZ = Math.sin(angle) * radius;
          } else if (axis === 'z') {
            // Rotate around Z axis (XY plane)
            offsetX = Math.cos(angle) * radius;
            offsetY = Math.sin(angle) * radius;
          }

          // Add index to context
          builder.context.setMeasurement('__radial_index', i);
          builder.context.setMeasurement('__radial_angle', angle);
          builder.context.setMeasurement('__radial_angle_deg', angle * 180 / Math.PI);
          decisionValues.set('__radial_index', i);

          // Clear current mesh to build from scratch
          builder.replaceMesh(new Mesh());

          // Process geometry
          processGeometry(arrayCmd.geometry, builder, decisionValues, materials, ctx);

          // Get the generated mesh
          const instanceMesh = builder.getMesh();

          // First rotate around the axis
          let axisVector: Vec3;
          if (axis === 'y') {
            axisVector = new Vec3(0, 1, 0);
          } else if (axis === 'x') {
            axisVector = new Vec3(1, 0, 0);
          } else {
            axisVector = new Vec3(0, 0, 1);
          }

          const rotated = MeshTransform.rotate(instanceMesh, axisVector, angle);

          // Then translate to position
          const transformed = MeshTransform.translate(
            rotated,
            new Vec3(centerX + offsetX, centerY + offsetY, centerZ + offsetZ)
          );

          // Merge with base
          baseMesh.merge(transformed);
        }

        // Restore the accumulated mesh
        builder.replaceMesh(baseMesh);

        continue;
      }

      // Vertex
      if ('vertex' in cmd) {
        // Interpolate name for repeat blocks: vertex_${i} -> vertex_0
        const vertexName = interpolateName(cmd.vertex, builder.context.toObject());
        builder.placeVertex(vertexName, {
          x: String(cmd.position.x),
          y: String(cmd.position.y),
          z: String(cmd.position.z)
        });
        continue;
      }

      // Box - creates a complete box with 8 vertices and 6 faces
      if ('box' in cmd) {
        const boxCmd = cmd as {
          box: { name: string; center: YamlPosition; size: YamlPosition; color?: string };
        };
        const boxDef = boxCmd.box;
        const name = boxDef.name;

        // Evaluate center and size
        const cx = evaluateExpression(String(boxDef.center.x), decisionValues, builder);
        const cy = evaluateExpression(String(boxDef.center.y), decisionValues, builder);
        const cz = evaluateExpression(String(boxDef.center.z), decisionValues, builder);
        const sx = evaluateExpression(String(boxDef.size.x), decisionValues, builder) / 2;
        const sy = evaluateExpression(String(boxDef.size.y), decisionValues, builder) / 2;
        const sz = evaluateExpression(String(boxDef.size.z), decisionValues, builder) / 2;

        // Get color if specified
        const color = boxDef.color ? resolveGeometryColor(boxDef.color, materials) : undefined;

        // Create 8 vertices
        const v = [
          `${name}_v0`, `${name}_v1`, `${name}_v2`, `${name}_v3`,
          `${name}_v4`, `${name}_v5`, `${name}_v6`, `${name}_v7`
        ];
        builder.placeVertex(v[0], { x: String(cx - sx), y: String(cy - sy), z: String(cz - sz) });
        builder.placeVertex(v[1], { x: String(cx + sx), y: String(cy - sy), z: String(cz - sz) });
        builder.placeVertex(v[2], { x: String(cx + sx), y: String(cy - sy), z: String(cz + sz) });
        builder.placeVertex(v[3], { x: String(cx - sx), y: String(cy - sy), z: String(cz + sz) });
        builder.placeVertex(v[4], { x: String(cx - sx), y: String(cy + sy), z: String(cz - sz) });
        builder.placeVertex(v[5], { x: String(cx + sx), y: String(cy + sy), z: String(cz - sz) });
        builder.placeVertex(v[6], { x: String(cx + sx), y: String(cy + sy), z: String(cz + sz) });
        builder.placeVertex(v[7], { x: String(cx - sx), y: String(cy + sy), z: String(cz + sz) });

        // Create 6 faces
        builder.createFace(`${name}_bottom`, [v[3], v[2], v[1], v[0]], color);
        builder.createFace(`${name}_top`, [v[4], v[5], v[6], v[7]], color);
        builder.createFace(`${name}_front`, [v[0], v[1], v[5], v[4]], color);
        builder.createFace(`${name}_back`, [v[2], v[3], v[7], v[6]], color);
        builder.createFace(`${name}_left`, [v[3], v[0], v[4], v[7]], color);
        builder.createFace(`${name}_right`, [v[1], v[2], v[6], v[5]], color);

        continue;
      }

    // Circle loop
    if ('circle' in cmd) {
      // Interpolate name for repeat blocks
      const circleName = interpolateName(cmd.circle, builder.context.toObject());
      const radiusExpr = typeof cmd.radius === 'number' ? String(cmd.radius) : cmd.radius;
      const normal = new Vec3(cmd.normal[0], cmd.normal[1], cmd.normal[2]);

      // Segments can be a number or a reference to a measurement
      let segments: number;
      if (typeof cmd.segments === 'number') {
        segments = cmd.segments;
      } else {
        // It's a string reference to a measurement
        const evaluated = builder.context.evaluate(String(cmd.segments));
        segments = Math.round(evaluated.value);
      }

      builder.createCircleLoop(
        circleName,
        {
          x: String(cmd.center.x),
          y: String(cmd.center.y),
          z: String(cmd.center.z)
        },
        radiusExpr,
        segments,
        cmd.purpose as any,
        normal
      );
      continue;
    }

    // Rectangle/custom loop
    if ('loop' in cmd && 'vertices' in cmd && 'type' in cmd) {
      const loopCmd = cmd as { loop: string; type: string; vertices: string[]; purpose: string };
      const contextVars = builder.context.toObject();
      const loopName = interpolateName(loopCmd.loop, contextVars);
      // Interpolate vertex references too
      const vertices = loopCmd.vertices.map(v => interpolateName(v, contextVars));
      if (vertices.length !== 4) {
        console.warn(`Loop '${loopName}' requires exactly 4 vertices, got ${vertices.length}`);
        continue;
      }
      builder.createRectLoop(
        loopName,
        vertices as [string, string, string, string],
        loopCmd.purpose as any
      );
      continue;
    }

    // Face
    if ('face' in cmd) {
      const faceCmd = cmd as { face: string; vertices?: string[]; loop?: string; flip?: boolean; color?: YamlColor | string };
      const contextVars = builder.context.toObject();
      const faceName = interpolateName(faceCmd.face, contextVars);
      const color = resolveGeometryColor(faceCmd.color, materials);

      if (faceCmd.vertices && faceCmd.vertices.length >= 3) {
        // Interpolate vertex references
        const vertices = faceCmd.vertices.map(v => interpolateName(v, contextVars));
        builder.createFace(faceName, vertices, color);
      } else if (faceCmd.loop) {
        // Create face from loop - need to get loop vertices
        // For now, we'll skip this as it requires loop tracking
        console.warn(`Face from loop not yet implemented: ${faceName}`);
      } else if (faceCmd.vertices && faceCmd.vertices.length < 3) {
        throw new Error(`Face '${faceName}' has only ${faceCmd.vertices.length} vertices, needs at least 3`);
      } else {
        throw new Error(`Face '${faceName}' has no vertices array or loop reference`);
      }
      continue;
    }

    // Loft
    if ('loft' in cmd) {
      const loftCmd = cmd as { loft: string; from: string; to: string; color?: YamlColor | string };
      const contextVars = builder.context.toObject();
      const loftName = interpolateName(loftCmd.loft, contextVars);
      const fromLoop = interpolateName(loftCmd.from, contextVars);
      const toLoop = interpolateName(loftCmd.to, contextVars);
      const color = resolveGeometryColor(loftCmd.color, materials);
      builder.loftLoops(loftName, fromLoop, toLoop, color);
      continue;
    }

    // Cap
    if ('cap' in cmd) {
      const capCmd = cmd as { cap: string; loop: string; flip?: boolean; color?: YamlColor | string };
      const contextVars = builder.context.toObject();
      const capName = interpolateName(capCmd.cap, contextVars);
      const loopRef = interpolateName(capCmd.loop, contextVars);
      const color = resolveGeometryColor(capCmd.color, materials);
      builder.capLoop(capName, loopRef, capCmd.flip ?? false, color);
      continue;
    }

    // Lathe (P2-M1b)
    if ('lathe' in cmd) {
      const latheCmd = cmd as {
        lathe: string;
        profile: string;
        segments?: number | string;
        angle?: number | string;
        axis?: 'y' | 'x' | 'z';
        color?: YamlColor | string
      };

      const latheName = latheCmd.lathe;
      const profileDef = (builder as any)._yamlProfiles?.get(latheCmd.profile);
      if (!profileDef) {
        throw new Error(`Profile '${latheCmd.profile}' not found for lathe '${latheName}'`);
      }

      const profile = resolveProfile(profileDef, builder);
      const segments = latheCmd.segments
        ? (typeof latheCmd.segments === 'number' ? latheCmd.segments : Math.round(evaluatePositionComponent(latheCmd.segments, builder)))
        : 16;
      const angle = latheCmd.angle
        ? (typeof latheCmd.angle === 'number' ? latheCmd.angle : evaluatePositionComponent(latheCmd.angle, builder))
        : Math.PI * 2;

      // Generate mesh using lathe function
      const latheMesh = latheGeometry(profile.points, segments, angle);

      // Apply color if specified
      const color = resolveGeometryColor(latheCmd.color, materials);

      // Merge the lathe mesh into builder's mesh
      builder.mergeMesh(latheName, latheMesh, color);
      continue;
    }

    // Sweep (P2-M1b)
    if ('sweep' in cmd) {
      const sweepCmd = cmd as {
        sweep: string;
        profile: string;
        path: string;
        segments?: number | string;
        twist?: number | string;
        scaleStart?: number | string;
        scaleEnd?: number | string;
        color?: YamlColor | string
      };

      const sweepName = sweepCmd.sweep;
      const profileDef = (builder as any)._yamlProfiles?.get(sweepCmd.profile);
      const splineDef = (builder as any)._yamlSplines?.get(sweepCmd.path);

      if (!profileDef) {
        throw new Error(`Profile '${sweepCmd.profile}' not found for sweep '${sweepName}'`);
      }
      if (!splineDef) {
        throw new Error(`Spline '${sweepCmd.path}' not found for sweep '${sweepName}'`);
      }

      const profile = resolveProfile(profileDef, builder);
      const spline = resolveSpline(splineDef, builder);

      const segments = sweepCmd.segments
        ? (typeof sweepCmd.segments === 'number' ? sweepCmd.segments : Math.round(evaluatePositionComponent(sweepCmd.segments, builder)))
        : 16;

      const evalOpt = (v: number | string | undefined): number | undefined => {
        if (v === undefined) return undefined;
        return typeof v === 'number' ? v : evaluatePositionComponent(v, builder);
      };

      const sweepMesh = sweepGeometry(profile, spline, segments, {
        twist: evalOpt(sweepCmd.twist),
        scaleStart: evalOpt(sweepCmd.scaleStart),
        scaleEnd: evalOpt(sweepCmd.scaleEnd)
      });

      const color = resolveGeometryColor(sweepCmd.color, materials);
      builder.mergeMesh(sweepName, sweepMesh, color);
      continue;
    }

    // Subdivide (P2-M1b)
    if ('subdivide' in cmd) {
      const subCmd = cmd as { subdivide: string; mesh?: string; iterations?: number };
      const iterations = subCmd.iterations ?? 1;

      // Subdivide the current mesh
      for (let i = 0; i < iterations; i++) {
        const currentMesh = builder.getMesh();
        const subdivided = subdivideCatmullClark(currentMesh);
        builder.replaceMesh(subdivided);
      }

      builder.trace(`subdivide:${subCmd.subdivide}`, { iterations });
      continue;
    }

    // Extrude2D (P2-M3)
    if ('extrude2d' in cmd) {
      const extCmd = cmd as {
        extrude2d: string;
        shape: string;
        depth: number | string;
        caps?: 'none' | 'front' | 'back' | 'both';
        offset?: number | string;
        bevel?: { size: number | string; segments: number | string };
        color?: YamlColor | string;
      };

      const extrudeName = extCmd.extrude2d;
      const shapeDef = (builder as any)._yamlShapes?.get(extCmd.shape);

      if (!shapeDef) {
        throw new Error(`Shape '${extCmd.shape}' not found. Define it in shapes: section.`);
      }

      // Evaluate depth and offset
      const depth = typeof extCmd.depth === 'number'
        ? extCmd.depth
        : evaluatePositionComponent(extCmd.depth, builder);

      const offset = extCmd.offset !== undefined
        ? (typeof extCmd.offset === 'number' ? extCmd.offset : evaluatePositionComponent(extCmd.offset, builder))
        : 0;

      // Create Shape2D from definition
      let shape: Shape2D;
      const centerX = shapeDef.center?.x !== undefined
        ? (typeof shapeDef.center.x === 'number' ? shapeDef.center.x : evaluatePositionComponent(shapeDef.center.x, builder))
        : 0;
      const centerZ = shapeDef.center?.z !== undefined
        ? (typeof shapeDef.center.z === 'number' ? shapeDef.center.z : evaluatePositionComponent(shapeDef.center.z, builder))
        : 0;

      switch (shapeDef.type) {
        case 'rect': {
          const width = typeof shapeDef.width === 'number' ? shapeDef.width : evaluatePositionComponent(shapeDef.width!, builder);
          const height = typeof shapeDef.height === 'number' ? shapeDef.height : evaluatePositionComponent(shapeDef.height!, builder);
          shape = Shape2D.rect(width, height, { x: centerX, z: centerZ });
          break;
        }
        case 'circle': {
          const radius = typeof shapeDef.radius === 'number' ? shapeDef.radius : evaluatePositionComponent(shapeDef.radius!, builder);
          const segments = typeof shapeDef.segments === 'number' ? shapeDef.segments : (shapeDef.segments ? Math.round(evaluatePositionComponent(shapeDef.segments, builder)) : 32);
          shape = Shape2D.circle(radius, segments, { x: centerX, z: centerZ });
          break;
        }
        case 'ellipse': {
          const radiusX = typeof shapeDef.radiusX === 'number' ? shapeDef.radiusX : evaluatePositionComponent(shapeDef.radiusX!, builder);
          const radiusZ = typeof shapeDef.radiusZ === 'number' ? shapeDef.radiusZ : evaluatePositionComponent(shapeDef.radiusZ!, builder);
          const segments = typeof shapeDef.segments === 'number' ? shapeDef.segments : (shapeDef.segments ? Math.round(evaluatePositionComponent(shapeDef.segments, builder)) : 32);
          shape = Shape2D.ellipse(radiusX, radiusZ, segments, { x: centerX, z: centerZ });
          break;
        }
        case 'polygon': {
          if (!shapeDef.points || shapeDef.points.length < 3) {
            throw new Error(`Polygon shape '${extCmd.shape}' must have at least 3 points`);
          }
          const points = shapeDef.points.map((pt: any) => ({
            x: typeof pt.x === 'number' ? pt.x : evaluatePositionComponent(pt.x, builder),
            z: typeof pt.z === 'number' ? pt.z : evaluatePositionComponent(pt.z, builder)
          }));
          shape = Shape2D.polygon(points);
          break;
        }
        case 'text': {
          if (!shapeDef.content) {
            throw new Error(`Text shape '${extCmd.shape}' must have 'content' property`);
          }
          if (!shapeDef.font) {
            throw new Error(`Text shape '${extCmd.shape}' must have 'font' property`);
          }

          // Import text functions
          const { textToShape } = await import('../text/TextToShape');

          const size = shapeDef.size !== undefined
            ? (typeof shapeDef.size === 'number' ? shapeDef.size : evaluatePositionComponent(shapeDef.size, builder))
            : 1.0;
          const spacing = shapeDef.spacing !== undefined
            ? (typeof shapeDef.spacing === 'number' ? shapeDef.spacing : evaluatePositionComponent(shapeDef.spacing, builder))
            : 0.0;

          // Generate text shape
          const textShape = textToShape(
            shapeDef.content,
            shapeDef.font,
            size,
            spacing,
            { x: centerX, z: centerZ }
          );

          // Convert text contours to Shape2D
          // Text can have multiple contours (for holes like in 'A', 'O')
          // For now, we'll create a Shape2D from the first (outer) contour
          // TODO: P2M4-003 will add boolean operations to handle holes properly
          const outerContours = textShape.contours.filter(c => !c.isHole);
          if (outerContours.length === 0) {
            throw new Error(`Text shape '${extCmd.shape}' has no outer contours`);
          }

          // Use the first outer contour for now
          // When we have boolean ops, we'll union all outer contours and subtract holes
          shape = Shape2D.polygon(outerContours[0].points);
          break;
        }
        default:
          throw new Error(`Unknown shape type: ${shapeDef.type}`);
      }

      // Extrude the shape
      const extrudeParams: any = {
        depth,
        caps: extCmd.caps || 'both',
        offset
      };

      // Add bevel if specified
      if (extCmd.bevel) {
        const bevelSize = typeof extCmd.bevel.size === 'number'
          ? extCmd.bevel.size
          : evaluatePositionComponent(extCmd.bevel.size, builder);
        const bevelSegments = typeof extCmd.bevel.segments === 'number'
          ? extCmd.bevel.segments
          : Math.round(evaluatePositionComponent(extCmd.bevel.segments, builder));

        extrudeParams.bevel = {
          size: bevelSize,
          segments: bevelSegments
        };
      }

      const extruded = extrude2D(shape, extrudeParams);

      // Get color for faces
      const color = resolveGeometryColor(extCmd.color, materials);

      // Convert to Mesh format with proper Vertex objects
      const meshVertices = extruded.vertices.map((v, i) => {
        const normal = extruded.normals[i];
        return new Vertex(v, { normal });
      });

      const meshFaces = extruded.faces.map(face => {
        return new Face(face, color);
      });

      const extrudedMesh = new Mesh(meshVertices, meshFaces);

      builder.mergeMesh(extrudeName, extrudedMesh, color);
      continue;
    }
    } catch (err: any) {
      // Get command type for error message
      const cmdType = Object.keys(cmd)[0] || 'unknown';
      const cmdName = (cmd as any)[cmdType] || '';

      // Enhance error with YAML path if available
      const contextPath = ctx.getPath();
      const errorMsg = contextPath
        ? `Error at ${contextPath}[${cmdIndex}] (${cmdType}: ${cmdName}): ${err.message}`
        : `Error at geometry command #${cmdIndex + 1} (${cmdType}: ${cmdName}): ${err.message}`;

      throw new Error(errorMsg);
    }
  }
}

/**
 * Interpolate ${var} references in a string using context values
 * Used for name generation in repeat blocks: leg_${i}_bottom -> leg_0_bottom
 */
function interpolateName(template: string, context: Record<string, number>): string {
  return template.replace(/\$\{(\w+)\}/g, (match, varName) => {
    if (varName in context) {
      return String(context[varName]);
    }
    return match; // Keep original if not found
  });
}

function evaluateCondition(condition: string, values: Map<string, any>): boolean {
  // Use unified ExpressionService evaluation with a minimal context
  // This provides consistent behavior across all condition evaluation
  const ctx: EvaluationContext = {
    decisions: values,
    measurements: {},
    constraints: {}
  };
  return exprEvalCondition(condition, ctx);
}

/**
 * Evaluate a composition condition using unified ExpressionService
 */
function evaluateCompositionCondition(
  condition: string,
  values: Map<string, any>,
  builder: TracedBuilder
): boolean {
  const ctx = createContext(builder, values);
  return exprEvalCondition(condition, ctx);
}

function evaluateExpression(expr: string, values: Map<string, any>, builder: TracedBuilder): number {
  // Use unified ExpressionService
  const ctx = createContext(builder, values);
  return exprEvalNumeric(expr, ctx);
}

function evaluatePositionComponent(value: string | number, builder: TracedBuilder): number {
  if (typeof value === 'number') return value;

  // Use MathService for position evaluation
  const variables = builder.context.toObject();
  try {
    const result = mathEvaluate(value, variables);
    return result.value;
  } catch (e: any) {
    throw new Error(`Failed to evaluate position '${value}': ${e.message}`);
  }
}

// ============================================================================
// YAML PARSING (using simple regex for now, can switch to yaml library)
// ============================================================================

/**
 * Parse YAML string to builder definition
 * Note: For production, use a proper YAML library like 'yaml' or 'js-yaml'
 */
export function parseYaml(_content: string): YamlBuilderDefinition {
  // This is a placeholder - we'll use a YAML library
  // For now, assume content is already parsed JSON/object
  throw new Error('YAML parsing requires yaml library - use parseYamlWithLibrary instead');
}

/**
 * Parse YAML using the yaml library (must be installed)
 */
export async function parseYamlWithLibrary(content: string): Promise<YamlBuilderDefinition> {
  // Dynamic import to avoid bundling if not used
  const yaml = await import('yaml');
  return yaml.parse(content) as YamlBuilderDefinition;
}

// ============================================================================
// BUILDER REGISTRY
// ============================================================================

export interface BuilderRegistry {
  /**
   * Get a builder function by name
   */
  get(name: string): ((seed: number, overrides?: Record<string, any>) => TracedOutput) | null;

  /**
   * Register a builder function
   */
  register(name: string, fn: (seed: number, overrides?: Record<string, any>) => TracedOutput): void;

  /**
   * List all registered builders
   */
  list(): string[];
}

/**
 * Simple in-memory builder registry
 */
export function createBuilderRegistry(): BuilderRegistry {
  const builders = new Map<string, (seed: number, overrides?: Record<string, any>) => TracedOutput>();

  return {
    get(name: string) {
      return builders.get(name) ?? null;
    },

    register(name: string, fn: (seed: number, overrides?: Record<string, any>) => TracedOutput) {
      builders.set(name, fn);
    },

    list() {
      return Array.from(builders.keys());
    }
  };
}

