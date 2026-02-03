/**
 * Metal Brushed Generator (G4-002)
 *
 * Generates brushed metal textures with directional scratches.
 */

import {
  TextureGenerator, TextureResult, GeneratorParams, EvaluationContext, Color,
  defaultResult, clamp01, fbm2D, perlin2D, registerGenerator
} from '../TextureGenerator';
import { Vec3 } from '../../math/Vec3';

export const MetalBrushedGenerator: TextureGenerator = {
  name: 'metal_brushed',
  description: 'Brushed metal with directional scratches',
  defaultParams: {
    baseColor: { r: 0.8, g: 0.8, b: 0.82 },
    brushDirection: 0, // radians, 0 = horizontal
    scratchDensity: 50,
    scratchDepth: 0.3,
    roughness: 0.35,
    metallic: 0.95
  },

  evaluate(context: EvaluationContext, params: GeneratorParams, seed: number): TextureResult {
    const result = defaultResult();
    const p = { ...this.defaultParams, ...params };

    // Rotate coordinates for brush direction
    const cos = Math.cos(p.brushDirection);
    const sin = Math.sin(p.brushDirection);
    const x = context.u * cos - context.v * sin;
    const y = context.u * sin + context.v * cos;

    // Stretched noise for scratches (high frequency along brush direction)
    const scratches = fbm2D(x * p.scratchDensity, y * 2, seed, 4);
    const scratchMask = clamp01(scratches * p.scratchDepth + 0.5);

    // Subtle color variation
    const colorVar = perlin2D(context.u * 10, context.v * 10, seed + 100) * 0.05;
    result.albedo = {
      r: clamp01((p.baseColor as Color).r + colorVar),
      g: clamp01((p.baseColor as Color).g + colorVar),
      b: clamp01((p.baseColor as Color).b + colorVar * 1.1)
    };

    // Scratches affect roughness (scratched areas are rougher)
    result.roughness = p.roughness + scratchMask * 0.2;
    result.metallic = p.metallic;

    // Anisotropic normal (scratches create directional highlights)
    const normalStrength = scratchMask * 0.15;
    result.normal = new Vec3(
      -sin * normalStrength,
      cos * normalStrength,
      1
    ).normalize();

    result.height = -scratchMask * 0.02;
    return result;
  }
};

registerGenerator(MetalBrushedGenerator);
