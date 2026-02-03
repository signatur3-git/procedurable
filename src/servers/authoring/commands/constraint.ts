/**
 * Constraint Commands - DSL commands for constraint schema management
 *
 * F1-001: Constraint Schema Definition
 * F1-003: Built-in Domain Constraint Libraries
 *
 * Commands:
 * - constraint.define <key> - stores a constraint schema (JSON input)
 * - constraint.evaluate <key> - evaluates schema against provided bindings
 * - constraint.list - lists defined constraint schemas
 * - constraint.get <key> - get a constraint schema definition
 * - constraint.delete <key> - delete a constraint schema
 * - constraint.validate - validate schema without storing
 * - constraint.load <metadata_key> - load constraint schema from metadata store
 */

import { CommandNamespace, CommandHandler, CommandContext, CommandResult } from '../command-registry';
import { ParsedCommand, getArg } from '../command-parser';
import {
  ConstraintEvaluator,
  ConstraintSchema
} from '../../../generation/validation/ConstraintEvaluator';
import { getMetadataStore, MetadataNotFoundError } from '../../../storage/MetadataStore';

// In-memory storage for constraint schemas (fallback; prefers metadata files)
const constraintSchemas = new Map<string, ConstraintSchema>();

/**
 * Load constraint schema from metadata store
 * @param key - Metadata key (e.g., 'constraints/mechanical/gear_mesh')
 * @returns The constraint schema or null if not found/invalid
 */
async function loadSchemaFromMetadata(key: string): Promise<ConstraintSchema | null> {
  try {
    const store = getMetadataStore();
    const entry = await store.get<ConstraintSchema>(key);
    if (entry?.value) {
      return entry.value;
    }
    return null;
  } catch (err) {
    if (err instanceof MetadataNotFoundError) {
      return null;
    }
    throw err;
  }
}

/**
 * Get constraint schema by key - checks in-memory first, then metadata
 */
async function getConstraintSchema(key: string): Promise<ConstraintSchema | null> {
  // Check in-memory first
  const memSchema = constraintSchemas.get(key);
  if (memSchema) return memSchema;

  // Try loading from metadata
  return loadSchemaFromMetadata(key);
}

/**
 * Get option from parsed command
 */
function getOption(cmd: ParsedCommand, name: string): string | undefined {
  return cmd.options[name] as string | undefined;
}

/**
 * Parse constraint schema from command options (JSON format)
 */
function parseConstraintSchema(cmd: ParsedCommand): ConstraintSchema | null {
  const schemaStr = getOption(cmd, 'schema');
  if (schemaStr) {
    try {
      return JSON.parse(schemaStr);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Parse variable bindings from command options (format: var_name=value)
 */
function parseBindings(cmd: ParsedCommand): Record<string, any> {
  const bindings: Record<string, any> = {};

  for (const [key, value] of Object.entries(cmd.options)) {
    if (key === 'key' || key === 'schema') continue;

    // Try to parse as JSON first (for arrays, objects)
    try {
      bindings[key] = JSON.parse(value as string);
    } catch {
      // Try as number
      const num = parseFloat(value as string);
      if (!isNaN(num)) {
        bindings[key] = num;
      } else if (value === 'true') {
        bindings[key] = true;
      } else if (value === 'false') {
        bindings[key] = false;
      } else {
        bindings[key] = value;
      }
    }
  }

  return bindings;
}

// Export for testing
export { constraintSchemas };

const constraintHandlers: CommandHandler[] = [
  {
    action: 'define',
    description: 'Define a constraint schema',
    usage: 'constraint.define <key> schema=<json>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const key = getArg(cmd, 0);
      if (!key) {
        return { success: false, error: 'Usage: constraint.define <key> schema=<json>' };
      }

      const schema = parseConstraintSchema(cmd);
      if (!schema) {
        return { success: false, error: 'Invalid or missing schema. Use schema=<json> option.' };
      }

      const errors = ConstraintEvaluator.validateSchema(schema);
      if (errors.length > 0) {
        return { success: false, error: `Schema validation failed:\n${errors.join('\n')}` };
      }

      constraintSchemas.set(key, schema);

      return {
        success: true,
        data: {
          key,
          schema: schema.name,
          description: schema.description,
          variables: Object.keys(schema.variables).length,
          rules: schema.rules.length,
          message: `Constraint schema '${key}' defined with ${schema.rules.length} rules`
        }
      };
    }
  },

  {
    action: 'evaluate',
    description: 'Evaluate a constraint schema against variable bindings (loads from metadata if not defined in-memory)',
    usage: 'constraint.evaluate <key> var1=value1 var2=value2 ...',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const key = getArg(cmd, 0);
      if (!key) {
        return { success: false, error: 'Usage: constraint.evaluate <key> var1=value1 ...' };
      }

      const schema = await getConstraintSchema(key);
      if (!schema) {
        return { success: false, error: `Constraint schema '${key}' not found (checked in-memory and metadata)` };
      }

      const bindings = parseBindings(cmd);
      const missingVars = Object.keys(schema.variables).filter(v => !(v in bindings));
      if (missingVars.length > 0) {
        return { success: false, error: `Missing required variables: ${missingVars.join(', ')}` };
      }

      const result = ConstraintEvaluator.evaluate(schema, bindings);

      return {
        success: true,
        data: {
          schema: result.schema,
          passed: result.passed,
          summary: result.summary,
          results: result.results.map(r => ({
            type: r.rule.type,
            description: r.rule.description,
            passed: r.passed,
            message: r.message
          })),
          message: result.passed
            ? `All ${result.summary.total} constraints passed`
            : `${result.summary.failed} of ${result.summary.total} constraints failed`
        }
      };
    }
  },

  {
    action: 'list',
    description: 'List all defined constraint schemas',
    usage: 'constraint.list',
    execute: async (_cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const schemas = Array.from(constraintSchemas.entries()).map(([key, schema]) => ({
        key,
        name: schema.name,
        description: schema.description,
        variables: Object.keys(schema.variables).length,
        rules: schema.rules.length
      }));

      return {
        success: true,
        data: {
          count: schemas.length,
          schemas,
          message: `${schemas.length} constraint schema(s) defined`
        }
      };
    }
  },

  {
    action: 'get',
    description: 'Get a constraint schema definition (checks in-memory and metadata)',
    usage: 'constraint.get <key>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const key = getArg(cmd, 0);
      if (!key) {
        return { success: false, error: 'Usage: constraint.get <key>' };
      }

      const schema = await getConstraintSchema(key);
      if (!schema) {
        return { success: false, error: `Constraint schema '${key}' not found (checked in-memory and metadata)` };
      }

      return {
        success: true,
        data: {
          key,
          schema,
          source: constraintSchemas.has(key) ? 'in-memory' : 'metadata'
        }
      };
    }
  },

  {
    action: 'delete',
    description: 'Delete a constraint schema',
    usage: 'constraint.delete <key>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const key = getArg(cmd, 0);
      if (!key) {
        return { success: false, error: 'Usage: constraint.delete <key>' };
      }

      if (!constraintSchemas.has(key)) {
        return { success: false, error: `Constraint schema '${key}' not found` };
      }

      constraintSchemas.delete(key);
      return { success: true, data: { key, message: `Constraint schema '${key}' deleted` } };
    }
  },

  {
    action: 'validate',
    description: 'Validate a constraint schema definition without storing it',
    usage: 'constraint.validate schema=<json>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const schema = parseConstraintSchema(cmd);
      if (!schema) {
        return { success: false, error: 'Invalid or missing schema. Use schema=<json> option.' };
      }

      const errors = ConstraintEvaluator.validateSchema(schema);

      if (errors.length === 0) {
        return {
          success: true,
          data: {
            valid: true,
            schema: schema.name,
            variables: Object.keys(schema.variables).length,
            rules: schema.rules.length,
            message: 'Schema is valid'
          }
        };
      } else {
        return {
          success: true,
          data: {
            valid: false,
            errors,
            message: `Schema has ${errors.length} validation error(s)`
          }
        };
      }
    }
  },

  {
    action: 'load',
    description: 'Load a constraint schema from metadata store into memory',
    usage: 'constraint.load <metadata_key>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const key = getArg(cmd, 0);
      if (!key) {
        return { success: false, error: 'Usage: constraint.load <metadata_key>' };
      }

      const schema = await loadSchemaFromMetadata(key);
      if (!schema) {
        return { success: false, error: `Constraint schema not found in metadata: ${key}` };
      }

      const errors = ConstraintEvaluator.validateSchema(schema);
      if (errors.length > 0) {
        return {
          success: false,
          error: `Schema validation failed:\n${errors.join('\n')}`
        };
      }

      // Store in memory for faster subsequent access
      constraintSchemas.set(key, schema);

      return {
        success: true,
        data: {
          key,
          schema: schema.name,
          description: schema.description,
          variables: Object.keys(schema.variables).length,
          rules: schema.rules.length,
          message: `Constraint schema '${key}' loaded from metadata`
        }
      };
    }
  }
];

// Namespace export for server registration
export const constraintNamespace: CommandNamespace = {
  name: 'constraint',
  description: 'Constraint schema definition and evaluation (F1-001, F1-003)',
  handlers: constraintHandlers
};
