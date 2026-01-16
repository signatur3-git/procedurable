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
            issues: result.validation.issues.length
          }
        });

        // Return summary
        const decisions: Record<string, any> = {};
        for (const [key, d] of result.decisions) {
          decisions[key] = { value: d.value, source: d.source };
        }

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
            traces: result.traces.size
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
      let hasColors = false;

      // Default color (wood brown)
      const defaultColor = { r: 0.545, g: 0.353, b: 0.169 };

      for (const face of triangulated.faces) {
        // Get face vertices
        const v0 = triangulated.vertices[face.indices[0]].position;
        const v1 = triangulated.vertices[face.indices[1]].position;
        const v2 = triangulated.vertices[face.indices[2]].position;

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

        // Add colors (use face color or default)
        const color = face.color || defaultColor;
        if (face.color) hasColors = true;

        colors.push(color.r, color.g, color.b);
        colors.push(color.r, color.g, color.b);
        colors.push(color.r, color.g, color.b);
      }

      return {
        success: true,
        data: {
          vertices,
          normals,
          colors: hasColors ? colors : undefined,  // Only include if custom colors used
          vertexCount: vertices.length / 3,
          triangleCount: vertices.length / 9,
          bounds: ctx.lastRun.validation.bounds,
          hasColors
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
  }
];

export const builderNamespace: CommandNamespace = {
  name: 'builder',
  description: 'Commands for managing and running builders',
  handlers
};

