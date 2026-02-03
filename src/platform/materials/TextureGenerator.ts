/**
 * Texture Generator Interface (G4-002)
 *
 * Base interface and utilities for procedural texture generation.
 * Generators produce multi-channel PBR output from UV coordinates.
 */

import { MeshAnalysis } from './MeshAnalysis';
import { Vec3 } from '../math/Vec3';

/**
 * Color represented as RGB values [0-1]
 */
export interface Color {
  r: number;
  g: number;
  b: number;
}

/**
 * Result of texture evaluation at a single point
 */
export interface TextureResult {
  /** Base color / albedo (RGB, 0-1) */
  albedo: Color;
  /** Normal map offset (XYZ, -1 to 1, with Z typically positive) */
  normal: Vec3;
  /** Roughness (0 = mirror smooth, 1 = fully rough) */
  roughness: number;
  /** Metallic (0 = dielectric, 1 = metal) */
  metallic: number;
  /** Height / displacement (-1 to 1) */
  height: number;
}

/**
 * Parameters passed to texture generators
 */
export interface GeneratorParams {
  /** Generator-specific parameters */
  [key: string]: any;
}

/**
 * Context for texture evaluation
 */
export interface EvaluationContext {
  /** UV coordinates [0-1] */
  u: number;
  v: number;
  /** World position (if available) */
  worldPos?: Vec3;
  /** Vertex normal (if available) */
  normal?: Vec3;
  /** Curvature at this point (-1 to 1, if mesh analysis available) */
  curvature?: number;
  /** Ambient occlusion at this point (0-1, if mesh analysis available) */
  ao?: number;
}

/**
 * Interface for procedural texture generators
 */
export interface TextureGenerator {
  /** Unique identifier for this generator type */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /** Default parameters for this generator */
  readonly defaultParams: GeneratorParams;

  /**
   * Evaluate the generator at a point
   *
   * @param context Evaluation context (UV, world pos, etc.)
   * @param params Generator-specific parameters
   * @param seed Random seed for deterministic output
   * @returns Multi-channel texture result
   */
  evaluate(context: EvaluationContext, params: GeneratorParams, seed: number): TextureResult;
}

/**
 * Registry of available texture generators
 */
const generatorRegistry = new Map<string, TextureGenerator>();

/**
 * Register a texture generator
 */
export function registerGenerator(generator: TextureGenerator): void {
  generatorRegistry.set(generator.name, generator);
}

/**
 * Get a registered generator by name
 */
export function getGenerator(name: string): TextureGenerator | undefined {
  return generatorRegistry.get(name);
}

/**
 * List all registered generators
 */
export function listGenerators(): string[] {
  return Array.from(generatorRegistry.keys());
}

/**
 * Create a default texture result (neutral values)
 */
export function defaultResult(): TextureResult {
  return {
    albedo: { r: 0.5, g: 0.5, b: 0.5 },
    normal: new Vec3(0, 0, 1),
    roughness: 0.5,
    metallic: 0,
    height: 0
  };
}

/**
 * Blend two colors
 */
export function blendColors(a: Color, b: Color, t: number): Color {
  return {
    r: a.r * (1 - t) + b.r * t,
    g: a.g * (1 - t) + b.g * t,
    b: a.b * (1 - t) + b.b * t
  };
}

/**
 * Clamp a value to [0, 1]
 */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Smoothstep interpolation
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// ============================================================================
// Seeded Random and Noise Functions
// ============================================================================

/**
 * Seeded pseudo-random number generator
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /** Get next random number in [0, 1) */
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  /** Get random number in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Create a new RNG with a derived seed */
  derive(offset: number): SeededRandom {
    return new SeededRandom(this.seed + offset);
  }
}

/**
 * Hash function for noise (deterministic)
 */
function hash(x: number, y: number, seed: number): number {
  let h = seed;
  h = ((h ^ (x * 374761393)) * 1103515245) & 0x7fffffff;
  h = ((h ^ (y * 668265263)) * 1103515245) & 0x7fffffff;
  return (h & 0x7fffffff) / 0x7fffffff;
}

/**
 * 2D Perlin-like gradient noise
 */
export function perlin2D(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  // Smoothstep for interpolation
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  // Hash corners
  const aa = hash(xi, yi, seed) * 2 - 1;
  const ab = hash(xi, yi + 1, seed) * 2 - 1;
  const ba = hash(xi + 1, yi, seed) * 2 - 1;
  const bb = hash(xi + 1, yi + 1, seed) * 2 - 1;

  // Bilinear interpolation
  const x1 = aa + u * (ba - aa);
  const x2 = ab + u * (bb - ab);
  return x1 + v * (x2 - x1);
}

/**
 * Fractional Brownian Motion (multi-octave noise)
 */
export function fbm2D(
  x: number,
  y: number,
  seed: number,
  octaves: number = 4,
  lacunarity: number = 2,
  gain: number = 0.5
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * perlin2D(x * frequency, y * frequency, seed + i * 1000);
    maxValue += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

/**
 * Worley (cellular/Voronoi) noise - returns distance to nearest cell center
 */
export function worley2D(x: number, y: number, seed: number): { distance: number; cellId: number } {
  const xi = Math.floor(x);
  const yi = Math.floor(y);

  let minDist = Infinity;
  let cellId = 0;

  // Check 3x3 neighborhood
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cx = xi + dx;
      const cy = yi + dy;

      // Random point within cell
      const px = cx + hash(cx, cy, seed);
      const py = cy + hash(cx, cy, seed + 1000);

      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (dist < minDist) {
        minDist = dist;
        cellId = Math.floor(hash(cx, cy, seed + 2000) * 1000000);
      }
    }
  }

  return { distance: minDist, cellId };
}

/**
 * Domain warping - distort coordinates using noise
 */
export function domainWarp2D(
  x: number,
  y: number,
  seed: number,
  amount: number = 1
): { x: number; y: number } {
  const warpX = fbm2D(x, y, seed, 3) * amount;
  const warpY = fbm2D(x + 100, y + 100, seed, 3) * amount;
  return { x: x + warpX, y: y + warpY };
}

/**
 * Create evaluation context from mesh analysis
 */
export function createContextFromAnalysis(
  u: number,
  v: number,
  analysis: MeshAnalysis | null,
  vertexIndex?: number
): EvaluationContext {
  const ctx: EvaluationContext = { u, v };

  if (analysis && vertexIndex !== undefined && vertexIndex < analysis.vertices.length) {
    const vertex = analysis.vertices[vertexIndex];
    ctx.worldPos = vertex.position;
    ctx.normal = vertex.normal;
    ctx.curvature = vertex.curvature;
    ctx.ao = vertex.ambientOcclusion;
  }

  return ctx;
}
