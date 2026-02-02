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
  }
];

export const builderNamespace: CommandNamespace = {
  name: 'builder',
  description: 'Commands for managing and running builders',
  handlers
};

