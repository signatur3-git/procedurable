/**
 * YamlBuilderParser - Parse YAML builder definitions and execute them
 *
 * Converts declarative YAML to TracedBuilder method calls.
 * Delegates execution to YamlBuilderExecutor which uses the command registry.
 */

import { TracedOutput } from './TracedBuilder';
import { executeBuilder } from './YamlBuilderExecutor';
import { SharedContext } from './SharedContext';
import type { YamlBuilderDefinition } from './YamlBuilderTypes';

// Re-export types for backwards compatibility
export type {
  YamlBuilderDefinition,
  YamlDecision,
  YamlMeasurement,
  YamlMaterial,
  YamlProfile,
  YamlSpline,
  YamlShape,
  YamlGeometryCommand,
  YamlComposition,
  YamlPlacement,
  YamlPosition,
  YamlColor
} from './YamlBuilderTypes';

// ============================================================================
// PARSER
// ============================================================================

export interface ParseOptions {
  seed?: number;
  overrides?: Record<string, any>;
  builderResolver?: (name: string) => ((seed: number, overrides?: Record<string, any>) => TracedOutput | Promise<TracedOutput>) | null;
  constraintResolver?: (key: string) => import('../validation/ConstraintEvaluator').ConstraintSchema | null;  // F1-002
  sharedContext?: SharedContext;  // Scene-level shared state (P2-M2d-003)
}

/**
 * Parse and execute a YAML builder definition.
 *
 * This function delegates to executeBuilder() in YamlBuilderExecutor
 * which uses the command registry for geometry processing.
 */
export async function parseAndExecuteBuilder(
  yaml: YamlBuilderDefinition,
  options?: ParseOptions
): Promise<TracedOutput> {
  // Delegate to the new executor
  return executeBuilder(yaml, options);
}

// ============================================================================
// YAML PARSING (using simple regex for now, can switch to yaml library)
// ============================================================================

/**
 * Parse YAML string to builder definition
 * Note: For production, use a proper YAML library like 'yaml' or 'js-yaml'
 */
export function parseYaml(_content: string): YamlBuilderDefinition {
  // This is a placeholder - we'll use a YAML library
  // For now, assume content is already parsed JSON/object
  throw new Error('YAML parsing requires yaml library - use parseYamlWithLibrary instead');
}

/**
 * Parse YAML using the yaml library (must be installed)
 */
export async function parseYamlWithLibrary(content: string): Promise<YamlBuilderDefinition> {
  // Dynamic import to avoid bundling if not used
  const yaml = await import('yaml');
  return yaml.parse(content) as YamlBuilderDefinition;
}

// ============================================================================
// BUILDER REGISTRY
// ============================================================================

export interface BuilderRegistry {
  /**
   * Get a builder function by name
   */
  get(name: string): ((seed: number, overrides?: Record<string, any>) => TracedOutput) | null;

  /**
   * Register a builder function
   */
  register(name: string, fn: (seed: number, overrides?: Record<string, any>) => TracedOutput): void;

  /**
   * List all registered builders
   */
  list(): string[];
}

/**
 * Simple in-memory builder registry
 */
export function createBuilderRegistry(): BuilderRegistry {
  const builders = new Map<string, (seed: number, overrides?: Record<string, any>) => TracedOutput>();

  return {
    get(name: string) {
      return builders.get(name) ?? null;
    },

    register(name: string, fn: (seed: number, overrides?: Record<string, any>) => TracedOutput) {
      builders.set(name, fn);
    },

    list() {
      return Array.from(builders.keys());
    }
  };
}
