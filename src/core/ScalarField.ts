/**
 * ScalarField - Spatial functions for terrain, density, biomes
 *
 * A scalar field is a function that maps 3D space to a single number.
 * Used for:
 * - Terrain height (y = f(x, z))
 * - Density masks (where to place objects)
 * - Biome blending (temperature, moisture fields)
 * - World generation (caves, cliffs, rivers)
 *
 * Philosophy:
 * - Composable (fields can be combined)
 * - Deterministic (same coordinates = same value)
 * - Lazy evaluation (only compute what's needed)
 */

import { perlin2d, perlin3d, fbm } from './MathService';

/**
 * A scalar field - maps 3D coordinates to a single number
 */
export interface ScalarField {
  /**
   * Sample the field at a point in 3D space
   * @param x X coordinate
   * @param y Y coordinate (often unused for 2D fields)
   * @param z Z coordinate
   * @returns Field value at this point
   */
  sample(x: number, y: number, z: number): number;
}

// ============================================================================
// BASIC FIELDS
// ============================================================================

/**
 * Constant field - always returns the same value
 * Useful as a baseline or for testing
 */
export class ConstantField implements ScalarField {
  constructor(private value: number) {}

  sample(_x: number, _y: number, _z: number): number {
    return this.value;
  }
}

/**
 * 2D noise field (height maps, density masks)
 * Uses Perlin noise from MathService
 */
export class Noise2DField implements ScalarField {
  constructor(
    private seed: number,
    private frequency: number = 1.0,
    private amplitude: number = 1.0
  ) {}

  sample(x: number, _y: number, z: number): number {
    // Sample 2D noise at (x, z) coordinates
    const noiseValue = perlin2d(
      x * this.frequency,
      z * this.frequency,
      this.seed
    );
    return noiseValue * this.amplitude;
  }
}

/**
 * 3D noise field (volumetric effects, caves)
 */
export class Noise3DField implements ScalarField {
  constructor(
    private seed: number,
    private frequency: number = 1.0,
    private amplitude: number = 1.0
  ) {}

  sample(x: number, y: number, z: number): number {
    const noiseValue = perlin3d(
      x * this.frequency,
      y * this.frequency,
      z * this.frequency,
      this.seed
    );
    return noiseValue * this.amplitude;
  }
}

/**
 * Fractal Brownian Motion field (layered noise for natural terrain)
 */
export class FBMField implements ScalarField {
  constructor(
    private seed: number,
    private frequency: number = 1.0,
    private amplitude: number = 1.0,
    private octaves: number = 4,
    private persistence: number = 0.5
  ) {}

  sample(x: number, _y: number, z: number): number {
    const noiseValue = fbm(
      x * this.frequency,
      z * this.frequency,
      this.seed,
      this.octaves,
      this.persistence
    );
    return noiseValue * this.amplitude;
  }
}

// ============================================================================
// FIELD OPERATIONS
// ============================================================================

/**
 * Remap a field's values from one range to another
 * Example: noise [-1, 1] → terrain height [0, 100]
 */
export class RemapField implements ScalarField {
  constructor(
    private source: ScalarField,
    private inMin: number,
    private inMax: number,
    private outMin: number,
    private outMax: number
  ) {}

  sample(x: number, y: number, z: number): number {
    const value = this.source.sample(x, y, z);
    // Linear interpolation from input range to output range
    const t = (value - this.inMin) / (this.inMax - this.inMin);
    return this.outMin + t * (this.outMax - this.outMin);
  }
}

/**
 * Clamp a field's values to a range
 */
export class ClampField implements ScalarField {
  constructor(
    private source: ScalarField,
    private min: number,
    private max: number
  ) {}

  sample(x: number, y: number, z: number): number {
    const value = this.source.sample(x, y, z);
    return Math.max(this.min, Math.min(this.max, value));
  }
}

/**
 * Add two fields together
 */
export class AddField implements ScalarField {
  constructor(
    private fieldA: ScalarField,
    private fieldB: ScalarField
  ) {}

  sample(x: number, y: number, z: number): number {
    return this.fieldA.sample(x, y, z) + this.fieldB.sample(x, y, z);
  }
}

/**
 * Multiply two fields together
 */
export class MultiplyField implements ScalarField {
  constructor(
    private fieldA: ScalarField,
    private fieldB: ScalarField
  ) {}

  sample(x: number, y: number, z: number): number {
    return this.fieldA.sample(x, y, z) * this.fieldB.sample(x, y, z);
  }
}

/**
 * Scale a field by a constant
 */
export class ScaleField implements ScalarField {
  constructor(
    private source: ScalarField,
    private scale: number
  ) {}

  sample(x: number, y: number, z: number): number {
    return this.source.sample(x, y, z) * this.scale;
  }
}

// ============================================================================
// FACTORY FUNCTIONS (Convenient API)
// ============================================================================

/**
 * Field builder API - convenient functions for creating fields
 */
export const field = {
  /**
   * Create a constant field
   */
  constant(value: number): ScalarField {
    return new ConstantField(value);
  },

  /**
   * Create a 2D noise field (Perlin noise)
   */
  noise2d(seed: number, frequency: number = 1.0, amplitude: number = 1.0): ScalarField {
    return new Noise2DField(seed, frequency, amplitude);
  },

  /**
   * Create a 3D noise field (volumetric Perlin noise)
   */
  noise3d(seed: number, frequency: number = 1.0, amplitude: number = 1.0): ScalarField {
    return new Noise3DField(seed, frequency, amplitude);
  },

  /**
   * Create a Fractal Brownian Motion field (layered noise)
   */
  fbm(
    seed: number,
    frequency: number = 1.0,
    amplitude: number = 1.0,
    octaves: number = 4,
    persistence: number = 0.5
  ): ScalarField {
    return new FBMField(seed, frequency, amplitude, octaves, persistence);
  },

  /**
   * Remap a field's output range
   */
  remap(
    source: ScalarField,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number
  ): ScalarField {
    return new RemapField(source, inMin, inMax, outMin, outMax);
  },

  /**
   * Clamp a field to a range
   */
  clamp(source: ScalarField, min: number, max: number): ScalarField {
    return new ClampField(source, min, max);
  },

  /**
   * Add two fields together
   */
  add(fieldA: ScalarField, fieldB: ScalarField): ScalarField {
    return new AddField(fieldA, fieldB);
  },

  /**
   * Multiply two fields together
   */
  multiply(fieldA: ScalarField, fieldB: ScalarField): ScalarField {
    return new MultiplyField(fieldA, fieldB);
  },

  /**
   * Scale a field by a constant
   */
  scale(source: ScalarField, scale: number): ScalarField {
    return new ScaleField(source, scale);
  }
};

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/**
 * Example: Create a terrain height field
 *
 * const terrain = field.remap(
 *   field.fbm(seed, 0.1, 1.0, 4, 0.5),
 *   -1, 1,  // FBM output range
 *   0, 50   // Terrain height range (0-50m)
 * );
 *
 * const height = terrain.sample(x, 0, z);
 */

/**
 * Example: Create a density mask (where to place trees)
 *
 * const forestMask = field.clamp(
 *   field.noise2d(seed, 0.05, 1.0),
 *   0, 1  // Probability range
 * );
 *
 * if (forestMask.sample(x, 0, z) > 0.5) {
 *   // Place tree here
 * }
 */

