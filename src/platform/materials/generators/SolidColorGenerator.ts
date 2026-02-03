/**
 * Solid Color Generator
 *
 * Simple solid color with optional subtle noise variation.
 * Good for materials like ivory, ebony, ceramic, plastic.
 */

import {
  TextureGenerator, TextureResult, GeneratorParams, EvaluationContext, Color,
  defaultResult, clamp01, fbm2D, registerGenerator
} from '../TextureGenerator';

export const SolidColorGenerator: TextureGenerator = {
  name: 'solid_color',
  description: 'Solid color with optional subtle noise variation',
  defaultParams: {
    color: { r: 0.8, g: 0.8, b: 0.8 },
    roughness: 0.3,
    metalness: 0.0,
    variation: 0.02,  // Subtle color variation
    scale: 10
  },

  evaluate(context: EvaluationContext, params: GeneratorParams, seed: number): TextureResult {
    const result = defaultResult();
    const p = { ...this.defaultParams, ...params };
    const baseColor = p.color as Color;

    // Fast path: skip noise when variation is negligible
    if (p.variation < 0.001) {
      result.albedo = { r: baseColor.r, g: baseColor.g, b: baseColor.b };
      result.roughness = p.roughness;
      result.metallic = p.metalness;
      return result;
    }

    // Add subtle noise for realism
    const noise = fbm2D(context.u * p.scale, context.v * p.scale, seed, 2);
    const variation = (noise - 0.5) * 2 * p.variation;

    result.albedo = {
      r: clamp01(baseColor.r + variation),
      g: clamp01(baseColor.g + variation),
      b: clamp01(baseColor.b + variation)
    };

    result.roughness = p.roughness;
    result.metallic = p.metalness;

    return result;
  }
};

// Register on module load
registerGenerator(SolidColorGenerator);
