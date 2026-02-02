/**
 * SharedContext - Scene-level shared state for cross-builder communication
 *
 * Enables siblings to coordinate via a shared key-value store.
 * Like Vuex/Pinia for builders - children can read theme settings,
 * report their sizes, and see each other's decisions.
 *
 * P2-M2d-003, B5-002 (Request/Offer Negotiation Protocol)
 */

// =============================================================================
// B5-002: Requirement and Offer Types
// =============================================================================

/**
 * Spatial requirement - what a builder needs from the environment
 */
export interface SpatialRequirement {
  /** Unique ID for this requirement */
  id: string;
  /** Builder that published this requirement */
  publisher: string;
  /** Type of requirement (e.g., 'terrain_clearance', 'flat_pad', 'road_access') */
  type: string;
  /** Shape of the area needed */
  shape: 'rectangle' | 'circle' | 'polygon';
  /** Position in world space */
  position: { x: number; z: number };
  /** Dimensions (interpretation depends on shape) */
  width?: number;
  depth?: number;
  radius?: number;
  /** Optional polygon points for complex shapes */
  points?: Array<{ x: number; z: number }>;
  /** Maximum allowed slope (0-1, where 0 = flat) */
  maxSlope?: number;
  /** Optional priority (higher = more important) */
  priority?: number;
  /** Custom metadata */
  metadata?: Record<string, any>;
}

/**
 * Offer - environment builder's response to a requirement
 */
export interface SpatialOffer {
  /** The requirement ID this offer responds to */
  requirementId: string;
  /** Builder that published this offer */
  publisher: string;
  /** Whether the requirement was fulfilled */
  fulfilled: boolean;
  /** Actual elevation at the cleared area */
  elevation?: number;
  /** Actual slope (0-1) */
  slope?: number;
  /** Slope direction in radians */
  slopeDirection?: number;
  /** Name of boundary loop created (for blend zones) */
  boundaryLoop?: string;
  /** Actual position (may differ slightly from requested) */
  position?: { x: number; y: number; z: number };
  /** Custom response data */
  data?: Record<string, any>;
}

/**
 * Shared context - structured key-value store for scene-level state
 */
export class SharedContext {
  private store: Map<string, any> = new Map();
  private initialValues: Map<string, any> = new Map();

  // B5-002: Requirements and Offers channels
  private requirements: Map<string, SpatialRequirement> = new Map();
  private offers: Map<string, SpatialOffer> = new Map();

  constructor(initialState?: Record<string, any>) {
    if (initialState) {
      for (const [key, value] of Object.entries(initialState)) {
        this.store.set(key, value);
        this.initialValues.set(key, value);
      }
    }
  }

  // ===========================================================================
  // B5-002: Requirements API
  // ===========================================================================

  /**
   * Publish a spatial requirement
   */
  publishRequirement(req: SpatialRequirement): void {
    this.requirements.set(req.id, req);
  }

  /**
   * Get a specific requirement by ID
   */
  getRequirement(id: string): SpatialRequirement | undefined {
    return this.requirements.get(id);
  }

  /**
   * Get all requirements of a specific type
   */
  getRequirementsByType(type: string): SpatialRequirement[] {
    return Array.from(this.requirements.values()).filter(r => r.type === type);
  }

  /**
   * Get all requirements published by a specific builder
   */
  getRequirementsByPublisher(publisher: string): SpatialRequirement[] {
    return Array.from(this.requirements.values()).filter(r => r.publisher === publisher);
  }

  /**
   * Get all requirements
   */
  getAllRequirements(): SpatialRequirement[] {
    return Array.from(this.requirements.values());
  }

  // ===========================================================================
  // B5-002: Offers API
  // ===========================================================================

  /**
   * Publish an offer in response to a requirement
   */
  publishOffer(offer: SpatialOffer): void {
    this.offers.set(offer.requirementId, offer);
  }

  /**
   * Get the offer for a specific requirement
   */
  getOffer(requirementId: string): SpatialOffer | undefined {
    return this.offers.get(requirementId);
  }

  /**
   * Get all offers published by a specific builder
   */
  getOffersByPublisher(publisher: string): SpatialOffer[] {
    return Array.from(this.offers.values()).filter(o => o.publisher === publisher);
  }

  /**
   * Get all offers
   */
  getAllOffers(): SpatialOffer[] {
    return Array.from(this.offers.values());
  }

  /**
   * Check if a requirement has been fulfilled
   */
  isRequirementFulfilled(requirementId: string): boolean {
    const offer = this.offers.get(requirementId);
    return offer?.fulfilled ?? false;
  }

  // ===========================================================================
  // Original key-value API
  // ===========================================================================

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
    this.requirements.clear();
    this.offers.clear();
  }

  /**
   * Create a snapshot of current state (includes requirements and offers)
   */
  snapshot(): Record<string, any> {
    return {
      ...this.toObject(),
      __requirements__: Array.from(this.requirements.values()),
      __offers__: Array.from(this.offers.values())
    };
  }

  /**
   * Get size of store
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Get counts of requirements and offers
   */
  negotiationStats(): { requirements: number; offers: number; fulfilled: number } {
    const fulfilled = Array.from(this.offers.values()).filter(o => o.fulfilled).length;
    return {
      requirements: this.requirements.size,
      offers: this.offers.size,
      fulfilled
    };
  }
}
