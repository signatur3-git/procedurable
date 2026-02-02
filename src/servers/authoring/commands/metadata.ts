/**
 * Metadata DSL Commands (B3-002)
 *
 * Exposes the MetadataStore through DSL commands for agent use during authoring sessions.
 */

import { CommandNamespace, CommandHandler, ParsedCommand, CommandResult, CommandContext } from '../command-types';
import { getMetadataStore, MetadataNotFoundError, InvalidKeyError } from '../../../storage/MetadataStore';
import * as yaml from 'yaml';

// =============================================================================
// Helpers
// =============================================================================

function getArg(cmd: ParsedCommand, index: number): string | undefined {
  return cmd.args[index];
}

function getRemainingArgs(cmd: ParsedCommand, fromIndex: number): string {
  return cmd.args.slice(fromIndex).join(' ');
}

// =============================================================================
// Handlers
// =============================================================================

const handlers: CommandHandler[] = [
  {
    action: 'get',
    description: 'Get a metadata entry by key',
    usage: 'metadata.get <key>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const key = getArg(cmd, 0);
      if (!key) {
        return { success: false, error: 'Usage: metadata.get <key>' };
      }

      try {
        const store = getMetadataStore();
        const entry = await store.get(key);

        return {
          success: true,
          data: {
            key: entry.key,
            value: entry.value,
            description: entry.description,
            tags: entry.tags,
            createdAt: entry.createdAt.toISOString(),
            modifiedAt: entry.modifiedAt.toISOString()
          }
        };
      } catch (err) {
        if (err instanceof MetadataNotFoundError) {
          return { success: false, error: `Metadata not found: ${key}` };
        }
        throw err;
      }
    }
  },

  {
    action: 'set',
    description: 'Set a metadata entry (value can be YAML inline or JSON)',
    usage: 'metadata.set <key> <value>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const key = getArg(cmd, 0);
      if (!key) {
        return { success: false, error: 'Usage: metadata.set <key> <value>' };
      }

      const valueStr = getRemainingArgs(cmd, 1);
      if (!valueStr) {
        return { success: false, error: 'Usage: metadata.set <key> <value>' };
      }

      // Parse value as YAML (which also handles JSON)
      let value: unknown;
      try {
        value = yaml.parse(valueStr);
      } catch (e) {
        // If YAML parsing fails, treat as plain string
        value = valueStr;
      }

      try {
        const store = getMetadataStore();
        await store.set(key, value);

        return {
          success: true,
          data: {
            key,
            message: `Metadata '${key}' saved`
          }
        };
      } catch (err) {
        if (err instanceof InvalidKeyError) {
          return { success: false, error: err.message };
        }
        throw err;
      }
    }
  },

  {
    action: 'set-yaml',
    description: 'Set a metadata entry from multi-line YAML',
    usage: 'metadata.set-yaml <key>\n<yaml content>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const key = getArg(cmd, 0);
      if (!key) {
        return { success: false, error: 'Usage: metadata.set-yaml <key>\\n<yaml content>' };
      }

      // The rest of the command is the YAML content (may include newlines)
      const yamlContent = getRemainingArgs(cmd, 1);
      if (!yamlContent) {
        return { success: false, error: 'Usage: metadata.set-yaml <key>\\n<yaml content>' };
      }

      let value: unknown;
      try {
        value = yaml.parse(yamlContent);
      } catch (e) {
        return { success: false, error: `Invalid YAML: ${(e as Error).message}` };
      }

      try {
        const store = getMetadataStore();
        await store.set(key, value);

        return {
          success: true,
          data: {
            key,
            message: `Metadata '${key}' saved`
          }
        };
      } catch (err) {
        if (err instanceof InvalidKeyError) {
          return { success: false, error: err.message };
        }
        throw err;
      }
    }
  },

  {
    action: 'list',
    description: 'List metadata keys, optionally filtered by prefix',
    usage: 'metadata.list [prefix]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const prefix = getArg(cmd, 0);

      const store = getMetadataStore();
      const result = await store.list({ prefix });

      return {
        success: true,
        data: {
          keys: result.keys,
          total: result.total,
          prefix: prefix || '(all)'
        }
      };
    }
  },

  {
    action: 'delete',
    description: 'Delete a metadata entry',
    usage: 'metadata.delete <key>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const key = getArg(cmd, 0);
      if (!key) {
        return { success: false, error: 'Usage: metadata.delete <key>' };
      }

      try {
        const store = getMetadataStore();
        await store.delete(key);

        return {
          success: true,
          data: {
            key,
            message: `Metadata '${key}' deleted`
          }
        };
      } catch (err) {
        if (err instanceof MetadataNotFoundError) {
          return { success: false, error: `Metadata not found: ${key}` };
        }
        throw err;
      }
    }
  },

  {
    action: 'exists',
    description: 'Check if a metadata key exists',
    usage: 'metadata.exists <key>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const key = getArg(cmd, 0);
      if (!key) {
        return { success: false, error: 'Usage: metadata.exists <key>' };
      }

      const store = getMetadataStore();
      const exists = await store.exists(key);

      return {
        success: true,
        data: {
          key,
          exists
        }
      };
    }
  },

  {
    action: 'search',
    description: 'Search metadata by prefix and optionally get values',
    usage: 'metadata.search <prefix> [--values]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const prefix = getArg(cmd, 0);
      if (!prefix) {
        return { success: false, error: 'Usage: metadata.search <prefix> [--values]' };
      }

      const includeValues = cmd.args.includes('--values');

      const store = getMetadataStore();

      if (includeValues) {
        const entries = await store.getAll(prefix);
        return {
          success: true,
          data: {
            prefix,
            count: entries.length,
            entries: entries.map(e => ({
              key: e.key,
              value: e.value,
              description: e.description,
              tags: e.tags
            }))
          }
        };
      } else {
        const result = await store.list({ prefix });
        return {
          success: true,
          data: {
            prefix,
            keys: result.keys,
            total: result.total
          }
        };
      }
    }
  }
];

// =============================================================================
// Export Namespace
// =============================================================================

export const metadataNamespace: CommandNamespace = {
  name: 'metadata',
  description: 'Commands for storing and retrieving domain knowledge',
  handlers
};
