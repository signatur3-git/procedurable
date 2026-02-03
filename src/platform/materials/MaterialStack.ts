/**
 * Material Stack (G4-003)
 *
 * Layer-based material composition system. Evaluates multiple texture
 * generators with blend modes and masks to produce final PBR values.
 */

import {
  TextureResult,
  EvaluationContext,
  GeneratorParams,
  Color,
  defaultResult,
  blendColors,
  clamp01,
  getGenerator,
  fbm2D
} from './TextureGenerator';
import { Vec3 } from '../math/Vec3';

/**
 * Blend modes for layer compositing
 */
export type BlendMode = 'normal' | 'multiply' | 'overlay' | 'add' | 'screen';

/**
 * Mask types for controlling layer visibility
 */
export type MaskType = 'uniform' | 'noise' | 'curvature' | 'ao' | 'expression';

/**
 * Mask definition
 */
export interface LayerMask {
  type: MaskType;
  /** For uniform: constant value 0-1 */
  value?: number;
  /** For noise: scale and seed */
  noiseScale?: number;
  noiseSeed?: number;
  /** For curvature/ao: threshold and falloff */
  threshold?: number;
  falloff?: number;
  /** For expression: expression string like "curvature > 0.5" */
  expression?: string;
  /** Invert the mask */
  invert?: boolean;
}

/**
 * A single material layer
 */
export interface MaterialLayer {
  /** Generator name (registered generator) */
  generator: string;
  /** Generator parameters */
  params?: GeneratorParams;
  /** Blend mode for compositing */
  blendMode?: BlendMode;
  /** Layer opacity 0-1 */
  opacity?: number;
  /** Mask controlling where layer is visible */
  mask?: LayerMask;
}

/**
 * Material stack definition
 */
export interface MaterialStackDefinition {
  /** Layers evaluated bottom-to-top */
  layers: MaterialLayer[];
}

/**
 * Blend two values using specified mode
 */
function blendValue(base: number, layer: number, mode: BlendMode): number {
  switch (mode) {
    case 'multiply':
      return base * layer;
    case 'overlay':
      return base < 0.5
        ? 2 * base * layer
        : 1 - 2 * (1 - base) * (1 - layer);
    case 'add':
      return Math.min(1, base + layer);
    case 'screen':
      return 1 - (1 - base) * (1 - layer);
    case 'normal':
    default:
      return layer;
  }
}

/**
 * Blend two colors using specified mode
 */
function blendColorWithMode(base: Color, layer: Color, mode: BlendMode): Color {
  return {
    r: blendValue(base.r, layer.r, mode),
    g: blendValue(base.g, layer.g, mode),
    b: blendValue(base.b, layer.b, mode)
  };
}

/**
 * Blend two texture results
 */
function blendResults(
  base: TextureResult,
  layer: TextureResult,
  mode: BlendMode,
  opacity: number
): TextureResult {
  const blendedColor = blendColorWithMode(base.albedo, layer.albedo, mode);

  return {
    albedo: blendColors(base.albedo, blendedColor, opacity),
    normal: new Vec3(
      base.normal.x + (layer.normal.x - 0) * opacity,
      base.normal.y + (layer.normal.y - 0) * opacity,
      base.normal.z + (layer.normal.z - 1) * opacity + 1
    ).normalize(),
    roughness: base.roughness + (blendValue(base.roughness, layer.roughness, mode) - base.roughness) * opacity,
    metallic: base.metallic + (blendValue(base.metallic, layer.metallic, mode) - base.metallic) * opacity,
    height: base.height + (layer.height - base.height) * opacity
  };
}

/**
 * Evaluate a mask at a given context
 */
export function evaluateMask(mask: LayerMask, context: EvaluationContext, seed: number): number {
  let value: number;

  switch (mask.type) {
    case 'uniform':
      value = mask.value ?? 1;
      break;

    case 'noise':
      const scale = mask.noiseScale ?? 10;
      const noiseSeed = mask.noiseSeed ?? seed;
      value = clamp01(fbm2D(context.u * scale, context.v * scale, noiseSeed, 3) * 0.5 + 0.5);
      break;

    case 'curvature':
      const curvature = context.curvature ?? 0;
      const curvThreshold = mask.threshold ?? 0.2;
      const curvFalloff = mask.falloff ?? 0.3;
      value = clamp01((curvature - curvThreshold) / curvFalloff);
      break;

    case 'ao':
      const ao = context.ao ?? 1;
      const aoThreshold = mask.threshold ?? 0.7;
      const aoFalloff = mask.falloff ?? 0.3;
      // Low AO = high mask value (for dirt in crevices)
      value = clamp01((aoThreshold - ao) / aoFalloff);
      break;

    case 'expression':
      value = evaluateExpression(mask.expression ?? 'true', context);
      break;

    default:
      value = 1;
  }

  // Apply inversion
  if (mask.invert) {
    value = 1 - value;
  }

  return clamp01(value);
}

/**
 * Simple expression evaluator for mask expressions
 * Supports: curvature, ao, u, v, and comparison operators
 */
function evaluateExpression(expr: string, context: EvaluationContext): number {
  // Replace variables with values
  let processed = expr
    .replace(/\bcurvature\b/g, String(context.curvature ?? 0))
    .replace(/\bao\b/g, String(context.ao ?? 1))
    .replace(/\bu\b/g, String(context.u))
    .replace(/\bv\b/g, String(context.v))
    .replace(/\btrue\b/g, '1')
    .replace(/\bfalse\b/g, '0');

  // Handle simple comparisons: "X > Y" or "X < Y"
  const gtMatch = processed.match(/([\d.]+)\s*>\s*([\d.]+)/);
  if (gtMatch) {
    return parseFloat(gtMatch[1]) > parseFloat(gtMatch[2]) ? 1 : 0;
  }

  const ltMatch = processed.match(/([\d.]+)\s*<\s*([\d.]+)/);
  if (ltMatch) {
    return parseFloat(ltMatch[1]) < parseFloat(ltMatch[2]) ? 1 : 0;
  }

  // Handle AND
  if (processed.includes('AND')) {
    const parts = processed.split(/\s+AND\s+/i);
    return parts.every(p => evaluateExpression(p.trim(), context) > 0.5) ? 1 : 0;
  }

  // Handle OR
  if (processed.includes('OR')) {
    const parts = processed.split(/\s+OR\s+/i);
    return parts.some(p => evaluateExpression(p.trim(), context) > 0.5) ? 1 : 0;
  }

  // Try to parse as number
  const num = parseFloat(processed);
  return isNaN(num) ? 0 : clamp01(num);
}

/**
 * Material stack evaluator
 */
export class MaterialStack {
  private layers: MaterialLayer[];

  constructor(definition: MaterialStackDefinition) {
    this.layers = definition.layers;
  }

  /**
   * Evaluate the material stack at a point
   */
  evaluate(context: EvaluationContext, seed: number): TextureResult {
    let result = defaultResult();

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];

      // Get generator
      const generator = getGenerator(layer.generator);
      if (!generator) {
        console.warn(`Unknown generator: ${layer.generator}`);
        continue;
      }

      // Evaluate generator
      const layerResult = generator.evaluate(context, layer.params ?? {}, seed + i * 1000);

      // Evaluate mask
      let maskValue = 1;
      if (layer.mask) {
        maskValue = evaluateMask(layer.mask, context, seed + i * 2000);
      }

      // Apply opacity
      const opacity = (layer.opacity ?? 1) * maskValue;
      if (opacity <= 0) continue;

      // Blend with base
      const blendMode = layer.blendMode ?? 'normal';
      result = blendResults(result, layerResult, blendMode, opacity);
    }

    return result;
  }

  /**
   * Get layer count
   */
  get layerCount(): number {
    return this.layers.length;
  }
}

/**
 * Create a material stack from a definition
 */
export function createMaterialStack(definition: MaterialStackDefinition): MaterialStack {
  return new MaterialStack(definition);
}
