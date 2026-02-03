/**
 * Noise Color Generator (G4-002)
 *
 * Generic noise-to-color-ramp generator for flexible procedural coloring.
 */

import {
  TextureGenerator, TextureResult, GeneratorParams, EvaluationContext, Color,
  defaultResult, blendColors, clamp01, fbm2D, registerGenerator
} from '../TextureGenerator';

export const NoiseColorGenerator: TextureGenerator = {
  name: 'noise_color',
  description: 'Generic noise mapped to color ramp',
  defaultParams: {
    colorA: { r: 0.2, g: 0.2, b: 0.2 },
    colorB: { r: 0.8, g: 0.8, b: 0.8 },
    scale: 5,
    octaves: 4,
    contrast: 1,
    roughnessA: 0.3,
    roughnessB: 0.7
  },

  evaluate(context: EvaluationContext, params: GeneratorParams, seed: number): TextureResult {
    const result = defaultResult();
    const p = { ...this.defaultParams, ...params };

    // Generate noise value
    let noise = fbm2D(context.u * p.scale, context.v * p.scale, seed, p.octaves);

    // Apply contrast and remap to [0,1]
    noise = clamp01((noise * p.contrast + 1) * 0.5);

    // Map to color ramp
    result.albedo = blendColors(p.colorA as Color, p.colorB as Color, noise);
    result.roughness = p.roughnessA + noise * (p.roughnessB - p.roughnessA);
    result.height = (noise - 0.5) * 0.1;
    result.metallic = 0;

    return result;
  }
};

registerGenerator(NoiseColorGenerator);
