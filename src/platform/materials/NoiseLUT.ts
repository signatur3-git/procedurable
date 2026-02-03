/**
 * Noise Lookup Table (Performance Optimization)
 *
 * Pre-computes noise values at grid points and uses bilinear interpolation
 * for fast lookup. This provides 2-3x speedup for texture baking by
 * avoiding repeated perlin noise calculations.
 *
 * Trade-off: Slight quality loss from interpolation, but imperceptible
 * at typical texture resolutions.
 */

/**
 * Pre-computed 2D noise lookup table with bilinear interpolation
 */
export class NoiseLUT {
  private readonly lut: Float32Array;
  private readonly resolution: number;

  /**
   * Create a new noise LUT
   * @param resolution Grid resolution (256 = 256x256 grid points)
   * @param scale Noise scale (higher = more zoomed out pattern)
   * @param seed Random seed for determinism
   * @param noiseFn Optional custom noise function (defaults to perlin-like)
   */
  constructor(
    resolution: number = 256,
    scale: number = 32,
    seed: number = 42,
    noiseFn?: (x: number, y: number, seed: number) => number
  ) {
    this.resolution = resolution;
    this.lut = new Float32Array(resolution * resolution);

    const noise = noiseFn ?? NoiseLUT.defaultNoise;

    // Pre-compute noise grid
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const nx = (x / resolution) * scale;
        const ny = (y / resolution) * scale;
        this.lut[y * resolution + x] = noise(nx, ny, seed);
      }
    }
  }

  /**
   * Sample noise at UV coordinates with bilinear interpolation
   * @param u U coordinate (typically 0-1, but can exceed for tiling)
   * @param v V coordinate (typically 0-1, but can exceed for tiling)
   * @returns Noise value in [-1, 1] range
   */
  sample(u: number, v: number): number {
    // Map UV to grid coordinates (with wrapping for tiling)
    const gx = ((u % 1) + 1) % 1 * (this.resolution - 1);
    const gy = ((v % 1) + 1) % 1 * (this.resolution - 1);

    // Integer and fractional parts
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = (x0 + 1) % this.resolution;
    const y1 = (y0 + 1) % this.resolution;
    const fx = gx - x0;
    const fy = gy - y0;

    // Bilinear interpolation
    const v00 = this.lut[y0 * this.resolution + x0];
    const v10 = this.lut[y0 * this.resolution + x1];
    const v01 = this.lut[y1 * this.resolution + x0];
    const v11 = this.lut[y1 * this.resolution + x1];

    const vx0 = v00 + fx * (v10 - v00);
    const vx1 = v01 + fx * (v11 - v01);

    return vx0 + fy * (vx1 - vx0);
  }

  /**
   * Sample with coordinate scaling (for patterns at different frequencies)
   */
  sampleScaled(u: number, v: number, frequency: number): number {
    return this.sample(u * frequency, v * frequency);
  }

  /**
   * Default perlin-like noise function
   */
  private static defaultNoise(x: number, y: number, seed: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;

    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const hash = (px: number, py: number): number => {
      let h = seed;
      h = ((h ^ (px * 374761393)) * 1103515245) & 0x7fffffff;
      h = ((h ^ (py * 668265263)) * 1103515245) & 0x7fffffff;
      return (h & 0x7fffffff) / 0x7fffffff;
    };

    const aa = hash(xi, yi) * 2 - 1;
    const ab = hash(xi, yi + 1) * 2 - 1;
    const ba = hash(xi + 1, yi) * 2 - 1;
    const bb = hash(xi + 1, yi + 1) * 2 - 1;

    const x1 = aa + u * (ba - aa);
    const x2 = ab + u * (bb - ab);
    return x1 + v * (x2 - x1);
  }
}

/**
 * Cache of pre-computed noise LUTs keyed by seed
 * Avoids re-computing LUTs for the same seed
 */
const lutCache = new Map<string, NoiseLUT>();

/**
 * Get or create a noise LUT for the given parameters
 * Uses caching to avoid re-computation
 */
export function getOrCreateNoiseLUT(
  seed: number,
  resolution: number = 256,
  scale: number = 32
): NoiseLUT {
  const key = `${seed}_${resolution}_${scale}`;

  let lut = lutCache.get(key);
  if (!lut) {
    lut = new NoiseLUT(resolution, scale, seed);
    lutCache.set(key, lut);

    // Limit cache size to prevent memory bloat
    if (lutCache.size > 16) {
      // Remove oldest entry
      const firstKey = lutCache.keys().next().value;
      if (firstKey) lutCache.delete(firstKey);
    }
  }

  return lut;
}

/**
 * Clear all cached LUTs (useful for memory management)
 */
export function clearNoiseLUTCache(): void {
  lutCache.clear();
}

/**
 * Multi-octave FBM using LUT (faster than repeated perlin2D calls)
 */
export class FbmLUT {
  private readonly octaveLUTs: NoiseLUT[];
  private readonly gains: number[];
  private readonly maxValue: number;

  constructor(
    seed: number,
    octaves: number = 4,
    lacunarity: number = 2,
    gain: number = 0.5,
    resolution: number = 256,
    baseScale: number = 32
  ) {
    this.octaveLUTs = [];
    this.gains = [];

    let amplitude = 1;
    let scale = baseScale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      this.octaveLUTs.push(new NoiseLUT(resolution, scale, seed + i * 1000));
      this.gains.push(amplitude);
      maxValue += amplitude;
      amplitude *= gain;
      scale *= lacunarity;
    }

    this.maxValue = maxValue;
  }

  /**
   * Sample FBM at UV coordinates
   */
  sample(u: number, v: number): number {
    let value = 0;
    for (let i = 0; i < this.octaveLUTs.length; i++) {
      value += this.gains[i] * this.octaveLUTs[i].sample(u, v);
    }
    return value / this.maxValue;
  }
}

/**
 * Fast noise context for texture generation
 * Bundles multiple LUTs needed for typical wood/stone/metal generation
 */
export class FastNoiseContext {
  readonly primary: NoiseLUT;
  readonly secondary: NoiseLUT;
  readonly warp: NoiseLUT;
  readonly fbm: FbmLUT;

  constructor(seed: number, resolution: number = 256) {
    this.primary = new NoiseLUT(resolution, 32, seed);
    this.secondary = new NoiseLUT(resolution, 64, seed + 1000);
    this.warp = new NoiseLUT(resolution, 16, seed + 2000);
    this.fbm = new FbmLUT(seed + 3000, 4, 2, 0.5, resolution, 32);
  }

  /**
   * Domain warp using LUT-based noise (much faster than fbm2D)
   */
  domainWarp(u: number, v: number, amount: number = 1): { u: number; v: number } {
    const warpU = this.warp.sample(u, v) * amount;
    const warpV = this.warp.sample(u + 0.5, v + 0.5) * amount;
    return { u: u + warpU, v: v + warpV };
  }
}

/**
 * Cache for FastNoiseContext by seed
 */
const noiseContextCache = new Map<number, FastNoiseContext>();

/**
 * Get or create a FastNoiseContext for the given seed
 */
export function getNoiseContext(seed: number, resolution: number = 256): FastNoiseContext {
  let ctx = noiseContextCache.get(seed);
  if (!ctx) {
    ctx = new FastNoiseContext(seed, resolution);
    noiseContextCache.set(seed, ctx);

    // Limit cache size
    if (noiseContextCache.size > 8) {
      const firstKey = noiseContextCache.keys().next().value;
      if (firstKey !== undefined) noiseContextCache.delete(firstKey);
    }
  }
  return ctx;
}

/**
 * Clear all noise caches
 */
export function clearAllNoiseCaches(): void {
  lutCache.clear();
  noiseContextCache.clear();
}
