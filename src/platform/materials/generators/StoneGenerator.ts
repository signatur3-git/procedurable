/**
 * Stone Generator (G4-002)
 *
 * Generates procedural stone/brick textures using Voronoi cells.
 */

import {
  TextureGenerator, TextureResult, GeneratorParams, EvaluationContext, Color,
  defaultResult, blendColors, clamp01, smoothstep, fbm2D, worley2D, registerGenerator
} from '../TextureGenerator';
import { Vec3 } from '../../math/Vec3';

export const StoneGenerator: TextureGenerator = {
  name: 'stone',
  description: 'Voronoi-based stone/brick pattern with mortar lines',
  defaultParams: {
    stoneColor: { r: 0.6, g: 0.58, b: 0.55 },
    mortarColor: { r: 0.4, g: 0.38, b: 0.35 },
    scale: 5,
    mortarWidth: 0.08,
    colorVariation: 0.15,
    roughness: 0.75
  },

  evaluate(context: EvaluationContext, params: GeneratorParams, seed: number): TextureResult {
    const result = defaultResult();
    const p = { ...this.defaultParams, ...params };

    const x = context.u * p.scale;
    const y = context.v * p.scale;

    // Voronoi for cell pattern
    const cell = worley2D(x, y, seed);
    const mortarMask = smoothstep(p.mortarWidth, p.mortarWidth * 0.5, cell.distance);

    // Per-cell color variation
    const cellNoise = (cell.cellId % 1000) / 1000;
    const variation = (cellNoise - 0.5) * p.colorVariation;

    const stoneColor: Color = {
      r: clamp01((p.stoneColor as Color).r + variation),
      g: clamp01((p.stoneColor as Color).g + variation * 0.8),
      b: clamp01((p.stoneColor as Color).b + variation * 0.6)
    };

    // Surface noise
    const surfaceNoise = fbm2D(x * 3, y * 3, seed + 100, 3) * 0.1;
    stoneColor.r = clamp01(stoneColor.r + surfaceNoise);
    stoneColor.g = clamp01(stoneColor.g + surfaceNoise);
    stoneColor.b = clamp01(stoneColor.b + surfaceNoise);

    result.albedo = blendColors(p.mortarColor as Color, stoneColor, mortarMask);
    result.roughness = p.roughness + (1 - mortarMask) * 0.1;
    result.height = mortarMask * 0.1 - 0.05;

    // Normal from height gradient
    const eps = 0.01;
    const hx = worley2D(x + eps, y, seed).distance - worley2D(x - eps, y, seed).distance;
    const hy = worley2D(x, y + eps, seed).distance - worley2D(x, y - eps, seed).distance;
    result.normal = new Vec3(-hx * 2, -hy * 2, 1).normalize();

    result.metallic = 0;
    return result;
  }
};

registerGenerator(StoneGenerator);
