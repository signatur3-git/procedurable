/**
 * Style Commands - DSL commands for style management
 *
 * F2-001: Style Schema and Resolution
 *
 * Commands:
 * - style.list - list all available styles
 * - style.get <name> - get a style definition
 * - style.preview <name> - show style's decision defaults and palette
 * - style.define <name> - create/update a style definition
 */

import { CommandNamespace, CommandHandler, CommandContext, CommandResult } from '../command-registry';
import { ParsedCommand, getArg } from '../command-parser';
import {
  loadStyle,
  listStyles,
  StyleDefinition,
  clearStyleCache
} from '../../../generation/builder/StyleResolver';
import { getMetadataStore } from '../../../storage/MetadataStore';
import * as yaml from 'yaml';

/**
 * Parse style definition from command options (JSON or YAML format)
 */
function parseStyleDefinition(cmd: ParsedCommand): StyleDefinition | null {
  const defStr = cmd.options['definition'] as string || cmd.options['def'] as string;
  if (!defStr) return null;

  try {
    // Try JSON first
    return JSON.parse(defStr);
  } catch {
    try {
      // Try YAML
      return yaml.parse(defStr);
    } catch {
      return null;
    }
  }
}

const styleHandlers: CommandHandler[] = [
  {
    action: 'list',
    description: 'List all available style definitions',
    usage: 'style.list',
    execute: async (_cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      try {
        const styles = await listStyles();

        return {
          success: true,
          data: {
            count: styles.length,
            styles,
            message: `${styles.length} style(s) available`
          }
        };
      } catch (err) {
        return {
          success: false,
          error: `Failed to list styles: ${(err as Error).message}`
        };
      }
    }
  },

  {
    action: 'get',
    description: 'Get a style definition by name',
    usage: 'style.get <name>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0);
      if (!name) {
        return { success: false, error: 'Usage: style.get <name>' };
      }

      try {
        const style = await loadStyle(name);
        if (!style) {
          return { success: false, error: `Style '${name}' not found` };
        }

        return {
          success: true,
          data: {
            name: style.name,
            style
          }
        };
      } catch (err) {
        return {
          success: false,
          error: `Failed to load style: ${(err as Error).message}`
        };
      }
    }
  },

  {
    action: 'preview',
    description: 'Preview a style\'s decision defaults and material palette',
    usage: 'style.preview <name>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0);
      if (!name) {
        return { success: false, error: 'Usage: style.preview <name>' };
      }

      try {
        const style = await loadStyle(name);
        if (!style) {
          return { success: false, error: `Style '${name}' not found` };
        }

        return {
          success: true,
          data: {
            name: style.name,
            description: style.description,
            decision_defaults: style.decision_defaults || {},
            material_palette: style.material_palette || {},
            proportion_rules: style.proportion_rules || [],
            pattern_preferences: style.pattern_preferences || {},
            // Legacy fields summary
            legacy: {
              has_colors: !!style.colors,
              has_materials: !!style.materials,
              has_proportions: !!style.proportions,
              has_ornamentation: !!style.ornamentation
            }
          }
        };
      } catch (err) {
        return {
          success: false,
          error: `Failed to preview style: ${(err as Error).message}`
        };
      }
    }
  },

  {
    action: 'define',
    description: 'Create or update a style definition',
    usage: 'style.define <name> definition=<json|yaml>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0);
      if (!name) {
        return { success: false, error: 'Usage: style.define <name> definition=<json>' };
      }

      const definition = parseStyleDefinition(cmd);
      if (!definition) {
        return { success: false, error: 'Invalid or missing definition. Use definition=<json|yaml>' };
      }

      // Ensure name matches
      definition.name = definition.name || name;

      try {
        const store = getMetadataStore();
        const key = `styles/${name}`;

        await store.set(key, definition, {
          description: definition.description || `Style: ${name}`,
          tags: ['style', name]
        });

        // Clear cache to pick up changes
        clearStyleCache();

        return {
          success: true,
          data: {
            name,
            key,
            decision_defaults_count: Object.keys(definition.decision_defaults || {}).length,
            material_palette_count: Object.keys(definition.material_palette || {}).length,
            proportion_rules_count: (definition.proportion_rules || []).length,
            message: `Style '${name}' saved`
          }
        };
      } catch (err) {
        return {
          success: false,
          error: `Failed to save style: ${(err as Error).message}`
        };
      }
    }
  },

  {
    action: 'delete',
    description: 'Delete a style definition',
    usage: 'style.delete <name>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0);
      if (!name) {
        return { success: false, error: 'Usage: style.delete <name>' };
      }

      try {
        const store = getMetadataStore();
        const key = `styles/${name}`;

        const exists = await store.exists(key);
        if (!exists) {
          return { success: false, error: `Style '${name}' not found` };
        }

        await store.delete(key);
        clearStyleCache();

        return {
          success: true,
          data: {
            name,
            message: `Style '${name}' deleted`
          }
        };
      } catch (err) {
        return {
          success: false,
          error: `Failed to delete style: ${(err as Error).message}`
        };
      }
    }
  }
];

// Namespace export for server registration
export const styleNamespace: CommandNamespace = {
  name: 'style',
  description: 'Style definition management (F2-001)',
  handlers: styleHandlers
};
