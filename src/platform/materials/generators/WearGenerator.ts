/**
 * Wear Generators (G4-002)
 */

import {
  TextureGenerator, TextureResult, GeneratorParams, EvaluationContext, Color,
  defaultResult, blendColors, clamp01, smoothstep, fbm2D, registerGenerator
} from '../TextureGenerator';

export const EdgeWearGenerator: TextureGenerator = {
  name: 'edge_wear',
  description: 'Curvature-driven wear on edges',
  defaultParams: { wornColor: { r: 0.7, g: 0.65, b: 0.6 }, wearAmount: 0.5, edgeThreshold: 0.2, noiseScale: 10 },

  evaluate(context: EvaluationContext, params: GeneratorParams, seed: number): TextureResult {
    const result = defaultResult();
    const p = { ...this.defaultParams, ...params };
    let wearMask = smoothstep(p.edgeThreshold, p.edgeThreshold + 0.3, context.curvature ?? 0);
    const noise = fbm2D(context.u * p.noiseScale, context.v * p.noiseScale, seed, 3);
    wearMask = clamp01(wearMask * clamp01(0.5 + noise * 0.7) * p.wearAmount);
    result.albedo = blendColors({ r: 0.5, g: 0.5, b: 0.5 }, p.wornColor as Color, wearMask);
    result.roughness = 0.5 + wearMask * 0.3;
    result.height = -wearMask * 0.1;
    return result;
  }
};

export const DirtAccumulationGenerator: TextureGenerator = {
  name: 'dirt_accumulation',
  description: 'AO-driven dirt in crevices',
  defaultParams: { dirtColor: { r: 0.25, g: 0.2, b: 0.15 }, dirtAmount: 0.6, aoThreshold: 0.7, noiseScale: 15 },

  evaluate(context: EvaluationContext, params: GeneratorParams, seed: number): TextureResult {
    const result = defaultResult();
    const p = { ...this.defaultParams, ...params };
    let dirtMask = smoothstep(p.aoThreshold, p.aoThreshold - 0.3, context.ao ?? 1);
    const noise = fbm2D(context.u * p.noiseScale, context.v * p.noiseScale, seed, 4);
    dirtMask = clamp01(dirtMask * clamp01(0.5 + noise * 0.6) * p.dirtAmount);
    result.albedo = blendColors({ r: 0.5, g: 0.5, b: 0.5 }, p.dirtColor as Color, dirtMask);
    result.roughness = 0.5 + dirtMask * 0.4;
    return result;
  }
};

registerGenerator(EdgeWearGenerator);
registerGenerator(DirtAccumulationGenerator);
