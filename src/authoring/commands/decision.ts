/**
 * Decision Commands
 *
 * Commands for inspecting and overriding builder decisions:
 *   decision.list
 *   decision.get <name>
 *   decision.override <name> <value>
 *   decision.reset <name>
 *   decision.reset-all
 */

import { CommandNamespace, CommandHandler, CommandContext, CommandResult } from '../command-registry';
import { ParsedCommand, getArg } from '../command-parser';

const handlers: CommandHandler[] = [
  {
    action: 'list',
    description: 'List all decisions for the active builder',
    usage: 'decision.list',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.activeBuilder) {
        return { success: false, error: 'No builder is open. Use builder.open <name> first.' };
      }

      // Get decisions from last run
      if (ctx.lastRun) {
        const decisions: Record<string, any> = {};
        for (const [key, d] of ctx.lastRun.decisions) {
          const override = ctx.decisionOverrides?.get(key);
          decisions[key] = {
            value: d.value,
            source: d.source,
            options: d.options,
            weights: d.weights,
            hasOverride: override !== undefined,
            overrideValue: override
          };
        }
        return {
          success: true,
          data: {
            builder: ctx.activeBuilder,
            count: Object.keys(decisions).length,
            decisions
          }
        };
      }

      // No run yet - return known decision names for DiningChair
      // TODO: This should come from builder metadata
      const knownDecisions = ctx.activeBuilder === 'DiningChair'
        ? [
            { name: 'leg_style', options: ['round', 'square', 'tapered', 'turned'] },
            { name: 'back_style', options: ['solid', 'slat', 'ladder', 'spindle'] },
            { name: 'seat_shape', options: ['square', 'rounded', 'contoured'] },
            { name: 'has_stretchers', options: [true, false] }
          ]
        : [];

      return {
        success: true,
        data: {
          builder: ctx.activeBuilder,
          note: 'Run builder first for actual values and weights',
          knownDecisions
        }
      };
    }
  },

  {
    action: 'get',
    description: 'Get a specific decision value and options',
    usage: 'decision.get <name>',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0, 'name');
      if (!name) {
        return { success: false, error: 'Missing decision name. Usage: decision.get <name>' };
      }

      if (!ctx.lastRun) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const decision = ctx.lastRun.decisions.get(name);
      if (!decision) {
        const available = Array.from(ctx.lastRun.decisions.keys());
        return {
          success: false,
          error: `Decision not found: ${name}. Available: ${available.join(', ')}`
        };
      }

      const override = ctx.decisionOverrides?.get(name);

      return {
        success: true,
        data: {
          name,
          value: decision.value,
          source: decision.source,
          options: decision.options,
          weights: decision.weights,
          hasOverride: override !== undefined,
          overrideValue: override
        }
      };
    }
  },

  {
    action: 'override',
    description: 'Force a specific decision value (persists across runs)',
    usage: 'decision.override <name> <value>',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0, 'name');
      if (!name) {
        return { success: false, error: 'Missing decision name. Usage: decision.override <name> <value>' };
      }

      let value: any = getArg(cmd, 1, 'value');
      if (value === undefined) {
        return { success: false, error: 'Missing value. Usage: decision.override <name> <value>' };
      }

      if (!ctx.activeBuilder) {
        return { success: false, error: 'No builder is open. Use builder.open <name> first.' };
      }

      // Parse boolean values
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      // Parse numbers
      else if (!isNaN(parseFloat(value))) value = parseFloat(value);

      // Initialize overrides map if needed
      if (!ctx.decisionOverrides) {
        ctx.decisionOverrides = new Map();
      }

      const previousValue = ctx.decisionOverrides.get(name);
      ctx.decisionOverrides.set(name, value);

      ctx.broadcast({
        type: 'decision_changed',
        builder: ctx.activeBuilder,
        decision: name,
        value,
        previousValue
      });

      return {
        success: true,
        data: {
          name,
          value,
          previousValue,
          message: `Set ${name} = ${value}. Run builder to see changes.`
        }
      };
    }
  },

  {
    action: 'reset',
    description: 'Remove override for a decision (restore random selection)',
    usage: 'decision.reset <name>',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0, 'name');
      if (!name) {
        return { success: false, error: 'Missing decision name. Usage: decision.reset <name>' };
      }

      if (!ctx.decisionOverrides) {
        return { success: true, data: { message: 'No overrides to reset' } };
      }

      const hadOverride = ctx.decisionOverrides.has(name);
      const previousValue = ctx.decisionOverrides.get(name);
      ctx.decisionOverrides.delete(name);

      if (hadOverride) {
        ctx.broadcast({
          type: 'decision_reset',
          builder: ctx.activeBuilder,
          decision: name,
          previousValue
        });
      }

      return {
        success: true,
        data: {
          name,
          wasOverridden: hadOverride,
          previousValue,
          message: hadOverride ? `Reset ${name} to random selection` : `${name} had no override`
        }
      };
    }
  },

  {
    action: 'reset-all',
    description: 'Clear all decision overrides',
    usage: 'decision.reset-all',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const count = ctx.decisionOverrides?.size || 0;

      if (ctx.decisionOverrides) {
        ctx.decisionOverrides.clear();
      }

      if (count > 0) {
        ctx.broadcast({
          type: 'decisions_reset_all',
          builder: ctx.activeBuilder,
          count
        });
      }

      return {
        success: true,
        data: {
          clearedCount: count,
          message: count > 0 ? `Cleared ${count} decision overrides` : 'No overrides to clear'
        }
      };
    }
  }
];

export const decisionNamespace: CommandNamespace = {
  name: 'decision',
  description: 'Commands for inspecting and overriding builder decisions',
  handlers
};

