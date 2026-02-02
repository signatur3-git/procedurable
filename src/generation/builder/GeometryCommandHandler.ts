/**
 * GeometryCommandHandler - Base types for geometry command handling
 *
 * Defines the interface for geometry command handlers and the context
 * they receive during execution.
 */

import { TracedBuilder } from './TracedBuilder';
import type { YamlGeometryCommand } from './YamlBuilderTypes';
import type { RGBColor } from '../../platform/materials/MaterialLibrary';

/**
 * Context passed to geometry command handlers during execution.
 */
export interface GeometryCommandContext {
  /** The TracedBuilder being constructed */
  builder: TracedBuilder;

  /** Map of decision names to their resolved values */
  decisionValues: Map<string, any>;

  /** Map of material names to resolved RGB colors */
  materials: Map<string, RGBColor>;

  /** Function to recursively process nested geometry commands */
  processGeometry: (commands: YamlGeometryCommand[]) => Promise<void>;

  /** Function to evaluate numeric expressions */
  evaluateExpression: (expr: string | number) => number;

  /** Function to interpolate template strings like "leg_${i}" */
  interpolateName: (template: string) => string;
}

/**
 * Interface for geometry command handlers.
 * Each handler is responsible for one type of geometry command.
 */
export interface GeometryCommandHandler {
  /**
   * The command key this handler processes (e.g., 'box', 'bevel', 'lathe')
   */
  readonly commandKey: string;

  /**
   * Check if this handler can process the given command
   */
  handles(cmd: YamlGeometryCommand): boolean;

  /**
   * Execute the command and modify the builder accordingly
   */
  execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void>;
}

/**
 * Registry of geometry command handlers.
 * Allows looking up handlers by command key.
 */
export class GeometryCommandRegistry {
  private handlers: Map<string, GeometryCommandHandler> = new Map();

  /**
   * Register a handler for a command type
   */
  register(handler: GeometryCommandHandler): void {
    this.handlers.set(handler.commandKey, handler);
  }

  /**
   * Find a handler that can process the given command
   */
  findHandler(cmd: YamlGeometryCommand): GeometryCommandHandler | undefined {
    // Check each key in the command object
    for (const key of Object.keys(cmd)) {
      const handler = this.handlers.get(key);
      if (handler && handler.handles(cmd)) {
        return handler;
      }
    }
    return undefined;
  }

  /**
   * Get all registered handlers
   */
  getHandlers(): GeometryCommandHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get count of registered handlers
   */
  get size(): number {
    return this.handlers.size;
  }
}

/**
 * Base class for geometry command handlers.
 * Provides common utilities and enforces the handler interface.
 */
export abstract class BaseGeometryCommandHandler implements GeometryCommandHandler {
  abstract readonly commandKey: string;

  handles(cmd: YamlGeometryCommand): boolean {
    return this.commandKey in cmd;
  }

  abstract execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void>;
}
