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
  }
];

export const systemNamespace: CommandNamespace = {
  name: 'system',
  description: 'System commands (version, ping, help, status)',
  handlers: handlers
};

