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
import { resolveMaterials, resolveMaterialSlots } from './MaterialResolver';

// F2-001: Style resolution
import { loadStyle, StyleDefinition } from './StyleResolver';

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
  constraintResolver?: (key: string) => import('../validation/ConstraintEvaluator').ConstraintSchema | null;  // F1-002
  sharedContext?: SharedContext;
  /**
   * LOD budget for this execution (G2-001)
   * Sub-builders with lod_min > lodBudget are replaced with bounding box placeholders
   * Defaults to Infinity (no LOD filtering)
   */
  lodBudget?: number;
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
  // PHASE 0.5: Load and Apply Style (F2-001, F2-002)
  // ==========================================================================

  let activeStyle: StyleDefinition | null = null;

  // F2-002: Determine effective style (explicit YAML > inherited via overrides > SharedContext)
  // Also peek at a `style` choice decision if present — allows the dashboard to expose
  // style as a selectable option (PHASE 1.5 approach is too late because style defaults
  // must be set before decisions run in PHASE 1).
  let effectiveStyleName = yaml.style;
  if (!effectiveStyleName && overrides.__style__) {
    // Style passed from parent via composition
    effectiveStyleName = overrides.__style__;
  }
  if (!effectiveStyleName && yaml.decisions?.style?.type === 'choice') {
    // Pre-peek: if a 'style' choice decision exists, resolve its value now
    // Priority: explicit override > decision default
    if (overrides['style']) {
      effectiveStyleName = String(overrides['style']);
    } else if (yaml.decisions.style.default) {
      effectiveStyleName = String(yaml.decisions.style.default);
    } else if (yaml.decisions.style.options?.length > 0) {
      effectiveStyleName = String(yaml.decisions.style.options[0]);
    }
  }
  if (!effectiveStyleName && sharedContext) {
    effectiveStyleName = sharedContext.getStyle();
  }

  if (effectiveStyleName) {
    try {
      activeStyle = await loadStyle(effectiveStyleName);
      if (activeStyle && activeStyle.decision_defaults) {
        builder.setStyleDefaults(activeStyle.decision_defaults);
      }
      // F2-002: Propagate style to SharedContext for children
      if (sharedContext) {
        sharedContext.setStyle(effectiveStyleName);
      }
    } catch (err) {
      // Style loading failed, continue without style defaults
      console.warn(`[YamlBuilderExecutor] Failed to load style '${effectiveStyleName}': ${(err as Error).message}`);
    }
  }

  // ==========================================================================
  // PHASE 0.75: Determine LOD Budget (G2-001)
  // ==========================================================================

  // LOD budget: explicit options > YAML definition > inherited via overrides > Infinity (no filtering)
  let effectiveLodBudget: number = Infinity;
  if (options?.lodBudget !== undefined) {
    effectiveLodBudget = options.lodBudget;
  } else if (yaml.lod_budget !== undefined) {
    effectiveLodBudget = yaml.lod_budget;
  } else if (overrides.__lod_budget__ !== undefined) {
    effectiveLodBudget = overrides.__lod_budget__;
  }

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

  // After PHASE 1: if a 'style' decision was processed (randomly chosen, no override),
  // reconcile effectiveStyleName so child composition cascades the correct style.
  // The style defaults were already applied in PHASE 0.5 using the pre-peeked value,
  // so this only matters for propagating to children if the random pick differed.
  if (decisionValues.has('style')) {
    const decidedStyle = String(decisionValues.get('style'));
    if (decidedStyle !== effectiveStyleName) {
      effectiveStyleName = decidedStyle;
      if (sharedContext) {
        sharedContext.setStyle(effectiveStyleName);
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
  // PHASE 2.5: Process Materials (F2-003: Style-driven material theming)
  // ==========================================================================

  const materials = resolveMaterials(yaml.materials, decisionValues, activeStyle);
  const materialSlots = resolveMaterialSlots(yaml.materials, decisionValues, activeStyle);

  // Register material slots on the mesh
  for (const slot of materialSlots.values()) {
    builder.mesh.addMaterialSlot(slot);
  }

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
  // PHASE 3.5: Process Builder Tags (H3-001: Semantic tags for PSD querying)
  // ==========================================================================

  let evaluatedTags: Record<string, string> | undefined;
  if (yaml.tags && !Array.isArray(yaml.tags)) {
    evaluatedTags = {};
    for (const [key, value] of Object.entries(yaml.tags)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        const varName = value.slice(1);
        const resolved = decisionValues.get(varName) ?? overrides[varName];
        evaluatedTags[key] = resolved !== undefined ? String(resolved) : value;
      } else {
        evaluatedTags[key] = String(value);
      }
    }
  }

  // ==========================================================================
  // PHASE 4: Process Geometry (using command registry)
  // ==========================================================================

  if (yaml.geometry) {
    try {
      ctx.push('geometry');
      await processGeometry(yaml.geometry, builder, decisionValues, materials, materialSlots, ctx);
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

        // G2-001: Check LOD condition - skip or replace with placeholder if below minimum
        const lodMin = composition.lod_min;
        if (lodMin !== undefined && effectiveLodBudget < lodMin) {
          // LOD budget is below minimum - skip this composition
          // Track this skip using a measurement-like entry
          builder.measurements.set(`__lod_skipped__${instanceName}`, {
            value: 1,
            source: `LOD budget ${effectiveLodBudget} < lod_min ${lodMin}`
          });
          continue;
        }

        // G2-001: Prepare LOD tier override if specified
        const lodTierOverride = composition.lod_tier;

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
              options.builderResolver,
              seed,
              effectiveStyleName,  // F2-002: Pass parent style
              effectiveLodBudget,  // G2-001: Pass LOD budget
              lodTierOverride      // G2-001: Pass LOD tier override
            );
          }
        } else {
          await processComposition(
            instanceName,
            composition,
            builder,
            decisionValues,
            options.builderResolver,
            seed,
            effectiveStyleName,  // F2-002: Pass parent style
            effectiveLodBudget,  // G2-001: Pass LOD budget
            lodTierOverride      // G2-001: Pass LOD tier override
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
  // PHASE 5.5: Process Connections (F4-002: Assembly Metadata)
  // ==========================================================================

  if (yaml.connections) {
    for (const conn of yaml.connections) {
      builder.addConnection({
        type: conn.type,
        from: conn.from,
        to: conn.to,
        data: conn.data,
        description: conn.description
      });
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
  // PHASE 6: Process Ports (B5-001: Attachment Points)
  // ==========================================================================

  if (yaml.ports) {
    for (const [portName, portDef] of Object.entries(yaml.ports as Record<string, any>)) {
      try {
        ctx.push(`ports.${portName}`);

        // Evaluate position
        const evalCtx = createContext(builder, decisionValues);
        const posX = typeof portDef.position?.x === 'number'
          ? portDef.position.x
          : exprEvalNumeric(String(portDef.position?.x ?? '0'), evalCtx);
        const posY = typeof portDef.position?.y === 'number'
          ? portDef.position.y
          : exprEvalNumeric(String(portDef.position?.y ?? '0'), evalCtx);
        const posZ = typeof portDef.position?.z === 'number'
          ? portDef.position.z
          : exprEvalNumeric(String(portDef.position?.z ?? '0'), evalCtx);

        // Evaluate normal
        const normalX = typeof portDef.normal?.x === 'number'
          ? portDef.normal.x
          : exprEvalNumeric(String(portDef.normal?.x ?? '0'), evalCtx);
        const normalY = typeof portDef.normal?.y === 'number'
          ? portDef.normal.y
          : exprEvalNumeric(String(portDef.normal?.y ?? '1'), evalCtx);
        const normalZ = typeof portDef.normal?.z === 'number'
          ? portDef.normal.z
          : exprEvalNumeric(String(portDef.normal?.z ?? '0'), evalCtx);

        // Optional up vector
        let up: Vec3 | undefined;
        if (portDef.up) {
          up = new Vec3(
            typeof portDef.up.x === 'number' ? portDef.up.x : exprEvalNumeric(String(portDef.up.x ?? '0'), evalCtx),
            typeof portDef.up.y === 'number' ? portDef.up.y : exprEvalNumeric(String(portDef.up.y ?? '0'), evalCtx),
            typeof portDef.up.z === 'number' ? portDef.up.z : exprEvalNumeric(String(portDef.up.z ?? '1'), evalCtx)
          );
        }

        builder.registerPort(
          portName,
          new Vec3(posX, posY, posZ),
          new Vec3(normalX, normalY, normalZ),
          {
            up,
            loop: portDef.loop,
            metadata: portDef.metadata
          }
        );
      } catch (err: any) {
        throw ctx.wrapError(err);
      } finally {
        ctx.pop();
      }
    }
  }

  // ==========================================================================
  // PHASE 6.5: Process Skeleton (E1-001: Skeleton Declaration)
  // ==========================================================================

  if (yaml.skeleton && yaml.skeleton.length > 0) {
    try {
      ctx.push('skeleton');

      const evalCtx = createContext(builder, decisionValues);
      const joints: Array<{
        name: string;
        parent: string | null;
        position: Vec3;
        orientation: Vec3;
        constraints?: import('./TracedBuilder').JointConstraint;
      }> = [];

      for (const jointDef of yaml.skeleton) {
        ctx.push(`joint.${jointDef.name}`);
        try {
          // Evaluate position expressions
          const posX = typeof jointDef.position.x === 'number'
            ? jointDef.position.x
            : exprEvalNumeric(String(jointDef.position.x), evalCtx);
          const posY = typeof jointDef.position.y === 'number'
            ? jointDef.position.y
            : exprEvalNumeric(String(jointDef.position.y), evalCtx);
          const posZ = typeof jointDef.position.z === 'number'
            ? jointDef.position.z
            : exprEvalNumeric(String(jointDef.position.z), evalCtx);

          // Evaluate orientation (default 0,0,0) - convert degrees to radians
          let orientX = 0, orientY = 0, orientZ = 0;
          if (jointDef.orientation) {
            if (jointDef.orientation.x !== undefined) {
              const degrees = typeof jointDef.orientation.x === 'number'
                ? jointDef.orientation.x
                : exprEvalNumeric(String(jointDef.orientation.x), evalCtx);
              orientX = degrees * Math.PI / 180;
            }
            if (jointDef.orientation.y !== undefined) {
              const degrees = typeof jointDef.orientation.y === 'number'
                ? jointDef.orientation.y
                : exprEvalNumeric(String(jointDef.orientation.y), evalCtx);
              orientY = degrees * Math.PI / 180;
            }
            if (jointDef.orientation.z !== undefined) {
              const degrees = typeof jointDef.orientation.z === 'number'
                ? jointDef.orientation.z
                : exprEvalNumeric(String(jointDef.orientation.z), evalCtx);
              orientZ = degrees * Math.PI / 180;
            }
          }

          // Convert constraints
          let constraints: import('./TracedBuilder').JointConstraint | undefined;
          if (jointDef.constraints) {
            constraints = {
              type: jointDef.constraints.type,
              axis: jointDef.constraints.axis,
              limits: jointDef.constraints.limits
            };
          }

          joints.push({
            name: jointDef.name,
            parent: jointDef.parent ?? null,
            position: new Vec3(posX, posY, posZ),
            orientation: new Vec3(orientX, orientY, orientZ),
            constraints
          });
        } finally {
          ctx.pop();
        }
      }

      // Register skeleton on builder
      builder.registerSkeleton(joints);

    } catch (err: any) {
      throw ctx.wrapError(err);
    } finally {
      ctx.pop();
    }
  }

  // ==========================================================================
  // PHASE 6.6: Process Vertex Weights (E2-001: Weight Rules)
  // ==========================================================================

  if (yaml.weights && yaml.weights.length > 0 && builder.getSkeleton()) {
    try {
      ctx.push('weights');

      const evalCtx = createContext(builder, decisionValues);
      const rules: Array<{
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
      }> = [];

      for (const ruleDef of yaml.weights) {
        ctx.push(`rule.${ruleDef.type}`);
        try {
          if (ruleDef.type === 'proximity') {
            const radius = typeof ruleDef.radius === 'number'
              ? ruleDef.radius
              : exprEvalNumeric(String(ruleDef.radius), evalCtx);

            rules.push({
              type: 'proximity',
              joint: ruleDef.joint,
              radius,
              falloff: ruleDef.falloff
            });
          } else if (ruleDef.type === 'region') {
            const minX = typeof ruleDef.min.x === 'number' ? ruleDef.min.x : exprEvalNumeric(String(ruleDef.min.x), evalCtx);
            const minY = typeof ruleDef.min.y === 'number' ? ruleDef.min.y : exprEvalNumeric(String(ruleDef.min.y), evalCtx);
            const minZ = typeof ruleDef.min.z === 'number' ? ruleDef.min.z : exprEvalNumeric(String(ruleDef.min.z), evalCtx);
            const maxX = typeof ruleDef.max.x === 'number' ? ruleDef.max.x : exprEvalNumeric(String(ruleDef.max.x), evalCtx);
            const maxY = typeof ruleDef.max.y === 'number' ? ruleDef.max.y : exprEvalNumeric(String(ruleDef.max.y), evalCtx);
            const maxZ = typeof ruleDef.max.z === 'number' ? ruleDef.max.z : exprEvalNumeric(String(ruleDef.max.z), evalCtx);
            const weight = ruleDef.weight !== undefined
              ? (typeof ruleDef.weight === 'number' ? ruleDef.weight : exprEvalNumeric(String(ruleDef.weight), evalCtx))
              : 1;

            rules.push({
              type: 'region',
              joint: ruleDef.joint,
              min: new Vec3(minX, minY, minZ),
              max: new Vec3(maxX, maxY, maxZ),
              weight
            });
          } else if (ruleDef.type === 'gradient') {
            rules.push({
              type: 'gradient',
              joint_a: ruleDef.joint_a,
              joint_b: ruleDef.joint_b,
              axis: ruleDef.axis
            });
          }
        } finally {
          ctx.pop();
        }
      }

      // Compute weights
      builder.computeWeights(rules);

    } catch (err: any) {
      throw ctx.wrapError(err);
    } finally {
      ctx.pop();
    }
  }

  // ==========================================================================
  // PHASE 7: Process Requirements (B5-002: Request/Offer Negotiation)
  // ==========================================================================

  if (yaml.requirements && options?.sharedContext) {
    for (const [reqId, reqDef] of Object.entries(yaml.requirements as Record<string, any>)) {
      try {
        ctx.push(`requirements.${reqId}`);

        const evalCtx = createContext(builder, decisionValues);

        // Evaluate position
        const posX = typeof reqDef.position?.x === 'number'
          ? reqDef.position.x
          : exprEvalNumeric(String(reqDef.position?.x ?? '0'), evalCtx);
        const posZ = typeof reqDef.position?.z === 'number'
          ? reqDef.position.z
          : exprEvalNumeric(String(reqDef.position?.z ?? '0'), evalCtx);

        // Evaluate dimensions
        const width = reqDef.width !== undefined
          ? (typeof reqDef.width === 'number' ? reqDef.width : exprEvalNumeric(String(reqDef.width), evalCtx))
          : undefined;
        const depth = reqDef.depth !== undefined
          ? (typeof reqDef.depth === 'number' ? reqDef.depth : exprEvalNumeric(String(reqDef.depth), evalCtx))
          : undefined;
        const radius = reqDef.radius !== undefined
          ? (typeof reqDef.radius === 'number' ? reqDef.radius : exprEvalNumeric(String(reqDef.radius), evalCtx))
          : undefined;
        const maxSlope = reqDef.max_slope !== undefined
          ? (typeof reqDef.max_slope === 'number' ? reqDef.max_slope : exprEvalNumeric(String(reqDef.max_slope), evalCtx))
          : undefined;

        // Publish requirement to shared context
        options.sharedContext.publishRequirement({
          id: reqId,
          publisher: yaml.name,
          type: reqDef.type,
          shape: reqDef.shape || 'rectangle',
          position: { x: posX, z: posZ },
          width,
          depth,
          radius,
          maxSlope,
          priority: reqDef.priority,
          metadata: reqDef.metadata
        });

        // Trace the requirement
        builder.trace(`requirement:${reqId}`, {
          type: reqDef.type,
          shape: reqDef.shape || 'rectangle',
          position: { x: posX, z: posZ },
          width,
          depth,
          radius,
          maxSlope
        });
      } catch (err: any) {
        throw ctx.wrapError(err);
      } finally {
        ctx.pop();
      }
    }
  }

  // ==========================================================================
  // PHASE 8: Process Offers (B5-002: Request/Offer Negotiation)
  // ==========================================================================

  if (yaml.offers && options?.sharedContext) {
    for (const [offerId, offerDef] of Object.entries(yaml.offers as Record<string, any>)) {
      try {
        ctx.push(`offers.${offerId}`);

        const evalCtx = createContext(builder, decisionValues);

        // Evaluate offer values
        const fulfilled = typeof offerDef.fulfilled === 'boolean'
          ? offerDef.fulfilled
          : (typeof offerDef.fulfilled === 'string' ? exprEvalCondition(offerDef.fulfilled, evalCtx) : true);

        const elevation = offerDef.elevation !== undefined
          ? (typeof offerDef.elevation === 'number' ? offerDef.elevation : exprEvalNumeric(String(offerDef.elevation), evalCtx))
          : undefined;

        const slope = offerDef.slope !== undefined
          ? (typeof offerDef.slope === 'number' ? offerDef.slope : exprEvalNumeric(String(offerDef.slope), evalCtx))
          : undefined;

        const slopeDirection = offerDef.slope_direction !== undefined
          ? (typeof offerDef.slope_direction === 'number' ? offerDef.slope_direction : exprEvalNumeric(String(offerDef.slope_direction), evalCtx))
          : undefined;

        // Evaluate position if provided
        let position: { x: number; y: number; z: number } | undefined;
        if (offerDef.position) {
          position = {
            x: typeof offerDef.position.x === 'number' ? offerDef.position.x : exprEvalNumeric(String(offerDef.position.x ?? '0'), evalCtx),
            y: typeof offerDef.position.y === 'number' ? offerDef.position.y : exprEvalNumeric(String(offerDef.position.y ?? '0'), evalCtx),
            z: typeof offerDef.position.z === 'number' ? offerDef.position.z : exprEvalNumeric(String(offerDef.position.z ?? '0'), evalCtx)
          };
        }

        // Publish offer to shared context
        options.sharedContext.publishOffer({
          requirementId: offerDef.for_requirement,
          publisher: yaml.name,
          fulfilled,
          elevation,
          slope,
          slopeDirection,
          boundaryLoop: offerDef.boundary_loop,
          position,
          data: offerDef.data
        });

        // Trace the offer
        builder.trace(`offer:${offerId}`, {
          forRequirement: offerDef.for_requirement,
          fulfilled,
          elevation,
          slope,
          slopeDirection,
          boundaryLoop: offerDef.boundary_loop,
          position
        });
      } catch (err: any) {
        throw ctx.wrapError(err);
      } finally {
        ctx.pop();
      }
    }
  }

  // ==========================================================================
  // PHASE 7: Constraint Evaluation (F1-002)
  // ==========================================================================

  const constraintResults: Array<{
    schema: string;
    passed: boolean;
    severity: 'error' | 'warning';
    results: Array<{ type: string; passed: boolean; message: string }>;
  }> = [];

  if (yaml.constraints && yaml.constraints.length > 0 && options?.constraintResolver) {
    ctx.push('constraints');
    try {
      const { ConstraintEvaluator } = await import('../validation/ConstraintEvaluator');

      for (const constraintRef of yaml.constraints) {
        ctx.push(constraintRef.schema);
        try {
          // Resolve the constraint schema
          const schema = options.constraintResolver(constraintRef.schema);
          if (!schema) {
            builder.addValidationIssue({
              severity: constraintRef.severity || 'error',
              message: `Constraint schema '${constraintRef.schema}' not found`,
              suggestion: 'Define the constraint schema using constraint.define command'
            });
            continue;
          }

          // Build bindings from builder context
          const bindings: Record<string, any> = {};
          for (const [varName, expr] of Object.entries(constraintRef.bindings)) {
            // Try to get from measurements first
            const measurement = builder.context.get(expr);
            if (measurement !== undefined) {
              bindings[varName] = measurement;
            } else if (decisionValues.has(expr)) {
              // Try decisions
              bindings[varName] = decisionValues.get(expr);
            } else {
              // Try to evaluate as expression
              try {
                const evalCtx = createContext(builder, decisionValues);
                bindings[varName] = exprEvalNumeric(String(expr), evalCtx);
              } catch {
                bindings[varName] = expr; // Use as-is if evaluation fails
              }
            }
          }

          // Evaluate the constraint
          const result = ConstraintEvaluator.evaluate(schema, bindings);
          const severity = constraintRef.severity || 'error';

          constraintResults.push({
            schema: constraintRef.schema,
            passed: result.passed,
            severity,
            results: result.results.map(r => ({
              type: r.rule.type,
              passed: r.passed,
              message: r.message
            }))
          });

          // Add validation issues for failed constraints
          if (!result.passed) {
            for (const ruleResult of result.results) {
              if (!ruleResult.passed) {
                builder.addValidationIssue({
                  severity,
                  message: `Constraint '${constraintRef.schema}' failed: ${ruleResult.message}`,
                  suggestion: constraintRef.description || `Check ${constraintRef.schema} constraint rules`
                });
              }
            }
          }

          // Trace the constraint result
          builder.trace(`constraint:${constraintRef.schema}`, {
            passed: result.passed,
            severity,
            bindings,
            results: result.results.length
          });

        } catch (err: any) {
          builder.addValidationIssue({
            severity: constraintRef.severity || 'error',
            message: `Error evaluating constraint '${constraintRef.schema}': ${err.message}`
          });
        } finally {
          ctx.pop();
        }
      }
    } finally {
      ctx.pop();
    }
  }

  // ==========================================================================
  // Build Output
  // ==========================================================================

  // F4-001: Evaluate cross-builder proportion rules from style
  if (activeStyle?.proportion_rules && builder.subBuilders.size > 0) {
    try {
      const {
        evaluateProportionRules,
        collectCrossBuilderMeasurements
      } = await import('../validation/ProportionRuleEvaluator');

      const crossMeasurements = collectCrossBuilderMeasurements(builder.subBuilders);
      const proportionResult = evaluateProportionRules(activeStyle.proportion_rules, crossMeasurements);

      // Add proportion warnings/errors to validation issues
      for (const warning of proportionResult.warnings) {
        builder.addValidationIssue({
          severity: 'warning',
          message: `Proportion rule failed: ${warning.rule}`,
          suggestion: warning.value !== undefined
            ? `Value is ${warning.value.toFixed(3)}, expected ${warning.expected || 'truthy'}`
            : warning.error
        });
      }

      for (const error of proportionResult.errors) {
        builder.addValidationIssue({
          severity: 'error',
          message: `Proportion rule error: ${error.rule}`,
          suggestion: error.value !== undefined
            ? `Value is ${error.value.toFixed(3)}, expected ${error.expected || 'truthy'}`
            : error.error
        });
      }
    } catch (err) {
      // Don't fail build on proportion evaluation errors
      builder.addValidationIssue({
        severity: 'warning',
        message: `Failed to evaluate proportion rules: ${(err as Error).message}`
      });
    }
  }

  const output = builder.build();

  // ==========================================================================
  // POST-BUILD: UV Atlas Repack for Composed Scenes (G3-004)
  // ==========================================================================
  // When sub-builders are composed, their UV islands overlap (each uses [0,1]
  // independently). Detect overlap and repack into a clean atlas.
  const atlasUvsSetting = yaml.atlas_uvs ?? 'auto';
  if (atlasUvsSetting !== false && output.subBuilders.size > 0) {
    const hasExistingUVs = output.mesh.vertices.some(
      (v: { attributes: { uv?: unknown } }) => v.attributes.uv !== undefined
    );

    if (hasExistingUVs) {
      let shouldRepack = atlasUvsSetting === true;

      if (atlasUvsSetting === 'auto') {
        const { detectUVOverlap } = await import('../../platform/geometry/UVUnwrapper');
        const overlap = detectUVOverlap(output.mesh);
        shouldRepack = overlap.hasOverlap;
      }

      if (shouldRepack) {
        const { unwrapMesh } = await import('../../platform/geometry/UVUnwrapper');
        const result = unwrapMesh(output.mesh, {
          margin: 0.02,
          normalize: true,
          preserveExistingUVs: true
        });
        output.mesh = result.mesh;
        output.validation.vertexCount = result.mesh.vertices.length;
        output.validation.faceCount = result.mesh.faces.length;
      }
    }
  }

  output.sceneGraph = sceneGraph;
  output.constraintResults = constraintResults;
  if (evaluatedTags) {
    output.tags = evaluatedTags;
  }

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
  materialSlots: Map<string, import('../../platform/materials/MaterialLibrary').MaterialSlot>,
  ctx: ParsingContext
): Promise<void> {
  // Create command context for registry-based handlers
  const createCommandContext = (): GeometryCommandContext => ({
    builder,
    decisionValues,
    materials,
    materialSlots,
    processGeometry: async (cmds: YamlGeometryCommand[]) => {
      await processGeometry(cmds, builder, decisionValues, materials, materialSlots, ctx);
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
  builderResolver: (name: string) => ((seed: number, overrides?: Record<string, any>) => TracedOutput | Promise<TracedOutput>) | null,
  seed?: number,
  parentStyle?: string,  // F2-002: Parent's style for inheritance
  lodBudget?: number,    // G2-001: LOD budget for children
  lodTierOverride?: number  // G2-001: Override child's target tier
): Promise<void> {
  // F3-001: Resolve builder name from role if specified
  let builderName = composition.builder;
  if (!builderName && composition.role) {
    const { resolveRole } = await import('./BuilderRoleRegistry');
    const effectiveStyle = composition.style || parentStyle;
    const resolution = await resolveRole(composition.role, effectiveStyle);
    if (!resolution) {
      throw new Error(`No builder found for role '${composition.role}'${effectiveStyle ? ` with style '${effectiveStyle}'` : ''}`);
    }
    builderName = resolution.builder;
  }

  if (!builderName) {
    throw new Error(`Composition '${instanceName}' must specify either 'builder' or 'role'`);
  }

  const childBuilderFn = builderResolver(builderName);
  if (!childBuilderFn) {
    throw new Error(`Builder '${builderName}' not found`);
  }

  // Prepare overrides - evaluate string expressions in parent context
  const childOverrides: Record<string, any> = {};
  if (composition.overrides) {
    for (const [key, value] of Object.entries(composition.overrides)) {
      if (typeof value === 'string') {
        // Check if it's a $decision reference
        if (value.startsWith('$')) {
          const decName = value.slice(1);
          if (decisionValues.has(decName)) {
            childOverrides[key] = decisionValues.get(decName);
          } else {
            // Try to get from builder context
            const ctxVal = builder.context.get(decName);
            childOverrides[key] = ctxVal !== undefined ? ctxVal : value;
          }
        } else {
          // Evaluate as expression in parent context
          try {
            childOverrides[key] = evaluateExpression(value, decisionValues, builder);
          } catch {
            // If evaluation fails, pass as-is (might be a choice string like "round")
            childOverrides[key] = value;
          }
        }
      } else {
        childOverrides[key] = value;
      }
    }
  }

  // F2-002: Pass style to child (composition override > parent style)
  const childStyle = composition.style || parentStyle;
  if (childStyle) {
    childOverrides.__style__ = childStyle;
  }

  // G2-001: Pass LOD budget to child
  if (lodBudget !== undefined && lodBudget !== Infinity) {
    childOverrides.__lod_budget__ = lodBudget;
  }

  // G2-001: Pass LOD tier override to child (affects target_tier in child builder)
  if (lodTierOverride !== undefined) {
    childOverrides.__lod_tier__ = lodTierOverride;
  }

  // Add constraints
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
  let offset = composition.offset ? {
    x: evaluatePositionComponent(composition.offset.x, builder),
    y: evaluatePositionComponent(composition.offset.y, builder),
    z: evaluatePositionComponent(composition.offset.z, builder)
  } : undefined;

  let rotation = composition.rotation ? {
    x: evaluatePositionComponent(composition.rotation.x, builder),
    y: evaluatePositionComponent(composition.rotation.y, builder),
    z: evaluatePositionComponent(composition.rotation.z, builder)
  } : undefined;

  // B5-001: Port-based attachment - compute offset/rotation from port alignment
  if (composition.attach_to) {
    const attachResult = await computePortAttachment(
      composition.attach_to,
      composition.my_port,
      builder,
      childBuilderFn,
      childOverrides,
      seed ?? 1
    );
    if (attachResult) {
      // Merge with any explicit offset/rotation (explicit takes precedence)
      offset = offset ?? attachResult.offset;
      rotation = rotation ?? attachResult.rotation;
    }
  }

  // Use TracedBuilder.compose which handles everything properly
  await builder.compose(instanceName, childBuilderFn, {
    offset,
    rotation,
    scale: composition.scale,
    overrides: childOverrides,
    asInstance: composition.asInstance
  });

  // E1-002: Handle skeleton from composed builder
  const childOutput = builder.subBuilders.get(instanceName);
  if (childOutput?.skeleton) {
    if (composition.skeleton_attach) {
      // Merge child skeleton into parent skeleton at specified joint
      builder.mergeSkeleton(
        instanceName,
        childOutput.skeleton,
        composition.skeleton_attach,
        {
          offset,
          rotation,
          scale: composition.scale
        }
      );
    } else if (!builder.getSkeleton()) {
      // H1-001: If parent has no skeleton and no attach point specified,
      // adopt the child's skeleton as the parent's skeleton (for root components like body)
      builder.adoptSkeleton(instanceName, childOutput.skeleton, {
        offset,
        rotation,
        scale: composition.scale
      });
    }
  }

  // Also mark if composed builders brought weights (used for determining if weight computation is needed)
  if (childOutput?.vertexWeights) {
    builder.hasComposedWeights = true;
  }

  // B5-003: Process blend zone if specified
  if (composition.blend_zone) {
    // Get child output from subBuilders (compose stores it there)
    const childOutput = builder.subBuilders.get(instanceName);
    if (childOutput) {
      await processBlendZone(
        composition.blend_zone,
        instanceName,
        builder,
        childOutput,
        decisionValues,
        offset,
        rotation,
        composition.scale
      );
    }
  }
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
        // Check for $parent. prefix (legacy)
        const refMatch = value.match(/^\$parent\.(.+)$/);
        if (refMatch) {
          const parentKey = refMatch[1];
          if (decisionValues.has(parentKey)) {
            resolvedOverrides[key] = decisionValues.get(parentKey);
          } else {
            const evaluated = builder.context.get(parentKey);
            if (evaluated !== undefined) resolvedOverrides[key] = evaluated;
          }
        } else if (value.startsWith('$')) {
          // Handle $decision reference
          const decName = value.slice(1);
          if (decisionValues.has(decName)) {
            resolvedOverrides[key] = decisionValues.get(decName);
          } else {
            // Try to get from builder context
            const ctxVal = builder.context.get(decName);
            resolvedOverrides[key] = ctxVal !== undefined ? ctxVal : value;
          }
        } else {
          // Try to evaluate as expression, otherwise pass as-is
          try {
            resolvedOverrides[key] = evaluateExpression(value, decisionValues, builder);
          } catch {
            resolvedOverrides[key] = value;
          }
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

// ============================================================================
// B5-003: BLEND ZONE PROCESSING
// ============================================================================

import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { EdgeLoop } from '../../platform/geometry/EdgeLoop';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { YamlBlendZone } from './YamlBuilderTypes';

/**
 * Process a blend zone between parent and child builder loops.
 *
 * The blend zone creates transition geometry between two loops using loft.
 */
async function processBlendZone(
  blendZone: YamlBlendZone,
  childInstanceName: string,
  parentBuilder: TracedBuilder,
  childOutput: TracedOutput,
  decisionValues: Map<string, any>,
  childOffset?: { x: number; y: number; z: number },
  childRotation?: { x: number; y: number; z: number },
  childScale?: number
): Promise<void> {
  // Get child's loop (my_loop is the loop in the child builder)
  const childLoopData = childOutput.loops.get(blendZone.my_loop);
  if (!childLoopData) {
    throw new Error(`Blend zone: loop '${blendZone.my_loop}' not found in child builder '${childInstanceName}'`);
  }

  // Resolve their_loop - can be "loop_name" (parent) or "builder.loop_name" (sibling)
  let parentLoopData: { indices: number[]; purpose: string } | undefined;
  let parentMesh = parentBuilder.mesh;

  const theirLoopParts = blendZone.their_loop.split('.');
  if (theirLoopParts.length === 1) {
    // Parent's loop
    parentLoopData = parentBuilder.loops.get(blendZone.their_loop);
    if (!parentLoopData) {
      throw new Error(`Blend zone: loop '${blendZone.their_loop}' not found in parent builder`);
    }
  } else {
    // Sibling builder's loop - format: "siblingName.loopName"
    const [siblingName, loopName] = theirLoopParts;
    const siblingOutput = parentBuilder.subBuilders.get(siblingName);
    if (!siblingOutput) {
      throw new Error(`Blend zone: sibling builder '${siblingName}' not found`);
    }
    parentLoopData = siblingOutput.loops.get(loopName);
    if (!parentLoopData) {
      throw new Error(`Blend zone: loop '${loopName}' not found in sibling builder '${siblingName}'`);
    }
    parentMesh = siblingOutput.mesh;
  }

  // Convert loop indices to EdgeLoop with actual vertex positions
  // Child loop - needs transform applied
  const childVertices: Vertex[] = [];
  for (const idx of childLoopData.indices) {
    const v = childOutput.mesh.vertices[idx];
    let pos = v.position.clone();

    // Apply child transform
    if (childScale && childScale !== 1) {
      pos = pos.mul(childScale);
    }
    if (childRotation) {
      pos = rotatePointEuler(pos, childRotation);
    }
    if (childOffset) {
      pos = pos.add(new Vec3(childOffset.x, childOffset.y, childOffset.z));
    }

    childVertices.push(new Vertex(pos));
  }
  const childLoop = new EdgeLoop(childVertices);

  // Parent loop - already in parent's coordinate space
  const parentVertices: Vertex[] = [];
  for (const idx of parentLoopData.indices) {
    const v = parentMesh.vertices[idx];
    parentVertices.push(new Vertex(v.position.clone()));
  }
  const parentLoop = new EdgeLoop(parentVertices);

  // Evaluate segments
  const segments = blendZone.segments !== undefined
    ? (typeof blendZone.segments === 'number'
        ? blendZone.segments
        : evaluateExpression(String(blendZone.segments), decisionValues, parentBuilder))
    : 1;

  // Create blend mesh
  const blendMesh = MeshOperations.createBlendZone(parentLoop, childLoop, {
    segments,
    alignLoops: blendZone.align !== false
  });

  // Merge blend mesh into parent builder
  const vertexMap = new Map<number, number>();
  for (let i = 0; i < blendMesh.vertices.length; i++) {
    const v = blendMesh.vertices[i];
    const newIndex = parentBuilder.mesh.addVertex(v);
    vertexMap.set(i, newIndex);
  }

  for (const blendFace of blendMesh.faces) {
    const newIndices = blendFace.indices.map(idx => vertexMap.get(idx)!);
    parentBuilder.mesh.addFace(new Face(newIndices));
  }

  // Add trace
  parentBuilder.trace(`blend_zone:${childInstanceName}`, {
    myLoop: blendZone.my_loop,
    theirLoop: blendZone.their_loop,
    method: blendZone.method || 'loft',
    segments,
    verticesAdded: blendMesh.vertices.length,
    facesAdded: blendMesh.faces.length
  });
}

/**
 * Rotate a point using Euler angles (Y-X-Z order)
 */
function rotatePointEuler(p: Vec3, rotation: { x: number; y: number; z: number }): Vec3 {
  let { x, y, z } = { x: p.x, y: p.y, z: p.z };

  // Rotate around Y axis
  if (rotation.y !== 0) {
    const cosY = Math.cos(rotation.y);
    const sinY = Math.sin(rotation.y);
    const nx = x * cosY + z * sinY;
    const nz = -x * sinY + z * cosY;
    x = nx;
    z = nz;
  }

  // Rotate around X axis
  if (rotation.x !== 0) {
    const cosX = Math.cos(rotation.x);
    const sinX = Math.sin(rotation.x);
    const ny = y * cosX - z * sinX;
    const nz = y * sinX + z * cosX;
    y = ny;
    z = nz;
  }

  // Rotate around Z axis
  if (rotation.z !== 0) {
    const cosZ = Math.cos(rotation.z);
    const sinZ = Math.sin(rotation.z);
    const nx = x * cosZ - y * sinZ;
    const ny = x * sinZ + y * cosZ;
    x = nx;
    y = ny;
  }

  return new Vec3(x, y, z);
}

// ============================================================================
// B5-001: PORT-BASED ATTACHMENT
// ============================================================================

/**
 * Compute offset and rotation to attach child port to parent/sibling port.
 *
 * @param attachTo Target port reference: "port_name" for parent, "sibling.port_name" for sibling
 * @param myPort Child's port name (optional, defaults to first port or origin)
 * @param parentBuilder The parent builder
 * @param childBuilderFn Function to build the child
 * @param childOverrides Overrides for child builder
 * @param seed Random seed
 * @returns Computed offset and rotation, or undefined if ports not found
 */
async function computePortAttachment(
  attachTo: string,
  myPort: string | undefined,
  parentBuilder: TracedBuilder,
  childBuilderFn: (seed: number, overrides?: Record<string, any>) => TracedOutput | Promise<TracedOutput>,
  childOverrides: Record<string, any>,
  seed: number
): Promise<{ offset: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number } } | undefined> {

  // Parse the attach_to reference
  let targetPort: { position: Vec3; normal: Vec3; up?: Vec3 } | undefined;

  if (attachTo.includes('.')) {
    // Sibling reference: "sibling_name.port_name"
    const [siblingName, portName] = attachTo.split('.');
    const siblingOutput = parentBuilder.subBuilders.get(siblingName);
    if (siblingOutput?.ports) {
      const port = siblingOutput.ports.get(portName);
      if (port) {
        targetPort = {
          position: port.position.clone(),
          normal: port.normal.clone(),
          up: port.up?.clone()
        };
      }
    }
  } else {
    // Parent port reference
    const parentPorts = parentBuilder.getPorts();
    const port = parentPorts.get(attachTo);
    if (port) {
      targetPort = {
        position: port.position.clone(),
        normal: port.normal.clone(),
        up: port.up?.clone()
      };
    }
  }

  if (!targetPort) {
    console.warn(`[attach_to] Target port '${attachTo}' not found`);
    return undefined;
  }

  // Build child to get its ports
  const childOutput = await childBuilderFn(seed ?? 1, childOverrides);

  // Find the child's port to use for attachment
  let sourcePort: { position: Vec3; normal: Vec3; up?: Vec3 } | undefined;

  if (childOutput.ports && childOutput.ports.size > 0) {
    let portData: { position: Vec3; normal: Vec3; up?: Vec3 } | undefined;

    if (myPort) {
      const p = childOutput.ports.get(myPort);
      if (p) {
        portData = { position: p.position.clone(), normal: p.normal.clone(), up: p.up?.clone() };
      }
    } else {
      // Default to first port
      const firstPort = childOutput.ports.values().next().value;
      if (firstPort) {
        portData = { position: firstPort.position.clone(), normal: firstPort.normal.clone(), up: firstPort.up?.clone() };
      }
    }

    if (portData) {
      sourcePort = portData;
    }
  }

  if (!sourcePort) {
    // Default: use origin with Y-up normal
    sourcePort = {
      position: new Vec3(0, 0, 0),
      normal: new Vec3(0, 1, 0),
      up: new Vec3(0, 0, 1)
    };
  }

  // Compute rotation to align normals (child normal should face opposite to target normal)
  // For now, we do a simple Y-rotation alignment for horizontal surfaces
  // Full 3D rotation would require quaternions or axis-angle computation

  const rotation = computePortRotation(sourcePort.normal, targetPort.normal.mul(-1));

  // Compute offset: position child so its port aligns with target port
  // After rotation, the child's port moves - we need to account for that
  const rotatedSourcePos = rotatePointEuler(sourcePort.position, rotation);
  const offset = {
    x: targetPort.position.x - rotatedSourcePos.x,
    y: targetPort.position.y - rotatedSourcePos.y,
    z: targetPort.position.z - rotatedSourcePos.z
  };

  return { offset, rotation };
}

/**
 * Compute Euler rotation to align sourceNormal to targetNormal.
 * Simplified version that handles common cases (horizontal/vertical surfaces).
 */
function computePortRotation(
  sourceNormal: Vec3,
  targetNormal: Vec3
): { x: number; y: number; z: number } {
  // Normalize both vectors
  const src = sourceNormal.normalize();
  const tgt = targetNormal.normalize();

  // Simple case: if normals are already aligned, no rotation needed
  const dot = src.x * tgt.x + src.y * tgt.y + src.z * tgt.z;
  if (Math.abs(dot - 1) < 0.001) {
    return { x: 0, y: 0, z: 0 };
  }

  // Simple case: both pointing up (Y+), no rotation
  if (Math.abs(src.y - 1) < 0.001 && Math.abs(tgt.y - 1) < 0.001) {
    return { x: 0, y: 0, z: 0 };
  }

  // Simple case: source is Y+, target is in XZ plane (horizontal surface)
  if (Math.abs(src.y - 1) < 0.001 && Math.abs(tgt.y) < 0.001) {
    // Need to rotate 90° around appropriate axis
    const angle = Math.atan2(tgt.x, tgt.z);
    return { x: Math.PI / 2, y: angle, z: 0 };
  }

  // Simple case: source is Y-, need to flip 180° around X
  if (Math.abs(src.y + 1) < 0.001 && Math.abs(tgt.y - 1) < 0.001) {
    return { x: Math.PI, y: 0, z: 0 };
  }

  // General case: compute Y rotation for XZ alignment, then X rotation for Y alignment
  const srcXZ = Math.sqrt(src.x * src.x + src.z * src.z);
  const tgtXZ = Math.sqrt(tgt.x * tgt.x + tgt.z * tgt.z);

  let yRot = 0;
  if (srcXZ > 0.001 && tgtXZ > 0.001) {
    const srcAngle = Math.atan2(src.x, src.z);
    const tgtAngle = Math.atan2(tgt.x, tgt.z);
    yRot = tgtAngle - srcAngle;
  }

  // X rotation to match vertical component
  let xRot = 0;
  const srcPitch = Math.atan2(src.y, srcXZ);
  const tgtPitch = Math.atan2(tgt.y, tgtXZ);
  xRot = tgtPitch - srcPitch;

  return { x: xRot, y: yRot, z: 0 };
}
