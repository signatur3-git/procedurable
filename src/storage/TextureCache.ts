/**
 * TextureCache.ts
 *
 * G6-004: Texture Housekeeping
 *
 * Manages the baked texture cache directory (output/textures/).
 * Provides listing, size reporting, and cleanup operations.
 */

import { readdir, stat, unlink, mkdir } from 'fs/promises';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';

/**
 * Information about a cached texture file
 */
export interface TextureFileInfo {
  /** Full path to the texture file */
  path: string;
  /** Filename only */
  filename: string;
  /** Builder name extracted from filename */
  builderName: string;
  /** Texture channel (albedo, normal, roughness, etc.) */
  channel: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Last modified time */
  modifiedTime: Date;
  /** Age in milliseconds */
  ageMs: number;
}

/**
 * Summary of texture cache contents
 */
export interface TextureCacheSummary {
  /** Total number of texture files */
  totalFiles: number;
  /** Total size of all textures in bytes */
  totalBytes: number;
  /** Files grouped by builder name */
  byBuilder: Map<string, TextureFileInfo[]>;
  /** Files grouped by channel */
  byChannel: Map<string, TextureFileInfo[]>;
}

/**
 * Result of a clean operation
 */
export interface CleanResult {
  /** Files that would be / were deleted */
  files: TextureFileInfo[];
  /** Total bytes that would be / were freed */
  bytesFreed: number;
  /** Whether the deletion was actually performed */
  executed: boolean;
  /** Reason for each file deletion */
  reasons: Map<string, string>;
}

/**
 * Options for the clean operation
 */
export interface CleanOptions {
  /** Only clean textures for this builder (optional) */
  builderName?: string;
  /** Delete files older than this many milliseconds */
  olderThanMs?: number;
  /** Delete orphaned textures (builder no longer exists) */
  deleteOrphans?: boolean;
  /** Set of known builder names (for orphan detection) */
  knownBuilders?: Set<string>;
  /** Actually delete files (default: dry-run) */
  force?: boolean;
}

/**
 * Default cache directory
 */
const DEFAULT_CACHE_DIR = 'output/textures';

/**
 * Supported texture file extensions
 */
const TEXTURE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

/**
 * Known texture channel suffixes.
 * Order matters: check compound names like "uv_debug" before simple ones.
 */
const KNOWN_CHANNELS = ['uv_debug', 'albedo', 'normal', 'roughness', 'ao'];

/**
 * Parse a texture filename to extract builder name and channel.
 *
 * Supports two formats:
 *   {builderName}_{channel}.{ext}                    — single-material
 *   {builderName}_{slotName}_{channel}.{ext}          — per-material
 *
 * The channel is identified by matching a known suffix rather than
 * splitting on the last underscore, so material slot names that
 * contain underscores (e.g. "dark_material") are handled correctly.
 *
 * Examples:
 *   DiningChair_albedo.png         → builderName="DiningChair", channel="albedo"
 *   ChessBoard_dark_material_ao.png → builderName="ChessBoard_dark_material", channel="ao"
 *   ChessBoard_uv_debug.png        → builderName="ChessBoard", channel="uv_debug"
 */
export function parseTextureFilename(filename: string): { builderName: string; channel: string } | null {
  const ext = extname(filename).toLowerCase();
  if (!TEXTURE_EXTENSIONS.includes(ext)) {
    return null;
  }

  const nameWithoutExt = basename(filename, ext);

  // Match against known channel suffixes (longest first to handle "uv_debug")
  for (const channel of KNOWN_CHANNELS) {
    const suffix = `_${channel}`;
    if (nameWithoutExt.endsWith(suffix)) {
      const builderName = nameWithoutExt.substring(0, nameWithoutExt.length - suffix.length);
      if (!builderName) return null;
      return { builderName, channel };
    }
  }

  // Fallback: split on last underscore for unknown channel types
  const lastUnderscore = nameWithoutExt.lastIndexOf('_');
  if (lastUnderscore === -1) {
    return null;
  }

  const builderName = nameWithoutExt.substring(0, lastUnderscore);
  const channel = nameWithoutExt.substring(lastUnderscore + 1);

  if (!builderName || !channel) {
    return null;
  }

  return { builderName, channel };
}

/**
 * TextureCache manages the texture cache directory
 */
export class TextureCache {
  private cacheDir: string;

  constructor(cacheDir: string = DEFAULT_CACHE_DIR) {
    this.cacheDir = cacheDir;
  }

  /**
   * Get the cache directory path
   */
  getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * Ensure the cache directory exists
   */
  async ensureDir(): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
  }

  /**
   * Check if the cache directory exists
   */
  exists(): boolean {
    return existsSync(this.cacheDir);
  }

  /**
   * List all texture files in the cache
   */
  async listTextures(builderName?: string): Promise<TextureFileInfo[]> {
    if (!this.exists()) {
      return [];
    }

    const files = await readdir(this.cacheDir);
    const now = Date.now();
    const textures: TextureFileInfo[] = [];

    for (const filename of files) {
      const parsed = parseTextureFilename(filename);
      if (!parsed) continue;

      // Filter by builder name if specified.
      // For per-material textures the parsed builderName includes the slot
      // name (e.g. "ChessBoard_dark_material"), so also match when the
      // parsed name starts with the query followed by an underscore.
      if (builderName && parsed.builderName !== builderName
          && !parsed.builderName.startsWith(builderName + '_')) {
        continue;
      }

      const filePath = join(this.cacheDir, filename);
      try {
        const stats = await stat(filePath);
        if (!stats.isFile()) continue;

        textures.push({
          path: filePath,
          filename,
          builderName: parsed.builderName,
          channel: parsed.channel,
          sizeBytes: stats.size,
          modifiedTime: stats.mtime,
          ageMs: now - stats.mtime.getTime()
        });
      } catch {
        // Skip files we can't stat
        continue;
      }
    }

    // Sort by builder name, then channel
    textures.sort((a, b) => {
      const builderCmp = a.builderName.localeCompare(b.builderName);
      if (builderCmp !== 0) return builderCmp;
      return a.channel.localeCompare(b.channel);
    });

    return textures;
  }

  /**
   * Get a summary of the texture cache
   */
  async getSummary(): Promise<TextureCacheSummary> {
    const textures = await this.listTextures();

    const byBuilder = new Map<string, TextureFileInfo[]>();
    const byChannel = new Map<string, TextureFileInfo[]>();
    let totalBytes = 0;

    for (const tex of textures) {
      totalBytes += tex.sizeBytes;

      // Group by builder
      if (!byBuilder.has(tex.builderName)) {
        byBuilder.set(tex.builderName, []);
      }
      byBuilder.get(tex.builderName)!.push(tex);

      // Group by channel
      if (!byChannel.has(tex.channel)) {
        byChannel.set(tex.channel, []);
      }
      byChannel.get(tex.channel)!.push(tex);
    }

    return {
      totalFiles: textures.length,
      totalBytes,
      byBuilder,
      byChannel
    };
  }

  /**
   * Get total size of all textures in bytes
   */
  async getTotalSize(): Promise<number> {
    const textures = await this.listTextures();
    return textures.reduce((sum, t) => sum + t.sizeBytes, 0);
  }

  /**
   * Clean up textures based on criteria
   */
  async clean(options: CleanOptions = {}): Promise<CleanResult> {
    const textures = await this.listTextures(options.builderName);
    const toDelete: TextureFileInfo[] = [];
    const reasons = new Map<string, string>();

    for (const tex of textures) {
      let shouldDelete = false;
      let reason = '';

      // Check age
      if (options.olderThanMs !== undefined && tex.ageMs > options.olderThanMs) {
        shouldDelete = true;
        const ageDays = Math.floor(tex.ageMs / (1000 * 60 * 60 * 24));
        reason = `older than threshold (${ageDays} days old)`;
      }

      // Check orphan status
      if (options.deleteOrphans && options.knownBuilders) {
        if (!options.knownBuilders.has(tex.builderName)) {
          shouldDelete = true;
          reason = `orphaned (builder '${tex.builderName}' no longer exists)`;
        }
      }

      if (shouldDelete) {
        toDelete.push(tex);
        reasons.set(tex.filename, reason);
      }
    }

    const bytesFreed = toDelete.reduce((sum, t) => sum + t.sizeBytes, 0);

    // Actually delete if force flag is set
    if (options.force) {
      for (const tex of toDelete) {
        try {
          await unlink(tex.path);
        } catch {
          // Ignore deletion errors
        }
      }
    }

    return {
      files: toDelete,
      bytesFreed,
      executed: options.force ?? false,
      reasons
    };
  }

  /**
   * Delete all textures for a specific builder
   */
  async deleteBuilder(builderName: string, force: boolean = false): Promise<CleanResult> {
    const textures = await this.listTextures(builderName);
    const bytesFreed = textures.reduce((sum, t) => sum + t.sizeBytes, 0);
    const reasons = new Map<string, string>();

    for (const tex of textures) {
      reasons.set(tex.filename, `belongs to builder '${builderName}'`);
    }

    if (force) {
      for (const tex of textures) {
        try {
          await unlink(tex.path);
        } catch {
          // Ignore deletion errors
        }
      }
    }

    return {
      files: textures,
      bytesFreed,
      executed: force,
      reasons
    };
  }
}

/**
 * Format bytes as human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format age in milliseconds as human-readable string
 */
export function formatAge(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

/**
 * Parse a duration string like "7d" or "24h" to milliseconds
 */
export function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+)\s*(s|m|h|d|w)$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
  };

  return value * (multipliers[unit] || 0);
}

// Default singleton instance
export const textureCache = new TextureCache();
