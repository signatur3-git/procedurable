/**
 * Texture Commands
 *
 * G6-004: Texture Housekeeping
 */

import { CommandNamespace, CommandHandler, CommandContext, CommandResult } from '../command-registry';
import { ParsedCommand, getArg } from '../command-parser';
import { textureCache, formatBytes, formatAge, parseDuration } from '../../../storage/TextureCache';
import { storage } from './storage';

const handlers: CommandHandler[] = [
  {
    action: 'list',
    description: 'List all cached textures, optionally filtered by builder name',
    usage: 'texture.list [builder]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const builderName = getArg(cmd, 0);
      try {
        const textures = await textureCache.listTextures(builderName);
        if (textures.length === 0) {
          return { success: true, data: { message: builderName ? `No textures for '${builderName}'` : 'No textures in cache', textures: [] } };
        }
        const totalBytes = textures.reduce((s, t) => s + t.sizeBytes, 0);
        return {
          success: true,
          data: {
            totalFiles: textures.length,
            totalSize: formatBytes(totalBytes),
            textures: textures.map(t => ({ filename: t.filename, builder: t.builderName, channel: t.channel, size: formatBytes(t.sizeBytes), age: formatAge(t.ageMs) }))
          }
        };
      } catch (err) {
        return { success: false, error: `Failed to list textures: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
  },
  {
    action: 'size',
    description: 'Report total texture cache size',
    usage: 'texture.size',
    execute: async (_cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      try {
        const summary = await textureCache.getSummary();
        const builderSizes: Record<string, string> = {};
        for (const [builder, files] of summary.byBuilder) {
          builderSizes[builder] = formatBytes(files.reduce((s, f) => s + f.sizeBytes, 0));
        }
        return { success: true, data: { totalFiles: summary.totalFiles, totalSize: formatBytes(summary.totalBytes), builderCount: summary.byBuilder.size, builderSizes, cacheDir: textureCache.getCacheDir() } };
      } catch (err) {
        return { success: false, error: `Failed to get cache size: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
  },
  {
    action: 'clean',
    description: 'Clean up old or orphaned textures (dry-run by default)',
    usage: 'texture.clean [builder] [older_than=<duration>] [--force]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const builderName = getArg(cmd, 0);
      const olderThanStr = cmd.options['older_than'] as string;
      const deleteOrphans = cmd.options['orphans'] === true;
      const force = cmd.options['force'] === true;
      let olderThanMs: number | undefined;
      if (olderThanStr) {
        olderThanMs = parseDuration(olderThanStr);
        if (olderThanMs === null) return { success: false, error: `Invalid duration: '${olderThanStr}'` };
      }
      let knownBuilders: Set<string> | undefined;
      if (deleteOrphans) { try { knownBuilders = new Set(await storage.list()); } catch { knownBuilders = new Set(); } }
      if (!olderThanMs && !deleteOrphans && !builderName) olderThanMs = 7 * 24 * 60 * 60 * 1000;
      try {
        const result = await textureCache.clean({ builderName, olderThanMs, deleteOrphans, knownBuilders, force });
        if (result.files.length === 0) return { success: true, data: { message: 'No textures match cleanup criteria', filesDeleted: 0, dryRun: !force } };
        return { success: true, data: { message: `${force ? 'Deleted' : 'Would delete'} ${result.files.length} file(s)`, filesDeleted: result.files.length, bytesFreed: formatBytes(result.bytesFreed), dryRun: !force, files: result.files.map(f => ({ filename: f.filename, reason: result.reasons.get(f.filename) })) } };
      } catch (err) {
        return { success: false, error: `Failed to clean: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
  },
  {
    action: 'delete',
    description: 'Delete all textures for a specific builder (dry-run by default)',
    usage: 'texture.delete <builder> [--force]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const builderName = getArg(cmd, 0);
      if (!builderName) return { success: false, error: 'Usage: texture.delete <builder> [--force]' };
      const force = cmd.options['force'] === true;
      try {
        const result = await textureCache.deleteBuilder(builderName, force);
        if (result.files.length === 0) return { success: true, data: { message: `No textures for '${builderName}'`, filesDeleted: 0 } };
        return { success: true, data: { message: `${force ? 'Deleted' : 'Would delete'} ${result.files.length} texture(s) for '${builderName}'`, filesDeleted: result.files.length, bytesFreed: formatBytes(result.bytesFreed), dryRun: !force, files: result.files.map(f => f.filename) } };
      } catch (err) {
        return { success: false, error: `Failed to delete: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
  }
];

export const textureNamespace: CommandNamespace = {
  name: 'texture',
  description: 'Commands for managing the baked texture cache (G6-004)',
  handlers
};
