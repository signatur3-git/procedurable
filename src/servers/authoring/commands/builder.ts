/**
 * Builder Commands
 *
 * Commands for managing and running builders:
 *   builder.list
 *   builder.open <name>
 *   builder.run [seed=<n>]
 *   builder.info
 */

import { CommandNamespace, CommandHandler, CommandContext, CommandResult } from '../command-registry';
import { ParsedCommand, getArg, getNumberArg } from '../command-parser';
import { storage } from './storage';
import { validateBuilder, evaluateQualityTier, testDecisionCoverage, compareSophisticationPlan } from '../../../generation/validation/ValidationAPI';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { parseYamlWithLibrary, parseAndExecuteBuilder } from '../../../generation/builder/YamlBuilderParser';

// TypeScript builders that can't be migrated to YAML yet
// Person requires advanced geometry (subdivision, lathe) - Phase 2
const TYPESCRIPT_BUILDERS = [
  {
    name: 'Person',
    description: 'Procedural human figure using advanced geometry (Phase 2)',
    measurements: ['total_height', 'head_height'],
    decisions: ['body_type', 'gender_shape', 'head_shape'],
    source: 'typescript'
  }
];

// =============================================================================
// B4-001: Builder Template Generation
// =============================================================================

interface DomainTemplate {
  decisions: Array<{ name: string; type: string; options?: string[]; default?: string }>;
  measurements: Array<{ name: string; value: number; source: string }>;
  parts: string[];
  geometryHint: string;
  derived: string;
  geometryPlaceholder: string;
}

const DOMAIN_TEMPLATES: Record<string, DomainTemplate> = {
  furniture: {
    decisions: [
      { name: 'style', type: 'choice', options: ['modern', 'rustic', 'industrial'], default: 'modern' },
      { name: 'wood_type', type: 'choice', options: ['oak', 'walnut', 'pine', 'maple'], default: 'oak' },
      { name: 'finish', type: 'choice', options: ['natural', 'stained', 'painted'], default: 'natural' }
    ],
    measurements: [
      { name: 'height', value: 0.75, source: 'Standard furniture height' },
      { name: 'width', value: 0.50, source: 'Standard furniture width' },
      { name: 'depth', value: 0.50, source: 'Standard furniture depth' },
      { name: 'leg_thickness', value: 0.04, source: 'Structural requirement' }
    ],
    parts: ['top', 'legs', 'frame'],
    geometryHint: '# TODO: Add box, lathe, or extrude commands for furniture parts',
    derived: 'half_width: "width / 2"\n  half_depth: "depth / 2"',
    geometryPlaceholder: `- box:
      name: placeholder_box
      center: { x: "0", y: "height / 2", z: "0" }
      size: { x: "width", y: "height", z: "depth" }
      color: primary`
  },
  vessel: {
    decisions: [
      { name: 'vessel_style', type: 'choice', options: ['classical', 'modern', 'organic'], default: 'classical' },
      { name: 'material', type: 'choice', options: ['ceramic', 'glass', 'metal'], default: 'ceramic' },
      { name: 'surface', type: 'choice', options: ['smooth', 'textured', 'ribbed'], default: 'smooth' }
    ],
    measurements: [
      { name: 'total_height', value: 0.25, source: 'Standard vase height' },
      { name: 'base_radius', value: 0.04, source: 'Base size' },
      { name: 'body_radius', value: 0.08, source: 'Body width' },
      { name: 'neck_radius', value: 0.03, source: 'Neck opening' },
      { name: 'wall_thickness', value: 0.003, source: 'Material thickness' }
    ],
    parts: ['base', 'body', 'neck', 'rim'],
    geometryHint: '# TODO: Use lathe with profile points to create vessel shape',
    derived: 'half_height: "total_height / 2"\n  body_diameter: "body_radius * 2"',
    geometryPlaceholder: `- box:
      name: placeholder_body
      center: { x: "0", y: "total_height / 2", z: "0" }
      size: { x: "body_radius * 2", y: "total_height", z: "body_radius * 2" }
      color: primary`
  },
  signage: {
    decisions: [
      { name: 'sign_style', type: 'choice', options: ['modern', 'vintage', 'industrial'], default: 'modern' },
      { name: 'mount_type', type: 'choice', options: ['wall', 'standing', 'hanging'], default: 'wall' },
      { name: 'text_style', type: 'choice', options: ['raised', 'engraved', 'flat'], default: 'raised' }
    ],
    measurements: [
      { name: 'width', value: 0.40, source: 'Sign width' },
      { name: 'height', value: 0.15, source: 'Sign height' },
      { name: 'depth', value: 0.02, source: 'Sign thickness' },
      { name: 'text_depth', value: 0.005, source: 'Text extrusion depth' },
      { name: 'margin', value: 0.02, source: 'Text margin from edge' }
    ],
    parts: ['backing', 'text', 'frame'],
    geometryHint: '# TODO: Use text command with extrude for signage',
    derived: 'half_width: "width / 2"\n  half_height: "height / 2"',
    geometryPlaceholder: `- box:
      name: backing
      center: { x: "0", y: "height / 2", z: "0" }
      size: { x: "width", y: "height", z: "depth" }
      color: primary`
  },
  mechanical: {
    decisions: [
      { name: 'mechanism_type', type: 'choice', options: ['gear', 'lever', 'cam', 'linkage'], default: 'gear' },
      { name: 'material', type: 'choice', options: ['steel', 'brass', 'aluminum'], default: 'steel' },
      { name: 'finish', type: 'choice', options: ['polished', 'brushed', 'raw'], default: 'brushed' }
    ],
    measurements: [
      { name: 'diameter', value: 0.10, source: 'Overall diameter' },
      { name: 'thickness', value: 0.01, source: 'Part thickness' },
      { name: 'bore_diameter', value: 0.01, source: 'Center bore size' },
      { name: 'tooth_count', value: 16, source: 'Number of teeth/features' }
    ],
    parts: ['body', 'teeth', 'bore', 'hub'],
    geometryHint: '# TODO: Use radial_array and boolean operations for mechanical parts',
    derived: 'radius: "diameter / 2"\n  bore_radius: "bore_diameter / 2"',
    geometryPlaceholder: `- box:
      name: placeholder_body
      center: { x: "0", y: "thickness / 2", z: "0" }
      size: { x: "diameter", y: "thickness", z: "diameter" }
      color: primary`
  }
};

function generateBuilderTemplate(name: string, domain: string, description: string): string {
  const template = DOMAIN_TEMPLATES[domain];
  if (!template) {
    throw new Error(`Unknown domain: ${domain}`);
  }

  // Build decisions section
  const decisionsYaml = template.decisions.map(d => {
    let decisionStr = `  ${d.name}:\n    type: ${d.type}`;
    if (d.options) {
      decisionStr += `\n    options: [${d.options.join(', ')}]`;
    }
    if (d.default) {
      decisionStr += `\n    default: ${d.default}`;
    }
    return decisionStr;
  }).join('\n');

  // Build measurements section
  const measurementsYaml = template.measurements.map(m =>
    `  ${m.name}:\n    value: ${m.value}\n    source: "${m.source}"`
  ).join('\n');

  // Build quality section
  const partsYaml = template.parts.map(p => `      ${p}: placeholder`).join('\n');

  const yaml = `version: "1.0"
name: ${name}
description: "${description}"

# Quality declaration (A1-001)
quality:
  target_tier: 2
  current_tier: 0
  tier_gaps:
    - "Geometry not yet implemented"
    - "Decisions declared but not connected to geometry"
  parts:
${partsYaml}
  decision_coverage: 0%

# Decisions - these should affect the final geometry
decisions:
${decisionsYaml}

# Measurements - all dimensions in meters
measurements:
${measurementsYaml}

# Derived values - computed from measurements and decisions
derived:
  ${template.derived}

# Materials - named materials for geometry commands
materials:
  primary:
    color: { r: 0.6, g: 0.5, b: 0.4 }
    roughness: 0.6

# Geometry - procedural generation commands
geometry:
  ${template.geometryHint}
  ${template.geometryPlaceholder}
`;

  return yaml;
}

const handlers: CommandHandler[] = [
  {
    action: 'list',
    description: 'List all available builders (TypeScript + YAML)',
    usage: 'builder.list',
    execute: async (_cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      // Start with TypeScript builders
      const builders = [...TYPESCRIPT_BUILDERS];

      // Add YAML builders from storage
      try {
        const yamlBuilders = await storage.list();
        for (const meta of yamlBuilders.builders) {
          builders.push({
            name: meta.name,
            description: meta.description || 'YAML builder',
            measurements: [],  // Would need to parse YAML to get these
            decisions: [],
            source: 'yaml'
          });
        }
      } catch (e) {
        // Storage may not be available, continue with TypeScript builders only
      }

      return {
        success: true,
        data: { builders }
      };
    }
  },

  {
    action: 'open',
    description: 'Open a builder for editing/running',
    usage: 'builder.open <name> [source=yaml|typescript]',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0, 'name');
      const preferredSource = cmd.options['source']; // Optional: force yaml or typescript

      if (!name) {
        return { success: false, error: 'Missing builder name. Usage: builder.open <name> [source=yaml|typescript]' };
      }

      // Check both sources
      const tsBuilderNames = TYPESCRIPT_BUILDERS.map(b => b.name);
      const isTypeScript = tsBuilderNames.includes(name);
      let isYaml = false;

      try {
        isYaml = await storage.exists(name);
      } catch {
        // Storage check failed, assume not YAML
      }

      // Determine which source to use
      let useYaml: boolean;
      if (preferredSource === 'yaml') {
        if (!isYaml) {
          return { success: false, error: `No YAML builder named '${name}'. Use storage.list to see YAML builders.` };
        }
        useYaml = true;
      } else if (preferredSource === 'typescript') {
        if (!isTypeScript) {
          return { success: false, error: `No TypeScript builder named '${name}'. Available: ${tsBuilderNames.join(', ')}` };
        }
        useYaml = false;
      } else {
        // Default: prefer YAML (supports migration from TypeScript to YAML)
        if (isYaml) {
          useYaml = true;
        } else if (isTypeScript) {
          useYaml = false;
        } else {
          return { success: false, error: `Unknown builder: ${name}. Use 'builder.list' to see available builders.` };
        }
      }

      ctx.activeBuilder = name;
      ctx.activeBuilderSource = useYaml ? 'yaml' : 'typescript';

      ctx.broadcast({
        type: 'builder_opened',
        builder: name,
        source: useYaml ? 'yaml' : 'typescript'
      });

      return {
        success: true,
        data: {
          builder: name,
          source: useYaml ? 'yaml' : 'typescript',
          message: `Opened builder: ${name}`
        }
      };
    }
  },

  {
    action: 'run',
    description: 'Run the active builder with optional seed',
    usage: 'builder.run [seed=<n>] [<seed>]',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.activeBuilder) {
        return { success: false, error: 'No builder is open. Use builder.open <name> first.' };
      }

      // Get seed from args or options
      let seed = getNumberArg(cmd, 0, 'seed');
      if (seed === undefined) {
        seed = Date.now();
      }

      // Get overrides if any
      const overrides: Record<string, any> = {};
      for (const [key, value] of Object.entries(cmd.options)) {
        if (key !== 'seed') {
          // Try to parse as number
          const num = parseFloat(value);
          overrides[key] = isNaN(num) ? value : num;
        }
      }

      try {
        const result = await ctx.runBuilder(ctx.activeBuilder, seed, overrides, ctx.activeBuilderSource || undefined);
        ctx.lastRun = result;
        ctx.runHistory.push(result);

        // Keep history limited
        if (ctx.runHistory.length > 20) {
          ctx.runHistory.shift();
        }

        ctx.broadcast({
          type: 'builder_run',
          builder: ctx.activeBuilder,
          seed,
          summary: {
            vertices: result.validation.vertexCount,
            faces: result.validation.faceCount,
            issues: result.validation.issues.length,
            // A2-003: Include quality tier in broadcast
            quality: result.qualityGateResult ? {
              target_tier: result.qualityGateResult.target_tier,
              achieved_tier: result.qualityGateResult.achieved_tier
            } : undefined
          }
        });

        // Return summary
        const decisions: Record<string, any> = {};
        for (const [key, d] of result.decisions) {
          decisions[key] = { value: d.value, source: d.source };
        }

        // A2-003: Build quality summary for response
        const qualitySummary = result.qualityGateResult ? {
          target_tier: result.qualityGateResult.target_tier,
          achieved_tier: result.qualityGateResult.achieved_tier,
          gates_passed: result.qualityGateResult.summary.passed,
          gates_failed: result.qualityGateResult.summary.failed,
          suggestion_count: result.qualityGateResult.suggestions?.length ?? 0
        } : undefined;

        return {
          success: true,
          data: {
            builder: ctx.activeBuilder,
            seed,
            vertices: result.validation.vertexCount,
            faces: result.validation.faceCount,
            bounds: {
              width: result.validation.bounds.size.x.toFixed(3) + 'm',
              height: result.validation.bounds.size.y.toFixed(3) + 'm',
              depth: result.validation.bounds.size.z.toFixed(3) + 'm'
            },
            decisions,
            issues: result.validation.issues.length,
            traces: result.traces.size,
            // A2-003: Include quality summary in response
            quality: qualitySummary
          }
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Build failed: ${err.message}`
        };
      }
    }
  },

  {
    action: 'info',
    description: 'Get info about the active builder',
    usage: 'builder.info',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.activeBuilder) {
        return { success: false, error: 'No builder is open. Use builder.open <name> first.' };
      }

      // Return info about active builder and last run
      return {
        success: true,
        data: {
          activeBuilder: ctx.activeBuilder,
          hasLastRun: ctx.lastRun !== null,
          historyCount: ctx.runHistory.length,
          lastRunSeed: ctx.lastRun?.seed
        }
      };
    }
  },

  {
    action: 'measurements',
    description: 'Get measurements from the last run',
    usage: 'builder.measurements',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.lastRun) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const measurements: Record<string, any> = {};
      for (const [key, m] of ctx.lastRun.measurements) {
        measurements[key] = { value: m.value, source: m.source };
      }

      return {
        success: true,
        data: { measurements }
      };
    }
  },

  {
    action: 'decisions',
    description: 'Get decisions from the last run',
    usage: 'builder.decisions',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.lastRun) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const decisions: Record<string, any> = {};
      for (const [key, d] of ctx.lastRun.decisions) {
        decisions[key] = {
          value: d.value,
          source: d.source,
          options: d.options,
          weights: d.weights
        };
      }

      return {
        success: true,
        data: { decisions }
      };
    }
  },

  {
    action: 'traces',
    description: 'List trace keys from the last run',
    usage: 'builder.traces [filter=<prefix>]',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.lastRun) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      let keys: string[] = Array.from(ctx.lastRun.traces.keys());
      const filter = getArg(cmd, 0, 'filter');

      if (filter) {
        keys = keys.filter(k => k.startsWith(filter));
      }

      return {
        success: true,
        data: {
          count: keys.length,
          keys
        }
      };
    }
  },

  {
    action: 'trace',
    description: 'Get a specific trace entry',
    usage: 'builder.trace <key>',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.lastRun) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const key = getArg(cmd, 0, 'key');
      if (!key) {
        return { success: false, error: 'Missing trace key. Usage: builder.trace <key>' };
      }

      const trace = ctx.lastRun.traces.get(key);
      if (!trace) {
        return { success: false, error: `Trace not found: ${key}` };
      }

      return {
        success: true,
        data: { key, trace }
      };
    }
  },

  {
    action: 'mesh',
    description: 'Get serialized mesh geometry from the last run (for rendering)',
    usage: 'builder.mesh',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.lastRun) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const mesh = ctx.lastRun.mesh;
      if (!mesh) {
        return { success: false, error: 'No mesh in last run' };
      }

      // Triangulate for rendering
      const triangulated = mesh.triangulate();

      // Serialize vertices
      const vertices: number[] = [];
      const normals: number[] = [];
      const colors: number[] = [];
      const uvs: number[] = [];
      let hasColors = false;
      let hasUVs = false;

      // Default color (wood brown)
      const defaultColor = { r: 0.545, g: 0.353, b: 0.169 };

      // C3-002: Helper to resolve face color from material slots or vertex colors
      const resolveFaceColor = (face: typeof triangulated.faces[0]) => {
        // Priority 1: Material slot (C3-001 material slot system)
        if (face.materialSlotIndex !== undefined && face.materialSlotIndex >= 0) {
          const slot = triangulated.materialSlots[face.materialSlotIndex];
          if (slot) {
            return { color: slot.color, hasColor: true };
          }
        }
        // Priority 2: Vertex colors (legacy fallback)
        if (face.color) {
          return { color: face.color, hasColor: true };
        }
        // Priority 3: Default color
        return { color: defaultColor, hasColor: false };
      };

      for (const face of triangulated.faces) {
        // Get face vertices
        const vert0 = triangulated.vertices[face.indices[0]];
        const vert1 = triangulated.vertices[face.indices[1]];
        const vert2 = triangulated.vertices[face.indices[2]];

        const v0 = vert0.position;
        const v1 = vert1.position;
        const v2 = vert2.position;

        // Calculate face normal
        const edge1 = v1.sub(v0);
        const edge2 = v2.sub(v0);
        const faceNormal = edge1.cross(edge2).normalize();

        // Add each vertex with the face normal (for flat shading)
        vertices.push(v0.x, v0.y, v0.z);
        vertices.push(v1.x, v1.y, v1.z);
        vertices.push(v2.x, v2.y, v2.z);

        normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
        normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
        normals.push(faceNormal.x, faceNormal.y, faceNormal.z);

        // C3-002: Resolve color from material slots or vertex colors
        const { color, hasColor } = resolveFaceColor(face);
        if (hasColor) hasColors = true;

        colors.push(color.r, color.g, color.b);
        colors.push(color.r, color.g, color.b);
        colors.push(color.r, color.g, color.b);

        // C4-002: Extract UVs if available
        const uv0 = vert0.attributes.uv || [0, 0];
        const uv1 = vert1.attributes.uv || [0, 0];
        const uv2 = vert2.attributes.uv || [0, 0];
        if (vert0.attributes.uv || vert1.attributes.uv || vert2.attributes.uv) {
          hasUVs = true;
        }
        uvs.push(uv0[0], uv0[1]);
        uvs.push(uv1[0], uv1[1]);
        uvs.push(uv2[0], uv2[1]);
      }

      return {
        success: true,
        data: {
          vertices,
          normals,
          colors: hasColors ? colors : undefined,  // Only include if custom colors used
          uvs: hasUVs ? uvs : undefined,  // C4-002: Only include if UVs present
          vertexCount: vertices.length / 3,
          triangleCount: vertices.length / 9,
          bounds: ctx.lastRun.validation.bounds,
          hasColors,
          hasUVs
        }
      };
    }
  },

  {
    action: 'instances',
    description: 'Get instance data from the last run (for non-merged compositions)',
    usage: 'builder.instances',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.lastRun) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      if (!ctx.lastRun.instances || ctx.lastRun.instances.length === 0) {
        return {
          success: true,
          data: {
            count: 0,
            instances: [],
            message: 'No instances in output (all geometry was merged)'
          }
        };
      }

      return {
        success: true,
        data: {
          count: ctx.lastRun.instances.length,
          instances: ctx.lastRun.instances
        }
      };
    }
  },

  {
    action: 'get_interface',
    description: 'Get detailed interface for a builder (parameters, decisions, measurements)',
    usage: 'builder.get_interface <name>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0);
      if (!name) {
        return { success: false, error: 'Missing builder name. Usage: builder.get_interface <name>' };
      }

      // Try to load from YAML storage
      try {
        const stored = await storage.get(name);
        const yamlContent = stored.content;

        // Parse the YAML to extract interface information
        const { parse: parseYaml } = await import('yaml');
        const parsed: any = parseYaml(yamlContent);

        const interfaceData: any = {
          name: parsed.name || name,
          description: parsed.description || 'No description',
          version: parsed.version || '1.0',
          tags: parsed.tags || [],
          source: 'yaml'
        };

        // Extract decisions
        if (parsed.decisions) {
          interfaceData.decisions = Object.entries(parsed.decisions).map(([key, value]: [string, any]) => ({
            name: key,
            type: value.type || 'unknown',
            description: value.description,
            default: value.default,
            options: value.options,
            weights: value.weights,
            min: value.min,
            max: value.max,
            probability: value.probability
          }));
        } else {
          interfaceData.decisions = [];
        }

        // Extract measurements
        if (parsed.measurements) {
          interfaceData.measurements = Object.entries(parsed.measurements).map(([key, value]: [string, any]) => ({
            name: key,
            value: value.value,
            base: value.base,
            variation: value.variation,
            source: value.source,
            description: value.description
          }));
        } else {
          interfaceData.measurements = [];
        }

        // Extract derived values
        if (parsed.derived) {
          interfaceData.derived = Object.entries(parsed.derived).map(([key, expression]) => ({
            name: key,
            expression: expression
          }));
        } else {
          interfaceData.derived = [];
        }

        // Extract composition info
        if (parsed.compose) {
          interfaceData.compositions = Object.entries(parsed.compose).map(([key, value]: [string, any]) => ({
            name: key,
            builder: value.builder,
            offset: value.offset,
            rotation: value.rotation,
            scale: value.scale,
            overrides: value.overrides,
            asInstance: value.asInstance
          }));
        } else {
          interfaceData.compositions = [];
        }

        // Extract placement info
        if (parsed.placement) {
          const placements = Array.isArray(parsed.placement) ? parsed.placement : [parsed.placement];
          interfaceData.placements = placements.map((p: any) => ({
            mode: p.mode,
            builder: p.builder,
            count: p.count,
            center: p.center,
            width: p.width,
            depth: p.depth,
            radius: p.radius,
            minDistance: p.minDistance,
            instancePrefix: p.instancePrefix,
            asInstance: p.asInstance,
            overrides: p.overrides
          }));
        } else {
          interfaceData.placements = [];
        }

        // Extract geometry info (count commands)
        if (parsed.geometry) {
          const geometryTypes: Record<string, number> = {};
          for (const cmd of parsed.geometry) {
            if (cmd.vertex) geometryTypes.vertex = (geometryTypes.vertex || 0) + 1;
            else if (cmd.loop) geometryTypes.loop = (geometryTypes.loop || 0) + 1;
            else if (cmd.face) geometryTypes.face = (geometryTypes.face || 0) + 1;
            else if (cmd.loft) geometryTypes.loft = (geometryTypes.loft || 0) + 1;
            else if (cmd.box) geometryTypes.box = (geometryTypes.box || 0) + 1;
            else if (cmd.cylinder) geometryTypes.cylinder = (geometryTypes.cylinder || 0) + 1;
            else if (cmd.lathe) geometryTypes.lathe = (geometryTypes.lathe || 0) + 1;
            else if (cmd.sweep) geometryTypes.sweep = (geometryTypes.sweep || 0) + 1;
            else if (cmd.subdivide) geometryTypes.subdivide = (geometryTypes.subdivide || 0) + 1;
          }
          interfaceData.geometryCommands = geometryTypes;
          interfaceData.totalGeometryCommands = parsed.geometry.length;
        }

        return {
          success: true,
          data: interfaceData
        };

      } catch (err: any) {
        return {
          success: false,
          error: `Failed to get interface for '${name}': ${err.message}`
        };
      }
    }
  },

  {
    action: 'validate',
    description: 'Run validation checks on the last build',
    usage: 'builder.validate',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.lastRun || !ctx.lastRun.mesh) {
        return {
          success: false,
          error: 'No builder has been run yet. Use builder.run first.'
        };
      }

      const validationContext = {
        builderName: ctx.lastRun.builderName,
        mesh: ctx.lastRun.mesh,
        measurements: ctx.lastRun.measurements,
        decisions: ctx.lastRun.decisions,
        tags: ctx.lastRun.sceneGraph?.getAllTags?.() || []
      };

      const results = validateBuilder(validationContext);

      return {
        success: true,
        data: {
          valid: results.valid,
          builder: ctx.lastRun.builderName,
          seed: ctx.lastRun.seed,
          summary: results.summary,
          checks: results.checks,
          // Group checks by status for easier parsing
          passed: results.checks.filter((c: any) => c.status === 'pass'),
          warnings: results.checks.filter((c: any) => c.status === 'warning'),
          failed: results.checks.filter((c: any) => c.status === 'fail')
        }
      };
    }
  },

  {
    action: 'quality',
    description: 'Evaluate quality tier gates on the last build. Returns machine-readable suggestions.',
    usage: 'builder.quality [tier=N]',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.lastRun || !ctx.lastRun.mesh) {
        return {
          success: false,
          error: 'No builder has been run yet. Use builder.run first.'
        };
      }

      // Parse optional tier argument from options (tier=N)
      let requestedTier: number | undefined;
      if (cmd.options.tier) {
        requestedTier = parseInt(cmd.options.tier, 10);
        if (isNaN(requestedTier) || requestedTier < 1 || requestedTier > 4) {
          return { success: false, error: 'Invalid tier. Use tier=1, tier=2, tier=3, or tier=4.' };
        }
      }

      // Build validation context with traces and quality metadata
      const output = ctx.lastRun;
      const validationContext = {
        builderName: ctx.lastRun.builderName,
        mesh: output.mesh,
        measurements: output.measurements,
        decisions: output.decisions,
        tags: output.sceneGraph?.getAllTags?.() || [],
        traces: output.traces
      };

      const result = evaluateQualityTier(validationContext, requestedTier);

      // Store on output for downstream commands
      output.qualityGateResult = result;

      return {
        success: true,
        data: {
          builder: ctx.lastRun.builderName,
          seed: ctx.lastRun.seed,
          target_tier: result.target_tier,
          achieved_tier: result.achieved_tier,
          summary: result.summary,
          gates: result.gates,
          suggestions: result.suggestions,
          // Convenience groupings
          passed_gates: result.gates.filter((g: any) => g.status === 'pass'),
          failed_gates: result.gates.filter((g: any) => g.status === 'fail')
        }
      };
    }
  },

  {
    action: 'coverage',
    description: 'Test decision coverage for a builder. Runs builder with each decision option to verify they affect output.',
    usage: 'builder.coverage [<name>] [seed=N]',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      // Get builder name from arg or use active builder
      let builderName = getArg(cmd, 0, 'name');
      if (!builderName) {
        if (!ctx.activeBuilder) {
          return {
            success: false,
            error: 'No builder specified and no active builder. Usage: builder.coverage <name> or builder.open <name> first.'
          };
        }
        builderName = ctx.activeBuilder;
      }

      // Get seed (default 42 for reproducibility)
      const seed = getNumberArg(cmd, 1, 'seed') ?? 42;

      try {
        // Load the builder YAML
        const stored = await storage.get(builderName);
        const yamlDefinition = await parseYamlWithLibrary(stored.content);

        // Create executor function
        const executeBuilder = async (overrides: Record<string, any>) => {
          return await parseAndExecuteBuilder(yamlDefinition, { seed, overrides });
        };

        // Run coverage test
        const report = await testDecisionCoverage(yamlDefinition, executeBuilder, seed);

        return {
          success: true,
          data: {
            builder: report.builderName,
            seed: report.seed,
            coverage_percent: report.coveragePercent,
            summary: {
              total: report.totalDecisions,
              covered: report.covered,
              uncovered: report.uncovered,
              partial: report.partial,
              errors: report.errors
            },
            decisions: report.decisions.map(d => ({
              name: d.name,
              type: d.type,
              status: d.status,
              options: d.options,
              notes: d.notes,
              error: d.error,
              results: d.optionResults
            })),
            // Convenience groupings
            covered_decisions: report.decisions.filter(d => d.status === 'covered').map(d => d.name),
            uncovered_decisions: report.decisions.filter(d => d.status === 'uncovered').map(d => d.name),
            partial_decisions: report.decisions.filter(d => d.status === 'partial').map(d => d.name)
          }
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Coverage test failed: ${err.message}`
        };
      }
    }
  },

  {
    action: 'check_plan',
    description: 'Compare builder output against its sophistication plan',
    usage: 'builder.check_plan [<name>] [tier=N]',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      // Get builder name from arg or use active builder
      let builderName = getArg(cmd, 0, 'name');
      if (!builderName) {
        if (!ctx.activeBuilder) {
          return {
            success: false,
            error: 'No builder specified and no active builder. Usage: builder.check_plan <name> or builder.open <name> first.'
          };
        }
        builderName = ctx.activeBuilder;
      }

      if (!ctx.lastRun || !ctx.lastRun.mesh) {
        return {
          success: false,
          error: 'No builder has been run yet. Use builder.run first.'
        };
      }

      // Parse optional tier argument
      let tier: number | undefined;
      if (cmd.options.tier) {
        tier = parseInt(cmd.options.tier, 10);
        if (isNaN(tier) || tier < 0 || tier > 3) {
          return { success: false, error: 'Invalid tier. Use tier=0, tier=1, tier=2, or tier=3.' };
        }
      }

      try {
        // Load the sophistication plan YAML
        const { parse: parseYaml } = await import('yaml');
        const planPath = join(process.cwd(), 'builders', 'reference', 'plans', `${builderName}.plan.yaml`);
        const planContent = await readFile(planPath, 'utf-8');
        const plan = parseYaml(planContent);

        // Build validation context from last run
        const output = ctx.lastRun;
        const validationContext = {
          builderName: output.builderName,
          mesh: output.mesh,
          measurements: output.measurements,
          decisions: output.decisions,
          tags: output.sceneGraph?.getAllTags?.() || [],
          traces: output.traces,
          qualityMeta: output.qualityMeta
        };

        const result = compareSophisticationPlan(plan, validationContext, tier);

        return {
          success: true,
          data: {
            builder: result.builder,
            tier_checked: result.tier_checked,
            summary: result.summary,
            checks: result.checks,
            // Convenience groupings
            passed: result.checks.filter(c => c.status === 'pass'),
            failed: result.checks.filter(c => c.status === 'fail'),
            skipped: result.checks.filter(c => c.status === 'skip')
          }
        };
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          return {
            success: false,
            error: `No sophistication plan found for '${builderName}'. Expected: builders/reference/plans/${builderName}.plan.yaml`
          };
        }
        return {
          success: false,
          error: `Plan check failed: ${err.message}`
        };
      }
    }
  },

  {
    action: 'export_gltf',
    description: 'Export last builder run as GLB (binary glTF 2.0) file',
    usage: 'builder.export_gltf [filename]',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.lastRun) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const mesh = ctx.lastRun.mesh;
      if (!mesh) {
        return { success: false, error: 'No mesh in last run' };
      }

      const { exportGLB } = await import('../../../export/GLTFExporter');
      const name = getArg(cmd, 0) || ctx.lastRun.builderName || 'export';
      const result = exportGLB(mesh, name);

      // Write to output directory
      const { writeFile, mkdir } = await import('fs/promises');
      const path = await import('path');
      const outputDir = path.resolve('output');
      await mkdir(outputDir, { recursive: true });

      const filename = name.endsWith('.glb') ? name : `${name}.glb`;
      const outputPath = path.join(outputDir, filename);
      await writeFile(outputPath, result.glb);

      return {
        success: true,
        data: {
          path: outputPath,
          ...result.stats,
          summary: `Exported ${result.stats.triangleCount} triangles, ${result.stats.materialCount} material(s), ${result.stats.hasUVs ? 'with' : 'without'} UVs → ${outputPath} (${(result.stats.byteSize / 1024).toFixed(1)} KB)`
        }
      };
    }
  },

  {
    action: 'export_psd',
    description: 'Export last builder run as PSD (Procedurable Scene Description) format',
    usage: 'builder.export_psd',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.lastRun) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const { serializeToPSD, validatePSDScene } = await import('../../../generation/builder/PSD');
      const scene = serializeToPSD(ctx.lastRun);
      const errors = validatePSDScene(scene);

      return {
        success: true,
        data: {
          scene,
          validation: errors.length === 0 ? 'valid' : { errors },
          summary: {
            name: scene.name,
            primCount: Object.keys(scene.prims).length,
            materialCount: scene.materials.length,
            meshPrims: Object.values(scene.prims).filter(p => p.type === 'Mesh').length,
            instancePrims: Object.values(scene.prims).filter(p => p.type === 'Instance').length,
            xformPrims: Object.values(scene.prims).filter(p => p.type === 'Xform').length
          }
        }
      };
    }
  },

  {
    action: 'export_scene_gltf',
    description: 'Export PSD scene as GLB with hierarchy and instancing (C6-002)',
    usage: 'builder.export_scene_gltf [filename]',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.lastRun) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      // First serialize to PSD
      const { serializeToPSD } = await import('../../../generation/builder/PSD');
      const scene = serializeToPSD(ctx.lastRun);

      // Export PSD scene to glTF
      const { exportSceneGLB } = await import('../../../export/GLTFExporter');
      const result = exportSceneGLB(scene);

      // Write to output directory
      const { writeFile, mkdir } = await import('fs/promises');
      const path = await import('path');
      const outputDir = path.resolve('output');
      await mkdir(outputDir, { recursive: true });

      const name = getArg(cmd, 0) || ctx.lastRun.builderName || 'scene';
      const filename = name.endsWith('.glb') ? name : `${name}_scene.glb`;
      const outputPath = path.join(outputDir, filename);
      await writeFile(outputPath, result.glb);

      return {
        success: true,
        data: {
          path: outputPath,
          ...result.stats,
          summary: `Exported scene: ${result.stats.nodeCount} nodes, ${result.stats.meshCount} meshes, ${result.stats.instanceCount} instances, ${result.stats.triangleCount} triangles → ${outputPath} (${(result.stats.byteSize / 1024).toFixed(1)} KB)`
        }
      };
    }
  },

  // B4-001: Builder Template Generation + B4-003: Sophistication-Guided Creation
  {
    action: 'create',
    description: 'Create a new builder from a domain template, optionally guided by a sophistication plan (B4-001, B4-003)',
    usage: 'builder.create <name> domain=<domain> [plan=<plan_file>] [description=<desc>]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0);
      if (!name) {
        return { success: false, error: 'Usage: builder.create <name> domain=<domain> [plan=<plan_file>]\nDomains: furniture, vessel, signage, mechanical' };
      }

      const domain = cmd.options['domain'] as string;
      if (!domain) {
        return { success: false, error: 'Missing domain= option. Available domains: furniture, vessel, signage, mechanical' };
      }

      const validDomains = ['furniture', 'vessel', 'signage', 'mechanical'];
      if (!validDomains.includes(domain)) {
        return { success: false, error: `Invalid domain '${domain}'. Available: ${validDomains.join(', ')}` };
      }

      const description = cmd.options['description'] as string || `A procedural ${domain} builder`;
      const planFile = cmd.options['plan'] as string;

      // Check if builder already exists
      try {
        const exists = await storage.exists(name);
        if (exists) {
          return { success: false, error: `Builder '${name}' already exists. Use a different name or delete the existing builder.` };
        }
      } catch {
        // Storage check failed, proceed anyway
      }

      // B4-003: Load sophistication plan if specified
      let plan: any = null;
      let planInfo: any = null;
      if (planFile) {
        try {
          const planResult = await loadSophisticationPlan(planFile);
          plan = planResult.plan;
          planInfo = planResult.info;
        } catch (err) {
          return { success: false, error: `Failed to load plan: ${(err as Error).message}` };
        }
      }

      // Generate template based on domain (and optionally plan)
      const template = plan
        ? generateBuilderFromPlan(name, domain, description, plan)
        : generateBuilderTemplate(name, domain, description);

      // Save the builder
      try {
        await storage.put(name, template, { description });

        const resultData: any = {
          name,
          domain,
          description,
          path: `builders/${name}.yaml`,
          message: plan
            ? `Created ${domain} builder '${name}' from plan. Use builder.open ${name} to start editing.`
            : `Created ${domain} builder '${name}'. Use builder.open ${name} to start editing.`,
          template_sections: ['version', 'name', 'description', 'quality', 'decisions', 'measurements', 'derived', 'geometry']
        };

        // Add plan info if available
        if (planInfo) {
          resultData.plan = planInfo;
        }

        return {
          success: true,
          data: resultData
        };
      } catch (err) {
        return { success: false, error: `Failed to save builder: ${(err as Error).message}` };
      }
    }
  },

  // B4-002: Builder Section Editing
  {
    action: 'add_decision',
    description: 'Add a decision to a builder (B4-002)',
    usage: 'builder.add_decision <builder> <name> type=<type> [options=<opt1,opt2,...>] [default=<value>]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const builderName = getArg(cmd, 0);
      const decisionName = getArg(cmd, 1);

      if (!builderName || !decisionName) {
        return { success: false, error: 'Usage: builder.add_decision <builder> <name> type=<type> [options=...] [default=...]' };
      }

      const decisionType = cmd.options['type'];
      if (!decisionType) {
        return { success: false, error: 'Missing type= option. Valid types: choice, number, boolean, count' };
      }

      const validTypes = ['choice', 'number', 'boolean', 'count'];
      if (!validTypes.includes(decisionType)) {
        return { success: false, error: `Invalid type '${decisionType}'. Valid types: ${validTypes.join(', ')}` };
      }

      // Parse options for choice type
      const optionsStr = cmd.options['options'];
      const options = optionsStr ? optionsStr.split(',').map(o => o.trim()) : undefined;
      const defaultValue = cmd.options['default'];

      if (decisionType === 'choice' && (!options || options.length < 2)) {
        return { success: false, error: 'Choice decisions require options= with at least 2 comma-separated values' };
      }

      try {
        const result = await updateBuilderSection(builderName, 'decisions', decisionName, {
          type: decisionType,
          options,
          default: defaultValue
        });

        return {
          success: true,
          data: {
            builder: builderName,
            section: 'decisions',
            name: decisionName,
            added: result,
            message: `Added decision '${decisionName}' to ${builderName}`
          }
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  },

  {
    action: 'add_measurement',
    description: 'Add a measurement to a builder (B4-002)',
    usage: 'builder.add_measurement <builder> <name> value=<number> [source=<description>]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const builderName = getArg(cmd, 0);
      const measurementName = getArg(cmd, 1);

      if (!builderName || !measurementName) {
        return { success: false, error: 'Usage: builder.add_measurement <builder> <name> value=<number> [source=...]' };
      }

      const valueStr = cmd.options['value'];
      if (!valueStr) {
        return { success: false, error: 'Missing value= option' };
      }

      const value = parseFloat(valueStr);
      if (isNaN(value)) {
        return { success: false, error: `Invalid value '${valueStr}': must be a number` };
      }

      const source = cmd.options['source'] || 'Added via DSL';

      try {
        const result = await updateBuilderSection(builderName, 'measurements', measurementName, {
          value,
          source
        });

        return {
          success: true,
          data: {
            builder: builderName,
            section: 'measurements',
            name: measurementName,
            value,
            added: result,
            message: `Added measurement '${measurementName}' = ${value} to ${builderName}`
          }
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  },

  {
    action: 'add_derived',
    description: 'Add a derived value to a builder (B4-002)',
    usage: 'builder.add_derived <builder> <name> expr=<expression>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const builderName = getArg(cmd, 0);
      const derivedName = getArg(cmd, 1);

      if (!builderName || !derivedName) {
        return { success: false, error: 'Usage: builder.add_derived <builder> <name> expr=<expression>' };
      }

      const expression = cmd.options['expr'];
      if (!expression) {
        return { success: false, error: 'Missing expr= option' };
      }

      try {
        const result = await updateBuilderSection(builderName, 'derived', derivedName, expression);

        return {
          success: true,
          data: {
            builder: builderName,
            section: 'derived',
            name: derivedName,
            expression,
            added: result,
            message: `Added derived '${derivedName}' = "${expression}" to ${builderName}`
          }
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  },

  {
    action: 'add_geometry',
    description: 'Add a geometry command to a builder (B4-002)',
    usage: 'builder.add_geometry <builder> <type> name=<name> [params...]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const builderName = getArg(cmd, 0);
      const geomType = getArg(cmd, 1);

      if (!builderName || !geomType) {
        return { success: false, error: 'Usage: builder.add_geometry <builder> <type> name=<name> [params...]\nTypes: box, cylinder, sphere, extrude, lathe' };
      }

      const validTypes = ['box', 'cylinder', 'sphere', 'extrude', 'lathe', 'cone', 'torus'];
      if (!validTypes.includes(geomType)) {
        return { success: false, error: `Invalid geometry type '${geomType}'. Valid types: ${validTypes.join(', ')}` };
      }

      const name = cmd.options['name'];
      if (!name) {
        return { success: false, error: 'Missing name= option for geometry' };
      }

      // Build geometry command object from options
      const geomCommand: Record<string, any> = { name };

      // Copy all options except 'name' to the geometry command
      for (const [key, value] of Object.entries(cmd.options)) {
        if (key === 'name') continue;

        // Try to parse as number or keep as string (expression)
        const numValue = parseFloat(value);
        geomCommand[key] = isNaN(numValue) ? value : numValue;
      }

      try {
        const result = await addGeometryCommand(builderName, geomType, geomCommand);

        return {
          success: true,
          data: {
            builder: builderName,
            section: 'geometry',
            type: geomType,
            name,
            added: result,
            message: `Added ${geomType} '${name}' to ${builderName}`
          }
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  }
];

// =============================================================================
// B4-002: Helper functions for section editing
// =============================================================================

async function updateBuilderSection(
  builderName: string,
  section: 'decisions' | 'measurements' | 'derived',
  name: string,
  value: any
): Promise<any> {
  // Load existing builder
  const exists = await storage.exists(builderName);
  if (!exists) {
    throw new Error(`Builder '${builderName}' not found`);
  }

  const stored = await storage.get(builderName);
  const yaml = await import('yaml');
  const parsed = yaml.parse(stored.content);

  // Check for duplicate
  if (parsed[section] && parsed[section][name]) {
    throw new Error(`${section} '${name}' already exists in ${builderName}`);
  }

  // Add the new entry
  if (!parsed[section]) {
    parsed[section] = {};
  }
  parsed[section][name] = value;

  // Serialize back to YAML
  const newContent = yaml.stringify(parsed, { indent: 2 });

  // Save
  await storage.put(builderName, newContent);

  return value;
}

async function addGeometryCommand(
  builderName: string,
  geomType: string,
  geomParams: Record<string, any>
): Promise<any> {
  // Load existing builder
  const exists = await storage.exists(builderName);
  if (!exists) {
    throw new Error(`Builder '${builderName}' not found`);
  }

  const stored = await storage.get(builderName);
  const yaml = await import('yaml');
  const parsed = yaml.parse(stored.content);

  // Check for duplicate name in geometry
  if (parsed.geometry) {
    for (const cmd of parsed.geometry) {
      const cmdType = Object.keys(cmd)[0];
      const cmdParams = cmd[cmdType];
      if (cmdParams && cmdParams.name === geomParams.name) {
        throw new Error(`Geometry with name '${geomParams.name}' already exists in ${builderName}`);
      }
    }
  }

  // Build the geometry command object
  const geomCommand = { [geomType]: geomParams };

  // Add to geometry array
  if (!parsed.geometry) {
    parsed.geometry = [];
  }
  parsed.geometry.push(geomCommand);

  // Serialize back to YAML
  const newContent = yaml.stringify(parsed, { indent: 2 });

  // Save
  await storage.put(builderName, newContent);

  return geomCommand;
}

// =============================================================================
// B4-003: Sophistication Plan Loading and Template Generation
// =============================================================================

async function loadSophisticationPlan(planPath: string): Promise<{ plan: any; info: any }> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const yaml = await import('yaml');

  // Resolve plan path (check multiple locations)
  const possiblePaths = [
    planPath,
    path.join('builders/reference/plans', planPath),
    path.join('builders/reference/plans', `${planPath}.plan.yaml`),
  ];

  let content: string | null = null;
  let resolvedPath: string | null = null;

  for (const p of possiblePaths) {
    try {
      content = await fs.readFile(p, 'utf-8');
      resolvedPath = p;
      break;
    } catch {
      continue;
    }
  }

  if (!content) {
    throw new Error(`Plan file not found. Tried: ${possiblePaths.join(', ')}`);
  }

  const plan = yaml.parse(content);

  // Extract tier information for output
  const tierInfo: Record<string, any> = {};
  for (const key of Object.keys(plan)) {
    if (key.startsWith('tier_')) {
      const tierData = plan[key];
      const parts = tierData.parts;
      const partNames = Array.isArray(parts) ? parts : Object.keys(parts || {});
      tierInfo[key] = {
        description: tierData.description,
        parts: partNames,
        tools_needed: tierData.tools_needed || []
      };
    }
  }

  return {
    plan,
    info: {
      builder: plan.builder,
      domain: plan.domain,
      path: resolvedPath,
      tiers: tierInfo
    }
  };
}

function generateBuilderFromPlan(name: string, domain: string, description: string, plan: any): string {
  // Get base template for the domain
  const template = DOMAIN_TEMPLATES[domain];
  if (!template) {
    throw new Error(`Unknown domain: ${domain}`);
  }

  // Extract parts from the plan (use tier_2 or highest available tier)
  const planParts = extractPlanParts(plan);

  // Build decisions section (combine domain defaults with plan decisions)
  const planDecisions = extractPlanDecisions(plan);
  const allDecisions = [...template.decisions];

  // Add any plan decisions not already in domain template
  for (const dec of planDecisions) {
    if (!allDecisions.find(d => d.name === dec.name)) {
      allDecisions.push(dec);
    }
  }

  const decisionsYaml = allDecisions.map(d => {
    let decisionStr = `  ${d.name}:\n    type: ${d.type}`;
    if (d.type === 'choice') {
      // Choice decisions require options - provide defaults if missing
      const options = d.options || ['option_a', 'option_b', 'option_c'];
      decisionStr += `\n    options: [${options.join(', ')}]`;
    }
    if (d.default) {
      decisionStr += `\n    default: ${d.default}`;
    }
    return decisionStr;
  }).join('\n');

  // Build measurements section
  const measurementsYaml = template.measurements.map(m =>
    `  ${m.name}:\n    value: ${m.value}\n    source: "${m.source}"`
  ).join('\n');

  // Build quality section from plan
  const partsYaml = planParts.map(p => `      ${p}: placeholder`).join('\n');
  const tierGaps = [
    `"Plan loaded from ${plan.builder || 'sophistication plan'}"`,
    `"Geometry placeholders need implementation"`,
    ...planParts.slice(0, 3).map(p => `"Implement ${p} geometry"`)
  ].join('\n    - ');

  // Build geometry placeholders for each part
  const geometryPlaceholders = planParts.map((part, i) => {
    const y = i * 0.2;
    return `  - box:
      name: ${part}_placeholder
      center: { x: "0", y: "${y}", z: "0" }
      size: { x: "0.1", y: "0.1", z: "0.1" }
      color: primary`;
  }).join('\n');

  const yaml = `version: "1.0"
name: ${name}
description: "${description}"

# Quality declaration - populated from sophistication plan (B4-003)
quality:
  target_tier: 2
  current_tier: 0
  tier_gaps:
    - ${tierGaps}
  parts:
${partsYaml}
  decision_coverage: 0%

# Decisions - from domain template and plan
decisions:
${decisionsYaml}

# Measurements - all dimensions in meters
measurements:
${measurementsYaml}

# Derived values - computed from measurements and decisions
derived:
  ${template.derived}

# Materials - named materials for geometry commands
materials:
  primary:
    color: { r: 0.6, g: 0.5, b: 0.4 }
    roughness: 0.6

# Geometry - placeholders from sophistication plan
geometry:
  # TODO: Replace placeholders with actual geometry per plan
${geometryPlaceholders}
`;

  return yaml;
}

function extractPlanParts(plan: any): string[] {
  const parts: Set<string> = new Set();

  // Collect parts from all tiers, preferring higher tiers
  const tiers = ['tier_2_form_resolved', 'tier_1_silhouette', 'tier_0_placeholder'];

  for (const tierKey of tiers) {
    const tier = plan[tierKey];
    if (!tier) continue;

    const tierParts = tier.parts;
    if (Array.isArray(tierParts)) {
      tierParts.forEach(p => parts.add(p));
    } else if (typeof tierParts === 'object') {
      Object.keys(tierParts).forEach(p => parts.add(p));
    }
  }

  return Array.from(parts);
}

function extractPlanDecisions(plan: any): Array<{ name: string; type: string; options?: string[]; default?: string }> {
  const decisions: Array<{ name: string; type: string; options?: string[] }> = [];

  // Extract decisions mentioned in the plan
  const tiers = ['tier_2_form_resolved', 'tier_1_silhouette', 'tier_0_placeholder'];

  for (const tierKey of tiers) {
    const tier = plan[tierKey];
    if (!tier) continue;

    // Check for decisions array
    if (Array.isArray(tier.decisions)) {
      for (const decName of tier.decisions) {
        if (!decisions.find(d => d.name === decName)) {
          // Infer type from name
          let type = 'choice';
          if (decName.includes('count') || decName.includes('num') || decName.includes('height') ||
              decName.includes('width') || decName.includes('depth')) {
            type = 'number';
          } else if (decName.startsWith('has_') || decName.startsWith('is_')) {
            type = 'boolean';
          }

          decisions.push({ name: decName, type });
        }
      }
    }

    // Check for decisions_that_affect_geometry
    if (Array.isArray(tier.decisions_that_affect_geometry)) {
      for (const decStr of tier.decisions_that_affect_geometry) {
        // Parse strings like "back_style -> completely different back geometry"
        const match = decStr.match(/^(\w+)\s*->/);
        if (match) {
          const decName = match[1];
          if (!decisions.find(d => d.name === decName)) {
            decisions.push({ name: decName, type: 'choice' });
          }
        }
      }
    }
  }

  return decisions;
}

export const builderNamespace: CommandNamespace = {
  name: 'builder',
  description: 'Commands for managing and running builders',
  handlers
};
