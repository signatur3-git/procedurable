/**
 * Math Commands
 *
 * Exposes mathematical expression evaluation to agents:
 *   math.eval <expression> [var=value...]
 *   math.validate <expression>
 *   math.functions
 *   math.constants
 */

import { CommandNamespace, CommandHandler, CommandContext, CommandResult } from '../command-registry';
import { ParsedCommand, getArg } from '../command-parser';
import { evaluate, validate, getAvailableFunctions, getAvailableConstants, perlin2d, perlin3d, fbm, coordinateHash } from '../../core/MathService';

const handlers: CommandHandler[] = [
  {
    action: 'eval',
    description: 'Evaluate a mathematical expression with optional variables',
    usage: 'math.eval <expression> [var1=value1] [var2=value2] ...',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const expression = getArg(cmd, 0, 'expression');

      if (!expression) {
        return {
          success: false,
          error: 'Missing expression. Usage: math.eval <expression> [var=value...]'
        };
      }

      // Parse variable assignments from options
      const variables: Record<string, number> = {};
      for (const [key, value] of Object.entries(cmd.options)) {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          variables[key] = num;
        }
      }

      // Also parse positional args that look like var=value
      for (let i = 1; i < cmd.args.length; i++) {
        const arg = cmd.args[i];
        const eqIdx = arg.indexOf('=');
        if (eqIdx > 0) {
          const varName = arg.substring(0, eqIdx);
          const varValue = parseFloat(arg.substring(eqIdx + 1));
          if (!isNaN(varValue)) {
            variables[varName] = varValue;
          }
        }
      }

      try {
        const result = evaluate(expression, variables);

        return {
          success: true,
          data: {
            expression,
            value: result.value,
            variables: Object.keys(variables).length > 0 ? variables : undefined
          }
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  },

  {
    action: 'validate',
    description: 'Check if a mathematical expression is syntactically valid',
    usage: 'math.validate <expression>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const expression = getArg(cmd, 0, 'expression');

      if (!expression) {
        return {
          success: false,
          error: 'Missing expression. Usage: math.validate <expression>'
        };
      }

      const result = validate(expression);

      return {
        success: true,
        data: {
          expression,
          valid: result.valid,
          error: result.error
        }
      };
    }
  },

  {
    action: 'functions',
    description: 'List all available mathematical functions',
    usage: 'math.functions',
    execute: async (_cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const functions = getAvailableFunctions();

      return {
        success: true,
        data: {
          functions,
          count: functions.length,
          categories: {
            trig: ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2'],
            hyperbolic: ['sinh', 'cosh', 'tanh'],
            basic: ['abs', 'sign', 'sqrt', 'cbrt', 'pow', 'exp'],
            logarithmic: ['log', 'log10', 'log2'],
            rounding: ['floor', 'ceil', 'round', 'trunc'],
            comparison: ['min', 'max', 'equal', 'larger', 'smaller']
          }
        }
      };
    }
  },

  {
    action: 'constants',
    description: 'List all available mathematical constants',
    usage: 'math.constants',
    execute: async (_cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const constants = getAvailableConstants();

      return {
        success: true,
        data: {
          constants,
          examples: {
            'pi': 'π ≈ 3.14159...',
            'e': "Euler's number ≈ 2.71828...",
            'tau': '2π ≈ 6.28318...'
          }
        }
      };
    }
  },

  {
    action: 'noise',
    description: 'Generate Perlin noise value at coordinates',
    usage: 'math.noise x=<x> y=<y> [z=<z>] [seed=<seed>]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const x = parseFloat(cmd.options['x'] || '0');
      const y = parseFloat(cmd.options['y'] || '0');
      const z = cmd.options['z'] !== undefined ? parseFloat(cmd.options['z']) : undefined;
      const seed = parseInt(cmd.options['seed'] || '0', 10);

      if (isNaN(x) || isNaN(y)) {
        return { success: false, error: 'Invalid coordinates. Usage: math.noise x=1.5 y=2.3' };
      }

      const value = z !== undefined ? perlin3d(x, y, z, seed) : perlin2d(x, y, seed);

      return {
        success: true,
        data: {
          x, y, z,
          seed,
          value,
          normalized: (value + 1) / 2  // Map [-1,1] to [0,1]
        }
      };
    }
  },

  {
    action: 'fbm',
    description: 'Generate Fractal Brownian Motion (layered noise)',
    usage: 'math.fbm x=<x> y=<y> [seed=<seed>] [octaves=4] [persistence=0.5]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const x = parseFloat(cmd.options['x'] || '0');
      const y = parseFloat(cmd.options['y'] || '0');
      const seed = parseInt(cmd.options['seed'] || '0', 10);
      const octaves = parseInt(cmd.options['octaves'] || '4', 10);
      const persistence = parseFloat(cmd.options['persistence'] || '0.5');

      if (isNaN(x) || isNaN(y)) {
        return { success: false, error: 'Invalid coordinates. Usage: math.fbm x=1.5 y=2.3' };
      }

      const value = fbm(x, y, seed, octaves, persistence);

      return {
        success: true,
        data: {
          x, y,
          seed,
          octaves,
          persistence,
          value,
          normalized: (value + 1) / 2
        }
      };
    }
  },

  {
    action: 'hash',
    description: 'Generate deterministic hash from coordinates (for seeding)',
    usage: 'math.hash seed=<seed> x=<x> [y=<y>] [z=<z>]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const seed = parseInt(cmd.options['seed'] || '0', 10);
      const x = parseFloat(cmd.options['x'] || '0');
      const y = parseFloat(cmd.options['y'] || '0');
      const z = parseFloat(cmd.options['z'] || '0');

      const value = coordinateHash(seed, x, y, z);

      return {
        success: true,
        data: {
          seed, x, y, z,
          value,
          asInt: Math.floor(value * 0x7FFFFFFF)  // Convert to integer seed
        }
      };
    }
  }
];

export const mathNamespace: CommandNamespace = {
  name: 'math',
  description: 'Mathematical expression evaluation for calculations',
  handlers: handlers
};

