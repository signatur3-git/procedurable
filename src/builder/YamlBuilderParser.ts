/**
 * YamlBuilderParser - Parse YAML builder definitions and execute them
 *
 * Converts declarative YAML to TracedBuilder method calls.
 */

import { TracedBuilder, TracedOutput } from './TracedBuilder';
import { Vec3 } from '../core/Vec3';
import { evaluate as mathEvaluate } from '../core/MathService';
import { lathe as latheGeometry, sweep as sweepGeometry, Profile, Profiles } from '../geometry/Sweep';
import { Spline } from '../core/Spline';
import { subdivideCatmullClark } from '../geometry/Subdivision';

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

  decisions?: Record<string, YamlDecision>;
  measurements?: Record<string, YamlMeasurement>;
  derived?: Record<string, string>;
  materials?: Record<string, YamlMaterial>;  // Named colors/materials
  profiles?: Record<string, YamlProfile>;    // 2D profile definitions for lathe/sweep
  splines?: Record<string, YamlSpline>;      // 3D spline paths for sweep
  geometry?: YamlGeometryCommand[];
  compose?: Record<string, YamlComposition>;
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
  | { vertex: string; position: YamlPosition }
  | { circle: string; center: YamlPosition; radius: string | number; segments: number | string; purpose: string; normal: number[] }
  | { loop: string; type: string; vertices: string[]; purpose: string }
  | { face: string; vertices?: string[]; loop?: string; flip?: boolean; color?: YamlColor }
  | { loft: string; from: string; to: string; color?: YamlColor }
  | { cap: string; loop: string; flip?: boolean; color?: YamlColor }
  | { when: string; geometry: YamlGeometryCommand[] }
  // Control flow constructs
  | { repeat: number | string; as: string; geometry: YamlGeometryCommand[] }
  | { if: string; then: YamlGeometryCommand[]; else?: YamlGeometryCommand[] }
  // Advanced geometry commands (P2-M1b)
  | { lathe: string; profile: string; segments?: number | string; angle?: number | string; axis?: 'y' | 'x' | 'z'; color?: YamlColor | string }
  | { sweep: string; profile: string; path: string; segments?: number | string; twist?: number | string; scaleStart?: number | string; scaleEnd?: number | string; color?: YamlColor | string }
  | { subdivide: string; mesh?: string; iterations?: number };

/**
 * Composition definition
 */
export interface YamlComposition {
  builder: string;
  offset?: YamlPosition;
  rotation?: YamlPosition;
  scale?: number;
  overrides?: Record<string, any>;
}

// ============================================================================
// PARSER
// ============================================================================

export interface ParseOptions {
  seed?: number;
  overrides?: Record<string, any>;
  builderResolver?: (name: string) => ((seed: number, overrides?: Record<string, any>) => TracedOutput) | null;
}

/**
 * Parse and execute a YAML builder definition
 */
export function parseAndExecuteBuilder(
  yaml: YamlBuilderDefinition,
  options?: ParseOptions
): TracedOutput {
  const seed = options?.seed;
  const overrides = options?.overrides ?? {};

  const builder = new TracedBuilder(yaml.name, seed, overrides);

  // Track decision values for conditional logic
  const decisionValues = new Map<string, any>();

  // ==========================================================================
  // PHASE 1: Process Decisions
  // ==========================================================================

  if (yaml.decisions) {
    for (const [name, decision] of Object.entries(yaml.decisions)) {
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
          value = builder.decideNumber(name, decision.min, decision.max, decision.default);
          break;

        case 'boolean':
          value = builder.decideBoolean(name, decision.probability);
          break;

        case 'count':
          value = builder.decideCount(name, decision.min, decision.max);
          break;
      }

      decisionValues.set(name, value);
    }
  }

  // ==========================================================================
  // PHASE 2: Process Measurements
  // ==========================================================================

  if (yaml.measurements) {
    for (const [name, measurement] of Object.entries(yaml.measurements)) {
      let value: number;

      if (measurement.value !== undefined) {
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

      // Apply conditionals
      if (measurement.conditional) {
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

  // ==========================================================================
  // PHASE 3: Process Derived Values
  // ==========================================================================

  if (yaml.derived) {
    for (const [name, expression] of Object.entries(yaml.derived)) {
      builder.defineDerived(name, expression);
    }
  }

  // ==========================================================================
  // PHASE 4: Process Geometry
  // ==========================================================================

  if (yaml.geometry) {
    try {
      processGeometry(yaml.geometry, builder, decisionValues, materials);
    } catch (err: any) {
      throw new Error(`Geometry processing failed: ${err.message}`);
    }
  }

  // ==========================================================================
  // PHASE 5: Process Compositions
  // ==========================================================================

  if (yaml.compose && options?.builderResolver) {
    for (const [instanceName, composition] of Object.entries(yaml.compose)) {
      const subBuilderFn = options.builderResolver(composition.builder);
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

      builder.compose(instanceName, subBuilderFn, {
        offset,
        rotation,
        scale: composition.scale,
        overrides: resolvedOverrides
      });
    }
  }

  return builder.build();
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

function processGeometry(
  commands: YamlGeometryCommand[],
  builder: TracedBuilder,
  decisionValues: Map<string, any>,
  materials: Map<string, { r: number; g: number; b: number }> = new Map()
): void {
  for (let cmdIndex = 0; cmdIndex < commands.length; cmdIndex++) {
    const cmd = commands[cmdIndex];

    try {
      // Comment - skip
      if ('comment' in cmd) {
        continue;
      }

      // Conditional geometry (legacy 'when' syntax)
      if ('when' in cmd) {
        if (evaluateCondition(cmd.when, decisionValues)) {
          processGeometry(cmd.geometry, builder, decisionValues, materials);
        }
        continue;
      }

      // If/else block - mutually exclusive geometry
      if ('if' in cmd) {
        const ifCmd = cmd as { if: string; then: YamlGeometryCommand[]; else?: YamlGeometryCommand[] };
        if (evaluateCondition(ifCmd.if, decisionValues)) {
          processGeometry(ifCmd.then, builder, decisionValues, materials);
        } else if (ifCmd.else) {
          processGeometry(ifCmd.else, builder, decisionValues, materials);
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
          processGeometry(repeatCmd.geometry, builder, decisionValues, materials);

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
    } catch (err: any) {
      // Get command type for error message
      const cmdType = Object.keys(cmd)[0] || 'unknown';
      const cmdName = (cmd as any)[cmdType] || '';
      throw new Error(`Error at geometry command #${cmdIndex + 1} (${cmdType}: ${cmdName}): ${err.message}`);
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
  // Simple condition parser: "name == value" or "name != value"
  const eqMatch = condition.match(/(\w+)\s*==\s*["']?(\w+)["']?/);
  if (eqMatch) {
    const [, name, expected] = eqMatch;
    return values.get(name) === expected;
  }

  const neqMatch = condition.match(/(\w+)\s*!=\s*["']?(\w+)["']?/);
  if (neqMatch) {
    const [, name, expected] = neqMatch;
    return values.get(name) !== expected;
  }

  // Boolean check
  if (values.has(condition)) {
    return Boolean(values.get(condition));
  }

  console.warn(`Unknown condition format: ${condition}`);
  return false;
}

function evaluateExpression(expr: string, values: Map<string, any>, builder: TracedBuilder): number {
  // Build variables object from decision values and builder context
  const variables: Record<string, number> = {};

  // Add decision values
  for (const [name, value] of values.entries()) {
    if (typeof value === 'number') {
      variables[name] = value;
    }
  }

  // Add measurements and derived values from builder context
  const contextVars = builder.context.toObject();
  for (const [name, value] of Object.entries(contextVars)) {
    variables[name] = value;
  }

  try {
    // Use MathService for proper math evaluation (includes sin, cos, pi, etc.)
    const result = mathEvaluate(expr, variables);
    return result.value;
  } catch (e: any) {
    throw new Error(`Failed to evaluate expression '${expr}': ${e.message}`);
  }
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

