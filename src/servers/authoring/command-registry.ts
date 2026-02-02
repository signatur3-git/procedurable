/**
 * Command Registry
 *
 * Registers and executes DSL command handlers.
 * Handlers are organized by namespace (builder, measurement, decision, etc.)
 */

import { ParsedCommand } from './command-parser';

/**
 * Context passed to command handlers
 */
export interface CommandContext {
  // Current state
  activeBuilder: string | null;
  activeBuilderSource: 'yaml' | 'typescript' | null;  // Track which source to use
  lastRun: any | null;  // TracedOutput
  runHistory: any[];

  // Cached PSD scene (B2-003) - lazily populated from lastRun
  lastPSDScene: any | null;  // PSDScene

  // Persistent overrides (applied on every run)
  measurementOverrides: Map<string, number>;
  decisionOverrides: Map<string, any>;

  // Services (will be injected)
  getBuilder: (name: string) => any;
  runBuilder: (name: string, seed: number, overrides?: Record<string, any>, source?: 'yaml' | 'typescript') => Promise<any>;

  // Broadcasting
  broadcast: (event: any) => void;
}

/**
 * Structured error information for better debugging
 */
export interface CommandError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional details (expression, line number, etc.) */
  details?: Record<string, any>;
  /** Suggested fix */
  suggestion?: string;
  /** Stack trace (only in debug mode) */
  stack?: string;
}

/**
 * Result of executing a command
 */
export interface CommandResult {
  success: boolean;
  data?: any;
  /** Simple error string (backward compatible) */
  error?: string;
  /** Structured error information (enhanced) */
  errorInfo?: CommandError;
}

/**
 * A command handler
 */
export interface CommandHandler {
  /** The action name (e.g., "open" for "builder.open") */
  action: string;

  /** Human-readable description */
  description: string;

  /** Usage pattern (e.g., "builder.open <name>") */
  usage: string;

  /** Execute the command */
  execute: (cmd: ParsedCommand, ctx: CommandContext) => Promise<CommandResult>;
}

/**
 * A namespace of commands
 */
export interface CommandNamespace {
  name: string;
  description: string;
  handlers: CommandHandler[];
}

/**
 * The command registry
 */
class CommandRegistry {
  private namespaces: Map<string, CommandNamespace> = new Map();

  /**
   * Register a namespace with its handlers
   */
  registerNamespace(ns: CommandNamespace): void {
    this.namespaces.set(ns.name, ns);
  }

  /**
   * Get a handler for a command
   */
  getHandler(namespace: string, action: string): CommandHandler | undefined {
    const ns = this.namespaces.get(namespace);
    if (!ns) return undefined;
    return ns.handlers.find(h => h.action === action);
  }

  /**
   * Execute a parsed command
   */
  async execute(cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> {
    const handler = this.getHandler(cmd.namespace, cmd.action);

    if (!handler) {
      return {
        success: false,
        error: `Unknown command: ${cmd.namespace}.${cmd.action}`
      };
    }

    try {
      return await handler.execute(cmd, ctx);
    } catch (err: any) {
      // Parse error for structured information
      const errorInfo = parseError(err, cmd);
      return {
        success: false,
        error: errorInfo.message,
        errorInfo
      };
    }
  }

  /**
   * Get help for all commands
   */
  getHelp(): Record<string, { description: string; commands: { usage: string; description: string }[] }> {
    const help: Record<string, any> = {};

    for (const [name, ns] of this.namespaces) {
      help[name] = {
        description: ns.description,
        commands: ns.handlers.map(h => ({
          usage: h.usage,
          description: h.description
        }))
      };
    }

    return help;
  }

  /**
   * Get all registered namespaces
   */
  getNamespaces(): string[] {
    return Array.from(this.namespaces.keys());
  }
}

/**
 * Parse an error into structured format with helpful information
 */
function parseError(err: any, cmd: ParsedCommand): CommandError {
  const message = err.message || 'Command execution failed';

  // Detect error type and provide helpful info
  let code = 'UNKNOWN_ERROR';
  let suggestion: string | undefined;
  let details: Record<string, any> = {};

  // Expression evaluation errors
  if (message.includes('Failed to evaluate expression')) {
    code = 'EXPRESSION_ERROR';
    const exprMatch = message.match(/expression '([^']+)'/);
    if (exprMatch) {
      details.expression = exprMatch[1];
    }
    suggestion = 'Check expression syntax. Use math.validate to test expressions. Available functions: sin, cos, tan, sqrt, abs, min, max. Constants: pi, e, tau.';
  }

  // Builder not found
  else if (message.includes('Unknown builder')) {
    code = 'BUILDER_NOT_FOUND';
    const nameMatch = message.match(/Unknown builder: (\w+)/);
    if (nameMatch) {
      details.builderName = nameMatch[1];
    }
    suggestion = 'Use builder.list to see available builders. For YAML builders, check the file exists in builders/ directory.';
  }

  // No builder open
  else if (message.includes('No builder is open')) {
    code = 'NO_BUILDER_OPEN';
    suggestion = 'Use builder.open <name> before running.';
  }

  // Vertex not found
  else if (message.includes('not found for face') || message.includes('not found for loop')) {
    code = 'VERTEX_NOT_FOUND';
    const vertexMatch = message.match(/Vertex '(\w+)' not found/);
    if (vertexMatch) {
      details.vertexName = vertexMatch[1];
    }
    suggestion = 'Check that the vertex is defined before referencing it. Use builder.traces to see defined vertices.';
  }

  // Loop not found
  else if (message.includes('Loop') && message.includes('not found')) {
    code = 'LOOP_NOT_FOUND';
    const loopMatch = message.match(/Loop '(\w+)' not found/);
    if (loopMatch) {
      details.loopName = loopMatch[1];
    }
    suggestion = 'Check that the loop is defined before referencing it in loft or cap operations.';
  }

  // Geometry errors
  else if (message.includes('Geometry processing failed')) {
    code = 'GEOMETRY_ERROR';
    const cmdMatch = message.match(/command #(\d+)/);
    if (cmdMatch) {
      details.commandIndex = parseInt(cmdMatch[1]);
    }
  }

  // Add command context
  details.command = cmd.raw;

  return {
    code,
    message,
    details: Object.keys(details).length > 0 ? details : undefined,
    suggestion,
    // Only include stack in development
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  };
}

// Singleton registry
export const registry = new CommandRegistry();

