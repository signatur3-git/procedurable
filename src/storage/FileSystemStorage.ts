/**
 * FileSystemStorage - Local file system storage provider
 *
 * Stores builders as YAML files in a directory structure.
 * Supports hot reload via file watching in dev mode.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  StorageProvider,
  StoredBuilder,
  BuilderMetadata,
  ListOptions,
  ListResult,
  BuilderNotFoundError,
  StorageError
} from './StorageProvider.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface FileSystemStorageOptions {
  /**
   * Root directory for builder files
   * Default: './builders'
   */
  rootDir: string;

  /**
   * File extension for builder files
   * Default: '.yaml'
   */
  extension?: string;

  /**
   * Enable file watching for hot reload
   * Default: false
   */
  watch?: boolean;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class FileSystemStorage implements StorageProvider {
  readonly name = 'FileSystemStorage';

  private rootDir: string;
  private extension: string;
  private watcher: fs.FSWatcher | null = null;
  private watchCallbacks: Set<(name: string, event: 'created' | 'modified' | 'deleted') => void> = new Set();

  constructor(options: FileSystemStorageOptions) {
    this.rootDir = path.resolve(options.rootDir);
    this.extension = options.extension ?? '.yaml';

    // Ensure root directory exists
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }

    // Start watching if requested
    if (options.watch) {
      this.startWatching();
    }
  }

  // ==========================================================================
  // StorageProvider Implementation
  // ==========================================================================

  async isReady(): Promise<boolean> {
    try {
      await fs.promises.access(this.rootDir, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  async list(options?: ListOptions): Promise<ListResult> {
    const builders: BuilderMetadata[] = [];

    const scanDir = async (dir: string, prefix: string = '') => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Recurse into subdirectories
          await scanDir(path.join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
        } else if (entry.name.endsWith(this.extension)) {
          const name = prefix
            ? `${prefix}/${entry.name.slice(0, -this.extension.length)}`
            : entry.name.slice(0, -this.extension.length);

          // Apply prefix filter
          if (options?.prefix && !name.startsWith(options.prefix)) {
            continue;
          }

          try {
            const metadata = await this.getMetadata(name);

            // Apply tag filter
            if (options?.tags && options.tags.length > 0) {
              const hasTag = options.tags.some(t => metadata.tags?.includes(t));
              if (!hasTag) continue;
            }

            builders.push(metadata);
          } catch (e) {
            // Skip invalid files
            console.warn(`Skipping invalid builder file: ${name}`, e);
          }
        }
      }
    };

    await scanDir(this.rootDir);

    // Sort by name
    builders.sort((a, b) => a.name.localeCompare(b.name));

    // Apply pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? builders.length;
    const paged = builders.slice(offset, offset + limit);

    return {
      builders: paged,
      total: builders.length,
      hasMore: offset + limit < builders.length
    };
  }

  async exists(name: string): Promise<boolean> {
    const filePath = this.getFilePath(name);
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async get(name: string): Promise<StoredBuilder> {
    const filePath = this.getFilePath(name);

    try {
      const [content, stats] = await Promise.all([
        fs.promises.readFile(filePath, 'utf-8'),
        fs.promises.stat(filePath)
      ]);

      // Extract metadata from YAML front matter or file stats
      const metadata = this.parseMetadata(name, content, stats);

      return { metadata, content };
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        throw new BuilderNotFoundError(name);
      }
      throw new StorageError(`Failed to read builder: ${e.message}`, 'IO_ERROR', name);
    }
  }

  async put(name: string, content: string, metadata?: Partial<BuilderMetadata>): Promise<void> {
    const filePath = this.getFilePath(name);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    // Add/update metadata in content if provided
    let finalContent = content;
    if (metadata?.description || metadata?.author || metadata?.tags) {
      finalContent = this.ensureMetadataInContent(content, metadata);
    }

    await fs.promises.writeFile(filePath, finalContent, 'utf-8');
  }

  async delete(name: string): Promise<void> {
    const filePath = this.getFilePath(name);

    try {
      await fs.promises.unlink(filePath);
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        throw new BuilderNotFoundError(name);
      }
      throw new StorageError(`Failed to delete builder: ${e.message}`, 'IO_ERROR', name);
    }
  }

  watch(callback: (name: string, event: 'created' | 'modified' | 'deleted') => void): () => void {
    this.watchCallbacks.add(callback);
    this.startWatching();

    return () => {
      this.watchCallbacks.delete(callback);
      if (this.watchCallbacks.size === 0) {
        this.stopWatching();
      }
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private getFilePath(name: string): string {
    // Normalize path separators and add extension
    const normalized = name.replace(/\//g, path.sep);
    return path.join(this.rootDir, normalized + this.extension);
  }

  private async getMetadata(name: string): Promise<BuilderMetadata> {
    const filePath = this.getFilePath(name);
    const [content, stats] = await Promise.all([
      fs.promises.readFile(filePath, 'utf-8'),
      fs.promises.stat(filePath)
    ]);

    return this.parseMetadata(name, content, stats);
  }

  private parseMetadata(name: string, content: string, stats: fs.Stats): BuilderMetadata {
    // Try to extract metadata from YAML content
    const descriptionMatch = content.match(/^description:\s*["']?([^"'\n]+)["']?/m);
    const authorMatch = content.match(/^author:\s*["']?([^"'\n]+)["']?/m);
    const versionMatch = content.match(/^version:\s*["']?([^"'\n]+)["']?/m);
    const tagsMatch = content.match(/^tags:\s*\[([^\]]+)\]/m);

    let tags: string[] | undefined;
    if (tagsMatch) {
      tags = tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, ''));
    }

    return {
      name,
      description: descriptionMatch?.[1],
      version: versionMatch?.[1],
      author: authorMatch?.[1],
      tags,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      size: stats.size
    };
  }

  private ensureMetadataInContent(content: string, metadata: Partial<BuilderMetadata>): string {
    // This is a simple implementation - in production we'd use a YAML parser
    let result = content;

    if (metadata.description && !content.includes('description:')) {
      result = `description: "${metadata.description}"\n` + result;
    }

    if (metadata.author && !content.includes('author:')) {
      result = `author: "${metadata.author}"\n` + result;
    }

    if (metadata.tags && metadata.tags.length > 0 && !content.includes('tags:')) {
      const tagsStr = metadata.tags.map(t => `"${t}"`).join(', ');
      result = `tags: [${tagsStr}]\n` + result;
    }

    return result;
  }

  private startWatching(): void {
    if (this.watcher) return;

    try {
      this.watcher = fs.watch(this.rootDir, { recursive: true }, (eventType, filename) => {
        if (!filename || !filename.endsWith(this.extension)) return;

        // Convert filename to builder name
        const name = filename
          .replace(/\\/g, '/')
          .slice(0, -this.extension.length);

        // Determine event type
        const filePath = path.join(this.rootDir, filename);
        let event: 'created' | 'modified' | 'deleted';

        if (!fs.existsSync(filePath)) {
          event = 'deleted';
        } else if (eventType === 'rename') {
          event = 'created';
        } else {
          event = 'modified';
        }

        // Notify callbacks
        for (const callback of this.watchCallbacks) {
          try {
            callback(name, event);
          } catch (e) {
            console.error('Watch callback error:', e);
          }
        }
      });
    } catch (e) {
      console.warn('Failed to start file watching:', e);
    }
  }

  private stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopWatching();
    this.watchCallbacks.clear();
  }
}

