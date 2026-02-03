/**
 * MetadataStore - Persistent key-value store for domain knowledge
 *
 * B3-001: Agents accumulate knowledge across sessions: style palettes,
 * builder relationships, spatial rules, domain standards.
 *
 * Keys are namespaced paths (e.g., "styles/modern", "rules/furniture/clearance").
 * Values are typed YAML documents with schema validation.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

// =============================================================================
// Types
// =============================================================================

/**
 * Metadata entry with its key, value, and metadata
 */
export interface MetadataEntry<T = unknown> {
  /** Namespaced key (e.g., "styles/modern") */
  key: string;

  /** The value (parsed from YAML) */
  value: T;

  /** When the entry was created */
  createdAt: Date;

  /** When the entry was last modified */
  modifiedAt: Date;

  /** Optional description */
  description?: string;

  /** Optional tags for categorization */
  tags?: string[];
}

/**
 * Options for listing metadata entries
 */
export interface MetadataListOptions {
  /** Filter by key prefix (e.g., "styles/") */
  prefix?: string;

  /** Filter by tags */
  tags?: string[];

  /** Maximum number of results */
  limit?: number;
}

/**
 * Result of a list operation
 */
export interface MetadataListResult {
  /** Matching entries (keys only, not values) */
  keys: string[];

  /** Total count */
  total: number;
}

/**
 * Options for the MetadataStore
 */
export interface MetadataStoreOptions {
  /** Root directory for metadata files */
  rootDir: string;

  /** File extension (default: '.yaml') */
  extension?: string;
}

// =============================================================================
// Errors
// =============================================================================

export class MetadataError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'INVALID_KEY' | 'INVALID_VALUE' | 'IO_ERROR',
    public readonly key?: string
  ) {
    super(message);
    this.name = 'MetadataError';
  }
}

export class MetadataNotFoundError extends MetadataError {
  constructor(key: string) {
    super(`Metadata not found: ${key}`, 'NOT_FOUND', key);
  }
}

export class InvalidKeyError extends MetadataError {
  constructor(key: string, reason: string) {
    super(`Invalid key '${key}': ${reason}`, 'INVALID_KEY', key);
  }
}

// =============================================================================
// MetadataStore Implementation
// =============================================================================

export class MetadataStore {
  private rootDir: string;
  private extension: string;

  constructor(options: MetadataStoreOptions) {
    this.rootDir = path.resolve(options.rootDir);
    this.extension = options.extension ?? '.yaml';

    // Ensure root directory exists
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Check if the store is ready
   */
  async isReady(): Promise<boolean> {
    try {
      await fs.promises.access(this.rootDir, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    this.validateKey(key);
    const filePath = this.keyToPath(key);
    return fs.existsSync(filePath);
  }

  /**
   * Get a metadata entry by key
   * @throws MetadataNotFoundError if key doesn't exist
   */
  async get<T = unknown>(key: string): Promise<MetadataEntry<T>> {
    this.validateKey(key);
    const filePath = this.keyToPath(key);

    if (!fs.existsSync(filePath)) {
      throw new MetadataNotFoundError(key);
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = yaml.parse(content);
      const stats = await fs.promises.stat(filePath);

      return {
        key,
        value: parsed.value as T,
        createdAt: parsed.createdAt ? new Date(parsed.createdAt) : stats.birthtime,
        modifiedAt: stats.mtime,
        description: parsed.description,
        tags: parsed.tags
      };
    } catch (err) {
      if (err instanceof MetadataError) throw err;
      throw new MetadataError(
        `Failed to read metadata '${key}': ${(err as Error).message}`,
        'IO_ERROR',
        key
      );
    }
  }

  /**
   * Set a metadata entry (create or update)
   */
  async set<T = unknown>(
    key: string,
    value: T,
    options?: { description?: string; tags?: string[] }
  ): Promise<void> {
    this.validateKey(key);
    const filePath = this.keyToPath(key);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    // Check if entry exists for createdAt
    let createdAt = new Date().toISOString();
    if (fs.existsSync(filePath)) {
      try {
        const existing = await fs.promises.readFile(filePath, 'utf-8');
        const parsed = yaml.parse(existing);
        if (parsed.createdAt) {
          createdAt = parsed.createdAt;
        }
      } catch {
        // Ignore - use new date
      }
    }

    const document = {
      key,
      createdAt,
      modifiedAt: new Date().toISOString(),
      description: options?.description,
      tags: options?.tags,
      value
    };

    // Remove undefined fields
    const cleanDoc = Object.fromEntries(
      Object.entries(document).filter(([_, v]) => v !== undefined)
    );

    try {
      const content = yaml.stringify(cleanDoc, { indent: 2 });
      await fs.promises.writeFile(filePath, content, 'utf-8');
    } catch (err) {
      throw new MetadataError(
        `Failed to write metadata '${key}': ${(err as Error).message}`,
        'IO_ERROR',
        key
      );
    }
  }

  /**
   * Delete a metadata entry
   * @throws MetadataNotFoundError if key doesn't exist
   */
  async delete(key: string): Promise<void> {
    this.validateKey(key);
    const filePath = this.keyToPath(key);

    if (!fs.existsSync(filePath)) {
      throw new MetadataNotFoundError(key);
    }

    try {
      await fs.promises.unlink(filePath);

      // Clean up empty directories
      await this.cleanEmptyDirs(path.dirname(filePath));
    } catch (err) {
      if (err instanceof MetadataError) throw err;
      throw new MetadataError(
        `Failed to delete metadata '${key}': ${(err as Error).message}`,
        'IO_ERROR',
        key
      );
    }
  }

  /**
   * List metadata keys
   */
  async list(options?: MetadataListOptions): Promise<MetadataListResult> {
    const keys: string[] = [];

    const scanDir = async (dir: string, prefix: string = '') => {
      if (!fs.existsSync(dir)) return;

      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const newPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
          await scanDir(path.join(dir, entry.name), newPrefix);
        } else if (entry.name.endsWith(this.extension)) {
          const key = prefix
            ? `${prefix}/${entry.name.slice(0, -this.extension.length)}`
            : entry.name.slice(0, -this.extension.length);

          // Apply prefix filter
          if (options?.prefix && !key.startsWith(options.prefix)) {
            continue;
          }

          // Apply tag filter (requires reading the file)
          if (options?.tags && options.tags.length > 0) {
            try {
              const entry = await this.get(key);
              const entryTags = entry.tags || [];
              const hasAllTags = options.tags.every(t => entryTags.includes(t));
              if (!hasAllTags) continue;
            } catch {
              continue;
            }
          }

          keys.push(key);
        }
      }
    };

    await scanDir(this.rootDir);

    // Sort keys alphabetically
    keys.sort();

    // Apply limit
    const total = keys.length;
    const limited = options?.limit ? keys.slice(0, options.limit) : keys;

    return {
      keys: limited,
      total
    };
  }

  /**
   * Get all entries matching a prefix (convenience method)
   */
  async getAll<T = unknown>(prefix?: string): Promise<MetadataEntry<T>[]> {
    const { keys } = await this.list({ prefix });
    const entries: MetadataEntry<T>[] = [];

    for (const key of keys) {
      try {
        const entry = await this.get<T>(key);
        entries.push(entry);
      } catch {
        // Skip entries that fail to load
      }
    }

    return entries;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Convert a key to a file path
   */
  private keyToPath(key: string): string {
    // Replace forward slashes with path separator
    const relativePath = key.split('/').join(path.sep);
    return path.join(this.rootDir, relativePath + this.extension);
  }

  /**
   * Validate a key format
   */
  private validateKey(key: string): void {
    if (!key || key.trim() === '') {
      throw new InvalidKeyError(key, 'Key cannot be empty');
    }

    // Keys must be alphanumeric with slashes, underscores, and hyphens
    const validKeyPattern = /^[a-zA-Z0-9][a-zA-Z0-9_\-\/]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
    if (!validKeyPattern.test(key)) {
      throw new InvalidKeyError(
        key,
        'Key must be alphanumeric with optional slashes, underscores, and hyphens'
      );
    }

    // No double slashes
    if (key.includes('//')) {
      throw new InvalidKeyError(key, 'Key cannot contain double slashes');
    }

    // No leading or trailing slashes
    if (key.startsWith('/') || key.endsWith('/')) {
      throw new InvalidKeyError(key, 'Key cannot start or end with slash');
    }
  }

  /**
   * Clean up empty directories after deletion
   */
  private async cleanEmptyDirs(dir: string): Promise<void> {
    if (dir === this.rootDir || !dir.startsWith(this.rootDir)) return;

    try {
      const entries = await fs.promises.readdir(dir);
      if (entries.length === 0) {
        await fs.promises.rmdir(dir);
        await this.cleanEmptyDirs(path.dirname(dir));
      }
    } catch {
      // Ignore errors - directory may not be empty
    }
  }
}

// =============================================================================
// Default Instance
// =============================================================================

let defaultStore: MetadataStore | null = null;

/**
 * Get the default metadata store instance
 */
export function getMetadataStore(): MetadataStore {
  if (!defaultStore) {
    // Use process.cwd() for ESM compatibility (server runs as ESNext modules where __dirname is unavailable)
    // process.cwd() is always the project root when the server is started from D:/workspaces/procedurable
    const projectRoot = process.cwd();
    defaultStore = new MetadataStore({
      rootDir: path.join(projectRoot, 'metadata')
    });
  }
  return defaultStore;
}

/**
 * Set a custom default metadata store (for testing)
 */
export function setMetadataStore(store: MetadataStore | null): void {
  defaultStore = store;
}
