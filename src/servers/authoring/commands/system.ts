/**
 * System Commands
 *
 * Commands for system information and API management:
 *   system.version
 *   system.ping
 *   system.help
 *   system.status
 */

import { CommandNamespace, CommandHandler, CommandContext, CommandResult } from '../command-registry';
import { ParsedCommand } from '../command-parser';
import { registry } from '../command-registry';
import { storage } from './storage';

// API Version - follows semantic versioning
export const API_VERSION = '1.0.0';

// API metadata
export const API_INFO = {
  name: 'Procedurable Authoring API',
  version: API_VERSION,
  apiVersion: '1.0',
  releaseDate: '2026-01-14',
  protocol: 'mcp-v1',
  description: 'MCP-compatible procedural content generation system'
};

const handlers: CommandHandler[] = [
  {
    action: 'version',
    description: 'Get API version and info',
    usage: 'system.version',
    execute: async (_cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      return {
        success: true,
        data: {
          version: API_VERSION,
          apiVersion: API_INFO.apiVersion,
          protocol: API_INFO.protocol,
          name: API_INFO.name,
          releaseDate: API_INFO.releaseDate,
          features: [
            'builder.* - Builder management and execution',
            'measurement.* - Measurement inspection/override',
            'decision.* - Decision inspection/override',
            'storage.* - YAML builder storage',
            'math.* - Expression evaluation'
          ]
        }
      };
    }
  },

  {
    action: 'ping',
    description: 'Health check - returns pong',
    usage: 'system.ping',
    execute: async (_cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      return {
        success: true,
        data: {
          message: 'pong',
          timestamp: Date.now()
        }
      };
    }
  },

  {
    action: 'help',
    description: 'List all available commands',
    usage: 'system.help',
    execute: async (_cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const help = registry.getHelp();
      const namespaces = Object.entries(help).map(([name, info]) => ({
        name: name || 'system',
        description: info.description,
        commands: info.commands
      }));

      return {
        success: true,
        data: {
          namespaces,
          totalCommands: namespaces.reduce((sum, ns) => sum + ns.commands.length, 0)
        }
      };
    }
  },

  {
    action: 'status',
    description: 'Get current system status',
    usage: 'system.status',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      return {
        success: true,
        data: {
          version: API_VERSION,
          activeBuilder: ctx.activeBuilder,
          activeBuilderSource: ctx.activeBuilderSource,
          hasLastRun: ctx.lastRun !== null,
          historyCount: ctx.runHistory.length,
          measurementOverrides: ctx.measurementOverrides.size,
          decisionOverrides: ctx.decisionOverrides.size
        }
      };
    }
  },

  {
    action: 'list_builders',
    description: 'List all available builders with metadata for agent introspection',
    usage: 'system.list_builders',
    execute: async (_cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const builders: any[] = [];

      // Add YAML builders from storage
      try {
        const yamlBuilders = await storage.list();
        for (const meta of yamlBuilders.builders) {
          builders.push({
            name: meta.name,
            description: meta.description || 'No description',
            tags: meta.tags || [],
            source: 'yaml',
            modifiedAt: meta.modifiedAt,
            size: meta.size
          });
        }
      } catch (err: any) {
        console.error('Failed to list YAML builders:', err.message);
      }

      // Sort by name
      builders.sort((a, b) => a.name.localeCompare(b.name));

      return {
        success: true,
        data: {
          builders,
          total: builders.length,
          bySource: {
            yaml: builders.filter(b => b.source === 'yaml').length
          }
        }
      };
    }
  },

  {
    action: 'list_tools',
    description: 'List available geometry commands and tools',
    usage: 'system.list_tools',
    execute: async (_cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      return {
        success: true,
        data: {
          geometryCommands: [
            {
              name: 'vertex',
              description: 'Define a 3D point',
              parameters: ['name', 'position: {x, y, z}'],
              example: 'vertex: center, position: {x: 0, y: 0, z: 0}'
            },
            {
              name: 'loop',
              description: 'Create closed edge loop from vertices',
              parameters: ['name', 'vertices: [...]'],
              example: 'loop: base, vertices: [v1, v2, v3, v4]'
            },
            {
              name: 'face',
              description: 'Create planar face from vertices',
              parameters: ['name', 'vertices: [...]', 'color?'],
              example: 'face: top, vertices: [v1, v2, v3, v4], color: {name: red}'
            },
            {
              name: 'loft',
              description: 'Create surface between two loops',
              parameters: ['name', 'bottom', 'top', 'color?'],
              example: 'loft: wall, bottom: base_loop, top: top_loop'
            },
            {
              name: 'box',
              description: 'Create rectangular box',
              parameters: ['name', 'center: {x,y,z}', 'size: {x,y,z}', 'color?'],
              example: 'box: cube, center: {x:0,y:0,z:0}, size: {x:1,y:1,z:1}'
            },
            {
              name: 'cylinder',
              description: 'Create cylinder between two points',
              parameters: ['name', 'bottom: {x,y,z}', 'top: {x,y,z}', 'radius', 'color?'],
              example: 'cylinder: leg, bottom: {x:0,y:0,z:0}, top: {x:0,y:1,z:0}, radius: 0.05'
            },
            {
              name: 'lathe',
              description: 'Rotate 2D profile around Y-axis to create surface of revolution',
              parameters: ['name', 'profile: [[r,y],...]', 'segments?', 'color?'],
              example: 'lathe: vase, profile: [[0.2,0], [0.3,0.5], [0.2,1.0]], segments: 32'
            },
            {
              name: 'sweep',
              description: 'Extrude 2D profile along 3D spline path',
              parameters: ['name', 'profile: [[x,y],...]', 'path: spline_name', 'color?'],
              example: 'sweep: handle, profile: [[0.02,0], [0.02,0.04]], path: curve_path'
            },
            {
              name: 'subdivide',
              description: 'Apply Catmull-Clark subdivision for smooth surfaces',
              parameters: ['iterations?'],
              example: 'subdivide: iterations: 2'
            }
          ],
          compositionTools: [
            {
              name: 'compose',
              description: 'Include another builder as a sub-component',
              parameters: ['builder', 'offset?', 'rotation?', 'scale?', 'overrides?', 'asInstance?'],
              example: 'compose: { builder: Leg, offset: {x:0,y:0,z:0} }'
            },
            {
              name: 'placement',
              description: 'Arrange multiple instances using constraints',
              modes: ['around_rectangle', 'around_circle', 'scatter_poisson'],
              example: 'placement: { mode: scatter_poisson, builder: Tree, count: 20 }'
            }
          ],
          mathFunctions: [
            'Basic: +, -, *, /, ^',
            'Trig: sin, cos, tan, asin, acos, atan, atan2',
            'Rounding: floor, ceil, round, trunc',
            'Comparison: min, max, if(cond, then, else)',
            'Math: abs, sqrt, pow, exp, log'
          ]
        }
      };
    }
  }
];

export const systemNamespace: CommandNamespace = {
  name: 'system',
  description: 'System commands (version, ping, help, status)',
  handlers: handlers
};

