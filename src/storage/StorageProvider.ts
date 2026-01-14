/**
 * StorageProvider - Abstract interface for builder storage
 *
 * Implementations:
 * - FileSystemStorage: Local YAML files (dev mode)
 * - S3Storage: Cloud storage (production, future)
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Metadata about a stored builder
 */
export interface BuilderMetadata {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  createdAt: Date;
  modifiedAt: Date;
  size: number;  // bytes
}

/**
 * Builder definition as stored (raw YAML content + metadata)
 */
export interface StoredBuilder {
  metadata: BuilderMetadata;
  content: string;  // Raw YAML content
}

/**
 * Options for listing builders
 */
export interface ListOptions {
  prefix?: string;      // Filter by name prefix (e.g., "furniture/")
  tags?: string[];      // Filter by tags
  limit?: number;       // Max results
  offset?: number;      // Pagination offset
}

/**
 * Result of listing builders
 */
export interface ListResult {
  builders: BuilderMetadata[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// INTERFACE
// ============================================================================

/**
 * Abstract storage provider interface
 *
 * All methods are async to support both local and remote storage.
 */
export interface StorageProvider {
  /**
   * Provider name for logging/debugging
   */
  readonly name: string;

  /**
   * Check if the provider is ready (connected, initialized)
   */
  isReady(): Promise<boolean>;

  /**
   * List available builders
   */
  list(options?: ListOptions): Promise<ListResult>;

  /**
   * Check if a builder exists
   */
  exists(name: string): Promise<boolean>;

  /**
   * Get a builder by name
   * @throws if builder doesn't exist
   */
  get(name: string): Promise<StoredBuilder>;

  /**
   * Save a builder (create or update)
   * @param name Builder name (can include path like "furniture/Chair")
   * @param content YAML content
   * @param metadata Optional metadata overrides
   */
  put(name: string, content: string, metadata?: Partial<BuilderMetadata>): Promise<void>;

  /**
   * Delete a builder
   * @throws if builder doesn't exist
   */
  delete(name: string): Promise<void>;

  /**
   * Watch for changes (optional, for dev mode hot reload)
   * @param callback Called when a builder changes
   * @returns Unsubscribe function
   */
  watch?(callback: (name: string, event: 'created' | 'modified' | 'deleted') => void): () => void;
}

// ============================================================================
// ERRORS
// ============================================================================

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'ALREADY_EXISTS' | 'PERMISSION_DENIED' | 'INVALID_FORMAT' | 'IO_ERROR',
    public readonly builderName?: string
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export class BuilderNotFoundError extends StorageError {
  constructor(name: string) {
    super(`Builder not found: ${name}`, 'NOT_FOUND', name);
  }
}

export class InvalidBuilderError extends StorageError {
  constructor(name: string, reason: string) {
    super(`Invalid builder '${name}': ${reason}`, 'INVALID_FORMAT', name);
  }
}

