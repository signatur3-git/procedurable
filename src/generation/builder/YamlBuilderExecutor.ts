/**
 * YamlBuilderExecutor - Execute YAML builder definitions
 *
 * This module handles the execution of parsed YAML builder definitions.
 * It processes the 6 phases: decisions, measurements, materials, derived, geometry, compose.
 *
 * Design: Built from scratch to match actual API signatures in TracedBuilder,
 * Placement, and other modules. Uses command registry for geometry processing.
 */

import { TracedBuilder, TracedOutput } from './TracedBuilder';
import { Vec3 } from '../../platform/math/Vec3';
import { AABB } from '../../platform/math/AABB';
import { Random } from '../../platform/math/Random';
import { evaluate as mathEvaluate } from '../../platform/math/MathService';
import { placeAroundRectangle, placeAroundCircle, PlacementConfig } from '../../platform/scene/Placement';
import { poissonDiskSample, ScatterBounds, PoissonConfig } from '../../platform/spatial/Scatter';
import { SharedContext } from './SharedContext';
import { SceneGraph } from '../../platform/scene/SceneGraph';
import {
  createContext,
  evaluateNumeric as exprEvalNumeric,
  evaluateCondition as exprEvalCondition
} from './ExpressionService';

// Import resolution helpers
import { resolveMaterials } from './MaterialResolver';

// Import command registry
import { createStandardRegistry } from './commands';
import type { GeometryCommandContext } from './GeometryCommandHandler';

// Import types
import type {
  YamlBuilderDefinition,
  YamlGeometryCommand,
  YamlComposition
} from './YamlBuilderTypes';

// Create singleton command registry
const commandRegistry = createStandardRegistry();

// ============================================================================
// EXECUTION OPTIONS
// ============================================================================

export interface ExecuteOptions {
  seed?: number;
  overrides?: Record<string, any>;
  builderResolver?: (name: string) => ((seed: number, overrides?: Record<string, any>) => TracedOutput | Promise<TracedOutput>) | null;
  sharedContext?: SharedContext;
}

// ============================================================================
// PARSING CONTEXT (for error messages)
// ============================================================================

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

  wrapError(error: Error): Error {
    const path = this.getPath();
    if (path) {
      return new Error(`Error at ${path}: ${error.message}`);
    }
    return error;
  }
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

/**
 * Execute a parsed YAML builder definition
 */
export async function executeBuilder(
  yaml: YamlBuilderDefinition,
  options?: ExecuteOptions
): Promise<TracedOutput> {
  const seed = options?.seed;
  const overrides = options?.overrides ?? {};

  const builder = new TracedBuilder(yaml.name, seed, overrides);
  const ctx = new ParsingContext();
  const decisionValues = new Map<string, any>();

  // Phase 0: Initialize Shared Context
  let sharedContext = options?.sharedContext;
  if (!sharedContext && yaml.shared_context) {
    sharedContext = new SharedContext(yaml.shared_context);
  }

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
          const evalCtx = { decisions: decisionValues, measurements: {}, constraints: {} };
          if (!exprEvalCondition(decision.condition, evalCtx)) {
            continue;
          }
        }

        switch (decision.type) {
          case 'choice':
            value = builder.decide(name, decision.options, decision.weights ?? decision.options.map(() => 1));
            break;
          case 'number':
            if (decision.min > decision.max) {
              throw new Error(`min (${decision.min}) must be <= max (${decision.max})`);
            }
            value = builder.decideNumber(name, decision.min, decision.max, decision.default);
            break;
          case 'boolean':
            value = builder.decideBoolean(name, decision.probability);
            break;
          case 'count':
            if (decision.min > decision.max) {
              throw new Error(`min (${decision.min}) must be <= max (${decision.max})`);
            }
            value = builder.decideCount(name, decision.min, decision.max);
            break;
        }

        decisionValues.set(name, value);

        // Also add numeric decision values to builder context for expression evaluation
        // This allows geometry commands to reference decisions like spindle_count
        if (typeof value === 'number') {
          builder.context.setMeasurement(name, value);
        }
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

        // Check for override
        if (overrides[name] !== undefined && typeof overrides[name] === 'number') {
          value = overrides[name];
        } else if (measurement.value !== undefined) {
          value = typeof measurement.value === 'number'
            ? measurement.value
            : evaluateExpression(measurement.value, decisionValues, builder);
        } else if (measurement.base !== undefined) {
          value = measurement.base;
          if (measurement.variation) {
            const variation = decisionValues.get(measurement.variation) ?? 0;
            value += variation;
          }
        } else {
          throw new Error(`Measurement '${name}' has no value or base`);
        }

        // Check for conditional overrides
        if (!overrides[name] && measurement.conditional) {
          for (const cond of measurement.conditional) {
            const evalCtx = createContext(builder, decisionValues);
            if (exprEvalCondition(cond.if, evalCtx)) {
              value = typeof cond.value === 'number'
                ? cond.value
                : evaluateExpression(cond.value, decisionValues, builder);
              break;
            }
          }
        }

        builder.context.setMeasurement(name, value);
        builder.measurements.set(name, { value, source: measurement.source });
      } catch (err: any) {
        throw ctx.wrapError(err);
      } finally {
        ctx.pop();
      }
    }
  }

  // ==========================================================================
  // PHASE 2.5: Process Materials
  // ==========================================================================

  const materials = resolveMaterials(yaml.materials, decisionValues);

  // ==========================================================================
  // PHASE 2.6: Store Profiles, Splines, Shapes
  // ==========================================================================

  (builder as any)._yamlProfiles = new Map(Object.entries(yaml.profiles ?? {}));
  (builder as any)._yamlSplines = new Map(Object.entries(yaml.splines ?? {}));
  (builder as any)._yamlShapes = new Map(Object.entries(yaml.shapes ?? {}));

  // ==========================================================================
  // PHASE 3: Process Derived Values
  // ==========================================================================

  if (yaml.derived) {
    for (const [name, expression] of Object.entries(yaml.derived)) {
      try {
        ctx.push(`derived.${name}`);
        const value = evaluateExpression(expression, decisionValues, builder);
        builder.context.setDerived(name, value);
        builder.measurements.set(name, { value, source: `derived: ${expression}` });
        builder.traces.set(`derived:${name}`, {
          type: 'measurement',
          name,
          source: { expression: `${name} = ${expression}`, builderName: yaml.name },
          details: { expression, value, dependencies: [] }
        });
      } catch (err: any) {
        throw ctx.wrapError(err);
      } finally {
        ctx.pop();
      }
    }
  }

  // ==========================================================================
  // PHASE 4: Process Geometry (using command registry)
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

        // Check conditional
        if (composition.if !== undefined) {
          const evalCtx = createContext(builder, decisionValues);
          if (!exprEvalCondition(composition.if, evalCtx)) {
            continue;
          }
        }

        // Handle repeat
        if (composition.repeat) {
          const repeatCount = typeof composition.repeat.count === 'number'
            ? composition.repeat.count
            : evaluateExpression(String(composition.repeat.count), decisionValues, builder);

          for (let i = 0; i < repeatCount; i++) {
            const indexVar = composition.repeat.as;
            builder.context.setMeasurement(indexVar, i);
            decisionValues.set(indexVar, i);

            await processComposition(
              `${instanceName}_${i}`,
              composition,
              builder,
              decisionValues,
              options.builderResolver
            );
          }
        } else {
          await processComposition(
            instanceName,
            composition,
            builder,
            decisionValues,
            options.builderResolver
          );
        }
      } catch (err: any) {
        throw ctx.wrapError(err);
      } finally {
        ctx.pop();
      }
    }
  }

  // ==========================================================================
  // PHASE 6: Constraint-Based Placement
  // ==========================================================================

  if (yaml.placement && options?.builderResolver) {
    const placements = Array.isArray(yaml.placement) ? yaml.placement : [yaml.placement];

    for (const placement of placements) {
      try {
        ctx.push(`placement.${placement.mode}`);
        await processPlacement(placement, builder, decisionValues, options.builderResolver, seed);
      } catch (err: any) {
        throw ctx.wrapError(err);
      } finally {
        ctx.pop();
      }
    }
  }

  // ==========================================================================
  // Build Output
  // ==========================================================================

  const output = builder.build();
  output.sceneGraph = sceneGraph;

  // A2-003: Run quality gates automatically when quality: section is present
  if (yaml.quality) {
    const { evaluateQualityTier } = await import('../validation/ValidationAPI');
    const validationContext = {
      builderName: yaml.name,
      mesh: output.mesh,
      measurements: output.measurements,
      decisions: output.decisions,
      tags: sceneGraph?.getAllTags?.() || [],
      traces: output.traces,
      qualityMeta: yaml.quality
    };
    output.qualityGateResult = evaluateQualityTier(validationContext, yaml.quality.target_tier);

    // Add gate failures as warnings in validation.issues (don't block execution)
    if (output.qualityGateResult.suggestions?.length > 0) {
      for (const suggestion of output.qualityGateResult.suggestions) {
        output.validation.issues.push({
          severity: 'warning',
          message: `Quality gate (Tier ${suggestion.tier}): ${suggestion.reason}`,
          suggestion: `${suggestion.action}: ${suggestion.target} (current: ${suggestion.current_value}, required: ${suggestion.required_value})`
        });
      }
    }
  }

  return output;
}

// ============================================================================
// GEOMETRY PROCESSING
// ============================================================================

async function processGeometry(
  commands: YamlGeometryCommand[],
  builder: TracedBuilder,
  decisionValues: Map<string, any>,
  materials: Map<string, { r: number; g: number; b: number }>,
  ctx: ParsingContext
): Promise<void> {
  // Create command context for registry-based handlers
  const createCommandContext = (): GeometryCommandContext => ({
    builder,
    decisionValues,
    materials,
    processGeometry: async (cmds: YamlGeometryCommand[]) => {
      await processGeometry(cmds, builder, decisionValues, materials, ctx);
    },
    evaluateExpression: (expr: string | number) => {
      if (typeof expr === 'number') return expr;
      // Build variables including both measurements and decision values
      const vars = builder.context.toObject();
      for (const [k, v] of decisionValues.entries()) {
        if (typeof v === 'number') {
          vars[k] = v;
        }
      }
      try {
        return mathEvaluate(expr, vars).value;
      } catch (e: any) {
        throw new Error(`Failed to evaluate expression '${expr}': ${e.message}`);
      }
    },
    interpolateName: (template: string) => interpolateName(template, builder.context.toObject())
  });

  for (let cmdIndex = 0; cmdIndex < commands.length; cmdIndex++) {
    const cmd = commands[cmdIndex];

    try {
      // Skip comments
      if ('comment' in cmd) continue;

      // Handle legacy format: { type: 'vertex', name: 'v1', x: 0, y: 0, z: 0 }
      // Also supports ${var} template syntax
      if ('type' in cmd && (cmd as any).type === 'vertex') {
        const legacyCmd = cmd as any;
        const name = interpolateName(legacyCmd.name, builder.context.toObject());

        // Interpolate ${var} to var for expression evaluation
        const interpolateExpr = (val: string | number): string => {
          if (typeof val === 'number') return String(val);
          // Convert ${size} to just size for evaluation
          return String(val).replace(/\$\{(\w+)\}/g, '$1');
        };

        builder.placeVertex(name, {
          x: interpolateExpr(legacyCmd.x),
          y: interpolateExpr(legacyCmd.y),
          z: interpolateExpr(legacyCmd.z)
        });
        continue;
      }

      // Handle legacy format: { type: 'face', name: 'f1', vertices: [...] }
      if ('type' in cmd && (cmd as any).type === 'face') {
        const legacyCmd = cmd as any;
        builder.createFace(legacyCmd.name, legacyCmd.vertices);
        continue;
      }

      // Use registry-based handler
      const handler = commandRegistry.findHandler(cmd);
      if (handler) {
        await handler.execute(cmd, createCommandContext());
        continue;
      }

      // Unknown command
      const cmdType = Object.keys(cmd)[0] || 'unknown';
      console.warn(`Unknown geometry command: ${cmdType}`);

    } catch (err: any) {
      const cmdType = Object.keys(cmd)[0] || 'unknown';
      const cmdName = (cmd as any)[cmdType] || '';
      const contextPath = ctx.getPath();
      const errorMsg = contextPath
        ? `Error at ${contextPath}[${cmdIndex}] (${cmdType}: ${cmdName}): ${err.message}`
        : `Error at geometry command #${cmdIndex + 1} (${cmdType}: ${cmdName}): ${err.message}`;
      throw new Error(errorMsg);
    }
  }
}

// ============================================================================
// COMPOSITION PROCESSING
// ============================================================================

async function processComposition(
  instanceName: string,
  composition: YamlComposition,
  builder: TracedBuilder,
  decisionValues: Map<string, any>,
  builderResolver: (name: string) => ((seed: number, overrides?: Record<string, any>) => TracedOutput | Promise<TracedOutput>) | null
): Promise<void> {
  const childBuilderFn = builderResolver(composition.builder);
  if (!childBuilderFn) {
    throw new Error(`Builder '${composition.builder}' not found`);
  }

  // Prepare overrides with constraints
  const childOverrides: Record<string, any> = { ...composition.overrides };
  if (composition.constraints) {
    childOverrides.__constraints__ = {};
    for (const [key, value] of Object.entries(composition.constraints)) {
      if (typeof value === 'string') {
        childOverrides.__constraints__[key] = evaluateExpression(value, decisionValues, builder);
      } else {
        childOverrides.__constraints__[key] = value;
      }
    }
  }

  // Build offset/rotation/scale for compose
  const offset = composition.offset ? {
    x: evaluatePositionComponent(composition.offset.x, builder),
    y: evaluatePositionComponent(composition.offset.y, builder),
    z: evaluatePositionComponent(composition.offset.z, builder)
  } : undefined;

  const rotation = composition.rotation ? {
    x: evaluatePositionComponent(composition.rotation.x, builder),
    y: evaluatePositionComponent(composition.rotation.y, builder),
    z: evaluatePositionComponent(composition.rotation.z, builder)
  } : undefined;

  // Use TracedBuilder.compose which handles everything properly
  await builder.compose(instanceName, childBuilderFn, {
    offset,
    rotation,
    scale: composition.scale,
    overrides: childOverrides,
    asInstance: composition.asInstance
  });
}

// ============================================================================
// PLACEMENT PROCESSING (matches actual Placement.ts API)
// ============================================================================

async function processPlacement(
  placement: any,
  builder: TracedBuilder,
  decisionValues: Map<string, any>,
  builderResolver: (name: string) => ((seed: number, overrides?: Record<string, any>) => TracedOutput | Promise<TracedOutput>) | null,
  seed?: number
): Promise<void> {
  const childBuilderFn = builderResolver(placement.builder);
  if (!childBuilderFn) {
    throw new Error(`Builder '${placement.builder}' not found for placement`);
  }

  const count = typeof placement.count === 'number'
    ? placement.count
    : evaluateExpression(String(placement.count), decisionValues, builder);

  const minDistance = typeof placement.minDistance === 'string'
    ? evaluateExpression(placement.minDistance, decisionValues, builder)
    : (placement.minDistance ?? 0.1);

  // Resolve overrides for the child builder
  const resolvedOverrides: Record<string, any> = {};
  if (placement.overrides) {
    for (const [key, value] of Object.entries(placement.overrides)) {
      if (typeof value === 'string') {
        const refMatch = value.match(/^\$parent\.(.+)$/);
        if (refMatch) {
          const parentKey = refMatch[1];
          if (decisionValues.has(parentKey)) {
            resolvedOverrides[key] = decisionValues.get(parentKey);
          } else {
            const evaluated = builder.context.get(parentKey);
            if (evaluated !== undefined) resolvedOverrides[key] = evaluated;
          }
        } else {
          resolvedOverrides[key] = value;
        }
      } else {
        resolvedOverrides[key] = value;
      }
    }
  }

  // Build a sample to get AABB
  const sampleOutput = await childBuilderFn(seed ?? 1, resolvedOverrides);
  const bounds = sampleOutput.validation?.bounds;
  const objectAABB = bounds
    ? new AABB(bounds.min, bounds.max)
    : new AABB(new Vec3(-0.2, 0, -0.2), new Vec3(0.2, 0.5, 0.2));

  // Get center position
  const center = placement.center ? new Vec3(
    evaluatePositionComponent(placement.center.x, builder),
    evaluatePositionComponent(placement.center.y, builder),
    evaluatePositionComponent(placement.center.z, builder)
  ) : new Vec3(0, 0, 0);

  // Placement config
  const placementConfig: PlacementConfig = {
    minDistance,
    maxAttempts: 10,
    allowReducedCount: placement.allowReducedCount ?? true,
    seed: seed ?? 1
  };

  let placementResult: any;

  if (placement.mode === 'around_rectangle') {
    const width = typeof placement.width === 'string'
      ? evaluateExpression(placement.width, decisionValues, builder)
      : (placement.width ?? 1);
    const depth = typeof placement.depth === 'string'
      ? evaluateExpression(placement.depth, decisionValues, builder)
      : (placement.depth ?? 1);

    placementResult = placeAroundRectangle(center, width, depth, objectAABB, count, placementConfig);

  } else if (placement.mode === 'around_circle') {
    const radius = typeof placement.radius === 'string'
      ? evaluateExpression(placement.radius, decisionValues, builder)
      : (placement.radius ?? 1);

    placementResult = placeAroundCircle(center, radius, objectAABB, count, placementConfig);

  } else if (placement.mode === 'scatter_poisson') {
    const width = typeof placement.width === 'string'
      ? evaluateExpression(placement.width, decisionValues, builder)
      : (placement.width ?? 1);
    const depth = typeof placement.depth === 'string'
      ? evaluateExpression(placement.depth, decisionValues, builder)
      : (placement.depth ?? 1);

    const scatterBounds: ScatterBounds = {
      minX: center.x - width / 2,
      maxX: center.x + width / 2,
      minZ: center.z - depth / 2,
      maxZ: center.z + depth / 2
    };

    const scatterConfig: PoissonConfig = {
      seed: seed ?? 1,
      minDistance
    };

    const scatterPoints = poissonDiskSample(scatterBounds, scatterConfig);
    const rotationRandom = new Random((seed ?? 1) + 12345);

    // Convert scatter points to placement result format
    placementResult = {
      success: true,
      placements: scatterPoints.slice(0, count).map(pt => ({
        position: new Vec3(pt.x, center.y, pt.z),
        rotation: placement.randomRotation ? rotationRandom.next() * Math.PI * 2 : 0,
        aabb: objectAABB
      })),
      rejected: 0
    };
  }

  if (!placementResult?.success && placementResult?.reason) {
    console.warn(`Placement warning: ${placementResult.reason}`);
  }

  // Place each object using compose
  const instancePrefix = placement.instancePrefix ?? 'placed';
  for (let i = 0; i < placementResult.placements.length; i++) {
    const p = placementResult.placements[i];
    const instanceName = `${instancePrefix}_${i}`;

    await builder.compose(instanceName, childBuilderFn, {
      offset: { x: p.position.x, y: p.position.y, z: p.position.z },
      rotation: { x: 0, y: p.rotation, z: 0 },
      overrides: resolvedOverrides,
      asInstance: placement.asInstance
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function interpolateName(template: string, context: Record<string, number>): string {
  return template.replace(/\$\{(\w+)\}/g, (match, varName) =>
    varName in context ? String(context[varName]) : match
  );
}

function evaluateExpression(expr: string, values: Map<string, any>, builder: TracedBuilder): number {
  const ctx = createContext(builder, values);
  return exprEvalNumeric(expr, ctx);
}

function evaluatePositionComponent(value: string | number, builder: TracedBuilder): number {
  if (typeof value === 'number') return value;
  try {
    return mathEvaluate(value, builder.context.toObject()).value;
  } catch (e: any) {
    throw new Error(`Failed to evaluate position '${value}': ${e.message}`);
  }
}
