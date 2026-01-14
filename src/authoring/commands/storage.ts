/**
 * Storage Commands
 *
 * Commands for managing builder storage:
 *   storage.list [prefix=<path>]
 *   storage.get <name>
 *   storage.save <name>
 *   storage.delete <name>
 *   storage.export <name>
 */

import { CommandNamespace, CommandHandler, CommandContext, CommandResult } from '../command-registry';
import { ParsedCommand, getArg, getStringOption } from '../command-parser';
import { FileSystemStorage } from '../../storage/FileSystemStorage';
import * as path from 'path';

// Initialize storage with builders directory
const storage = new FileSystemStorage({
  rootDir: path.resolve(process.cwd(), 'builders'),
  watch: true
});

const handlers: CommandHandler[] = [
  {
    action: 'list',
    description: 'List all YAML builders in storage',
    usage: 'storage.list [prefix=<path>]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const prefix = getStringOption(cmd, 'prefix');

      try {
        const result = await storage.list({ prefix: prefix ?? undefined });

        return {
          success: true,
          data: {
            builders: result.builders.map(b => ({
              name: b.name,
              description: b.description,
              tags: b.tags,
              modifiedAt: b.modifiedAt.toISOString(),
              size: b.size
            })),
            total: result.total
          }
        };
      } catch (e: any) {
        return { success: false, error: `Failed to list storage: ${e.message}` };
      }
    }
  },

  {
    action: 'get',
    description: 'Get a YAML builder definition from storage',
    usage: 'storage.get <name>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0, 'name');

      if (!name) {
        return { success: false, error: 'Missing builder name. Usage: storage.get <name>' };
      }

      try {
        const stored = await storage.get(name);

        return {
          success: true,
          data: {
            name: stored.metadata.name,
            description: stored.metadata.description,
            modifiedAt: stored.metadata.modifiedAt.toISOString(),
            content: stored.content
          }
        };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
  },

  {
    action: 'save',
    description: 'Save a YAML builder definition to storage',
    usage: 'storage.save <name> content=<yaml>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0, 'name');
      const content = getStringOption(cmd, 'content');

      if (!name) {
        return { success: false, error: 'Missing builder name. Usage: storage.save <name> content=<yaml>' };
      }

      if (!content) {
        return { success: false, error: 'Missing content. Usage: storage.save <name> content=<yaml>' };
      }

      try {
        await storage.put(name, content);

        return {
          success: true,
          data: {
            name,
            message: `Saved builder: ${name}`
          }
        };
      } catch (e: any) {
        return { success: false, error: `Failed to save builder: ${e.message}` };
      }
    }
  },

  {
    action: 'delete',
    description: 'Delete a YAML builder from storage',
    usage: 'storage.delete <name>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0, 'name');

      if (!name) {
        return { success: false, error: 'Missing builder name. Usage: storage.delete <name>' };
      }

      try {
        await storage.delete(name);

        return {
          success: true,
          data: {
            name,
            message: `Deleted builder: ${name}`
          }
        };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
  },

  {
    action: 'exists',
    description: 'Check if a builder exists in storage',
    usage: 'storage.exists <name>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const name = getArg(cmd, 0, 'name');

      if (!name) {
        return { success: false, error: 'Missing builder name. Usage: storage.exists <name>' };
      }

      const exists = await storage.exists(name);

      return {
        success: true,
        data: { name, exists }
      };
    }
  }
];

export const storageNamespace: CommandNamespace = {
  name: 'storage',
  description: 'Commands for managing builder storage (YAML files)',
  handlers: handlers
};

// Export storage instance for use by other parts of the system
export { storage };

