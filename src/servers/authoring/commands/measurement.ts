/**
 * Measurement Commands
 *
 * Commands for inspecting and modifying builder measurements:
 *   measurement.list
 *   measurement.get <name>
 *   measurement.set <name> <value>
 *   measurement.reset <name>
 *   measurement.reset-all
 */

import { CommandNamespace, CommandHandler, CommandContext, CommandResult } from '../command-registry';
import { ParsedCommand, getArg, getNumberArg } from '../command-parser';

const handlers: CommandHandler[] = [
  {
    action: 'list',
    description: 'List all measurements for the active builder',
    usage: 'measurement.list',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.activeBuilder) {
        return { success: false, error: 'No builder is open. Use builder.open <name> first.' };
      }

      // Get measurements from last run, or return builder's known measurements
      if (ctx.lastRun) {
        const measurements: Record<string, any> = {};
        for (const [key, m] of ctx.lastRun.measurements) {
          const override = ctx.measurementOverrides?.get(key);
          measurements[key] = {
            value: m.value,
            source: m.source,
            hasOverride: override !== undefined,
            overrideValue: override
          };
        }
        return {
          success: true,
          data: {
            builder: ctx.activeBuilder,
            count: Object.keys(measurements).length,
            measurements
          }
        };
      }

      // No run yet - return known measurement names for DiningChair
      // TODO: This should come from builder metadata
      const knownMeasurements = ctx.activeBuilder === 'DiningChair'
        ? ['seat_width', 'seat_depth', 'seat_height', 'seat_thickness', 'leg_radius', 'leg_inset', 'back_height', 'back_thickness', 'back_angle']
        : [];

      return {
        success: true,
        data: {
          builder: ctx.activeBuilder,
          note: 'Run builder first for actual values',
          knownMeasurements
        }
      };
    }
  },

  {
    action: 'get',
    description: 'Get a specific measurement value',
    usage: 'measurement.get <name>',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0, 'name');
      if (!name) {
        return { success: false, error: 'Missing measurement name. Usage: measurement.get <name>' };
      }

      if (!ctx.lastRun) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const measurement = ctx.lastRun.measurements.get(name);
      if (!measurement) {
        const available = Array.from(ctx.lastRun.measurements.keys()).slice(0, 10);
        return {
          success: false,
          error: `Measurement not found: ${name}. Available: ${available.join(', ')}...`
        };
      }

      const override = ctx.measurementOverrides?.get(name);

      return {
        success: true,
        data: {
          name,
          value: measurement.value,
          source: measurement.source,
          hasOverride: override !== undefined,
          overrideValue: override
        }
      };
    }
  },

  {
    action: 'set',
    description: 'Override a measurement value (persists across runs)',
    usage: 'measurement.set <name> <value>',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0, 'name');
      if (!name) {
        return { success: false, error: 'Missing measurement name. Usage: measurement.set <name> <value>' };
      }

      const value = getNumberArg(cmd, 1, 'value');
      if (value === undefined) {
        return { success: false, error: 'Missing or invalid value. Usage: measurement.set <name> <value>' };
      }

      if (!ctx.activeBuilder) {
        return { success: false, error: 'No builder is open. Use builder.open <name> first.' };
      }

      // Initialize overrides map if needed
      if (!ctx.measurementOverrides) {
        ctx.measurementOverrides = new Map();
      }

      const previousValue = ctx.measurementOverrides.get(name);
      ctx.measurementOverrides.set(name, value);

      ctx.broadcast({
        type: 'measurement_changed',
        builder: ctx.activeBuilder,
        measurement: name,
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
    description: 'Remove override for a measurement',
    usage: 'measurement.reset <name>',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0, 'name');
      if (!name) {
        return { success: false, error: 'Missing measurement name. Usage: measurement.reset <name>' };
      }

      if (!ctx.measurementOverrides) {
        return { success: true, data: { message: 'No overrides to reset' } };
      }

      const hadOverride = ctx.measurementOverrides.has(name);
      const previousValue = ctx.measurementOverrides.get(name);
      ctx.measurementOverrides.delete(name);

      if (hadOverride) {
        ctx.broadcast({
          type: 'measurement_reset',
          builder: ctx.activeBuilder,
          measurement: name,
          previousValue
        });
      }

      return {
        success: true,
        data: {
          name,
          wasOverridden: hadOverride,
          previousValue,
          message: hadOverride ? `Reset ${name} to default` : `${name} had no override`
        }
      };
    }
  },

  {
    action: 'reset-all',
    description: 'Clear all measurement overrides',
    usage: 'measurement.reset-all',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const count = ctx.measurementOverrides?.size || 0;

      if (ctx.measurementOverrides) {
        ctx.measurementOverrides.clear();
      }

      if (count > 0) {
        ctx.broadcast({
          type: 'measurements_reset_all',
          builder: ctx.activeBuilder,
          count
        });
      }

      return {
        success: true,
        data: {
          clearedCount: count,
          message: count > 0 ? `Cleared ${count} measurement overrides` : 'No overrides to clear'
        }
      };
    }
  }
];

export const measurementNamespace: CommandNamespace = {
  name: 'measurement',
  description: 'Commands for inspecting and modifying builder measurements',
  handlers
};

