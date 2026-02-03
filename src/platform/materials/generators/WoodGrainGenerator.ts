/**
 * Wood Grain Generator (G4-002)
 *
 * Generates procedural wood grain textures with ring patterns,
 * rays, and species-specific coloring.
 *
 * Quality: Uses direct fbm/perlin noise by default for highest quality.
 * Set `useLUT: true` for 2-3x faster but lower quality texture baking.
 */

import {
  TextureGenerator,
  TextureResult,
  GeneratorParams,
  EvaluationContext,
  Color,
  defaultResult,
  blendColors,
  clamp01,
  perlin2D,
  fbm2D,
  domainWarp2D,
  registerGenerator
} from '../TextureGenerator';
import { Vec3 } from '../../math/Vec3';
import { getNoiseContext, FastNoiseContext } from '../NoiseLUT';

/**
 * Wood species color palettes
 */
const WOOD_SPECIES: Record<string, { light: Color; dark: Color; roughness: number }> = {
  oak: {
    light: { r: 0.76, g: 0.60, b: 0.42 },
    dark: { r: 0.55, g: 0.40, b: 0.25 },
    roughness: 0.7
  },
  walnut: {
    light: { r: 0.45, g: 0.32, b: 0.22 },
    dark: { r: 0.28, g: 0.18, b: 0.12 },
    roughness: 0.5
  },
  pine: {
    light: { r: 0.85, g: 0.72, b: 0.52 },
    dark: { r: 0.70, g: 0.55, b: 0.35 },
    roughness: 0.65
  },
  maple: {
    light: { r: 0.88, g: 0.78, b: 0.65 },
    dark: { r: 0.75, g: 0.62, b: 0.48 },
    roughness: 0.45
  },
  cherry: {
    light: { r: 0.72, g: 0.45, b: 0.32 },
    dark: { r: 0.52, g: 0.28, b: 0.18 },
    roughness: 0.4
  }
};

export interface WoodGrainParams extends GeneratorParams {
  /** Wood species (oak, walnut, pine, maple, cherry) */
  species?: string;
  /** Ring frequency (rings per unit) */
  ringFrequency?: number;
  /** Ring contrast (0-1) */
  ringContrast?: number;
  /** Grain direction angle (radians) */
  grainAngle?: number;
  /** Amount of noise distortion */
  noiseAmount?: number;
  /** Scale of the pattern */
  scale?: number;
  /** Use LUT for faster evaluation (default: false for quality) */
  useLUT?: boolean;
}

// Cached noise context for LUT-accelerated evaluation
let cachedNoiseContext: FastNoiseContext | null = null;
let cachedNoiseSeed: number = -1;

/**
 * Wood Grain Texture Generator
 */
export const WoodGrainGenerator: TextureGenerator = {
  name: 'wood_grain',
  description: 'Procedural wood grain with ring patterns and species-specific colors',

  defaultParams: {
    species: 'oak',
    ringFrequency: 20,
    ringContrast: 0.6,
    grainAngle: 0,
    noiseAmount: 0.3,
    scale: 1,
    useLUT: false  // Default to high-quality direct noise evaluation
  },

  evaluate(context: EvaluationContext, params: GeneratorParams, seed: number): TextureResult {
    const result = defaultResult();

    const p = { ...this.defaultParams, ...params } as WoodGrainParams;
    const species = WOOD_SPECIES[p.species || 'oak'] || WOOD_SPECIES.oak;
    const useLUT = p.useLUT === true;  // Default false for quality

    // Get or create noise context for LUT-based evaluation
    let noiseCtx: FastNoiseContext | null = null;
    if (useLUT) {
      if (cachedNoiseSeed !== seed) {
        cachedNoiseContext = getNoiseContext(seed);
        cachedNoiseSeed = seed;
      }
      noiseCtx = cachedNoiseContext;
    }

    // Scale and rotate coordinates
    const scale = p.scale || 1;
    const angle = p.grainAngle || 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Use UV coordinates scaled up
    let x = (context.u * cos - context.v * sin) * scale;
    let y = (context.u * sin + context.v * cos) * scale;

    // Apply domain warping for natural variation
    if (p.noiseAmount && p.noiseAmount > 0) {
      if (noiseCtx) {
        // Fast LUT-based domain warp
        const warped = noiseCtx.domainWarp(x * 2, y * 2, p.noiseAmount);
        x = warped.u / 2;
        y = warped.v / 2;
      } else {
        // Original FBM-based warp (slower but higher quality)
        const warped = domainWarp2D(x * 2, y * 2, seed, p.noiseAmount);
        x = warped.x / 2;
        y = warped.y / 2;
      }
    }

    // Calculate distance from center for ring pattern
    let ringDist = Math.sqrt(x ** 2 + (y * 0.3) ** 2);

    // Add world position influence for subtle per-part variation if available
    if (context.worldPos) {
      const worldOffset = (context.worldPos.x + context.worldPos.z) * 0.5;
      ringDist += worldOffset;
    }

    // Ring pattern with noise
    const ringFreq = p.ringFrequency || 20;
    const ringPhase = ringDist * ringFreq;

    let ringNoise: number;
    let grainNoise: number;
    let fineNoise: number;
    let normalNoise: number;

    if (noiseCtx) {
      // Fast LUT-based noise sampling
      ringNoise = noiseCtx.fbm.sample(x * 5, y * 5) * 0.5;
      grainNoise = noiseCtx.fbm.sample(x * 50, y * 10) * 0.2;
      fineNoise = noiseCtx.primary.sampleScaled(x, y, 100 / 32) * 0.1;
      normalNoise = noiseCtx.secondary.sampleScaled(x, y, 30 / 64) * 0.1;
    } else {
      // Original perlin/fbm calls (slower)
      ringNoise = fbm2D(x * 5, y * 5, seed + 100, 3) * 0.5;
      grainNoise = fbm2D(x * 50, y * 10, seed + 200, 3) * 0.2;
      fineNoise = perlin2D(x * 100, y * 20, seed + 250) * 0.1;
      normalNoise = perlin2D(x * 30, y * 30, seed + 300) * 0.1;
    }

    const ringValue = Math.sin((ringPhase + ringNoise) * Math.PI * 2) * 0.5 + 0.5;

    // Combine ring and grain with visible contrast
    const contrast = p.ringContrast || 0.6;
    const pattern = clamp01(ringValue * contrast + grainNoise + fineNoise + (1 - contrast) * 0.5);

    // Apply species colors
    result.albedo = blendColors(species.light, species.dark, pattern);

    // Roughness varies with grain
    result.roughness = species.roughness + (pattern - 0.5) * 0.15 + fineNoise * 0.1;

    // Subtle normal variation along grain
    result.normal = new Vec3(normalNoise, normalNoise * 0.5, 1).normalize();

    // Height follows ring pattern
    result.height = (pattern - 0.5) * 0.1;

    // Wood is not metallic
    result.metallic = 0;

    return result;
  }
};

// Register the generator
registerGenerator(WoodGrainGenerator);
