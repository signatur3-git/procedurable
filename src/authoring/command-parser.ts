/**
 * DSL Command Parser
 *
 * Parses command strings in the format:
 *   namespace.action [positional_args...] [key=value...]
 *
 * Examples:
 *   "builder.open DiningChair"
 *   "builder.run seed=42"
 *   "measurement.set seat_width 0.50"
 *   "loop.create seat_top rect width=seat_width depth=seat_depth"
 */

export interface ParsedCommand {
  namespace: string;
  action: string;
  args: string[];
  options: Record<string, string>;
  raw: string;
}

export interface ParseError {
  message: string;
  position?: number;
}

export type ParseResult =
  | { success: true; command: ParsedCommand }
  | { success: false; error: ParseError };

/**
 * Tokenize a command string, respecting quotes and escapes
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let escape = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      continue;
    }

    if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
      continue;
    }

    if (char === ' ' && !inQuotes) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parse a single command string
 */
export function parseCommand(input: string): ParseResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { success: false, error: { message: 'Empty command' } };
  }

  const tokens = tokenize(trimmed);

  if (tokens.length === 0) {
    return { success: false, error: { message: 'No tokens found' } };
  }

  // First token should be namespace.action or just action (for top-level commands)
  const firstToken = tokens[0];
  const dotIndex = firstToken.indexOf('.');

  let namespace: string;
  let action: string;

  if (dotIndex === -1) {
    // No dot - it's a top-level command (e.g., "version", "status")
    namespace = '';
    action = firstToken;
  } else {
    namespace = firstToken.substring(0, dotIndex);
    action = firstToken.substring(dotIndex + 1);
  }

  if (!action) {
    return {
      success: false,
      error: { message: `Invalid command: action is empty` }
    };
  }

  // Remaining tokens are either positional args or key=value options
  const args: string[] = [];
  const options: Record<string, string> = {};

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    const eqIndex = token.indexOf('=');

    if (eqIndex !== -1) {
      // It's a key=value option
      const key = token.substring(0, eqIndex);
      const value = token.substring(eqIndex + 1);
      options[key] = value;
    } else {
      // It's a positional argument
      args.push(token);
    }
  }

  return {
    success: true,
    command: {
      namespace,
      action,
      args,
      options,
      raw: trimmed
    }
  };
}

/**
 * Parse multiple commands (from YAML commands array)
 */
export function parseCommands(commands: string[]): ParseResult[] {
  return commands.map(cmd => parseCommand(cmd));
}

/**
 * Helper to get a positional arg or option with fallback
 */
export function getArg(cmd: ParsedCommand, index: number, optionName?: string): string | undefined {
  if (cmd.args[index] !== undefined) {
    return cmd.args[index];
  }
  if (optionName && cmd.options[optionName] !== undefined) {
    return cmd.options[optionName];
  }
  return undefined;
}

/**
 * Helper to parse a number from args/options
 */
export function getNumberArg(cmd: ParsedCommand, index: number, optionName?: string): number | undefined {
  const value = getArg(cmd, index, optionName);
  if (value === undefined) return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Helper to get a string option by name
 */
export function getStringOption(cmd: ParsedCommand, optionName: string): string | undefined {
  return cmd.options[optionName];
}

