/**
 * SharedContext - Scene-level shared state for cross-builder communication
 *
 * Enables siblings to coordinate via a shared key-value store.
 * Like Vuex/Pinia for builders - children can read theme settings,
 * report their sizes, and see each other's decisions.
 *
 * P2-M2d-003
 */

/**
 * Shared context - structured key-value store for scene-level state
 */
export class SharedContext {
  private store: Map<string, any> = new Map();
  private initialValues: Map<string, any> = new Map();

  constructor(initialState?: Record<string, any>) {
    if (initialState) {
      for (const [key, value] of Object.entries(initialState)) {
        this.store.set(key, value);
        this.initialValues.set(key, value);
      }
    }
  }

  /**
   * Get a value from shared context
   */
  get<T = any>(key: string): T | undefined {
    return this.store.get(key);
  }

  /**
   * Set a value in shared context
   */
  set(key: string, value: any): void {
    this.store.set(key, value);
  }

  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get all values as object
   */
  toObject(): Record<string, any> {
    return Object.fromEntries(this.store);
  }

  /**
   * Get multiple keys at once
   */
  getMultiple(keys: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of keys) {
      if (this.store.has(key)) {
        result[key] = this.store.get(key);
      }
    }
    return result;
  }

  /**
   * Set multiple values at once
   */
  setMultiple(values: Record<string, any>): void {
    for (const [key, value] of Object.entries(values)) {
      this.store.set(key, value);
    }
  }

  /**
   * Delete a key
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all non-initial values (useful for re-running)
   */
  reset(): void {
    this.store = new Map(this.initialValues);
  }

  /**
   * Create a snapshot of current state
   */
  snapshot(): Record<string, any> {
    return this.toObject();
  }

  /**
   * Get size of store
   */
  size(): number {
    return this.store.size;
  }
}
