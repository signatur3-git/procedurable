/**
 * Text Rasterizer (G5-002)
 *
 * Rasterizes text using font glyphs to a pixel buffer for texture generation.
 * Integrates with the material layer stack system.
 */

import { fontParser, GlyphOutline } from '../../generation/text/FontParser';
import { Color, defaultResult, TextureResult } from './TextureGenerator';
import { Vec3 } from '../math/Vec3';

/**
 * Text alignment options
 */
export type TextAlign = 'left' | 'center' | 'right';
export type TextBaseline = 'top' | 'middle' | 'bottom';

/**
 * Text layer definition
 */
export interface TextLayer {
  /** Text content (supports $variable substitution) */
  content: string;
  /** Font name (must be loaded) */
  font?: string;
  /** Text size in UV space (0-1) */
  size: number;
  /** Text color */
  color: Color;
  /** Position in UV space */
  position: { u: number; v: number };
  /** Horizontal alignment */
  align?: TextAlign;
  /** Vertical baseline */
  baseline?: TextBaseline;
  /** Optional background color */
  backgroundColor?: Color;
  /** Letter spacing multiplier */
  letterSpacing?: number;
}

/**
 * Rasterized text result
 */
export interface RasterizedText {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Coverage buffer (0-1 per pixel) */
  coverage: Float32Array;
  /** Bounds in UV space */
  uvBounds: {
    uMin: number;
    uMax: number;
    vMin: number;
    vMax: number;
  };
}

/**
 * Check if a point is inside a polygon using ray casting
 */
function pointInPolygon(x: number, y: number, polygon: Array<{ x: number; z: number }>): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].z;
    const xj = polygon[j].x, yj = polygon[j].z;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}


/**
 * Check if a point is inside the glyph (accounting for holes)
 */
function pointInGlyph(x: number, y: number, outline: GlyphOutline): boolean {
  let inside = false;

  for (const contour of outline.contours) {
    if (pointInPolygon(x, y, contour.points)) {
      if (contour.isHole) {
        inside = false; // Inside a hole
      } else {
        inside = true; // Inside outer boundary
      }
    }
  }

  return inside;
}

/**
 * Rasterize a single glyph to a coverage buffer
 */
function rasterizeGlyph(
  outline: GlyphOutline,
  buffer: Float32Array,
  bufferWidth: number,
  bufferHeight: number,
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  // Calculate glyph bounds in buffer space
  const gx0 = Math.floor(offsetX + outline.bounds.xMin * scale);
  const gx1 = Math.ceil(offsetX + outline.bounds.xMax * scale);
  const gy0 = Math.floor(offsetY + outline.bounds.zMin * scale);
  const gy1 = Math.ceil(offsetY + outline.bounds.zMax * scale);

  // Clamp to buffer
  const x0 = Math.max(0, gx0);
  const x1 = Math.min(bufferWidth, gx1);
  const y0 = Math.max(0, gy0);
  const y1 = Math.min(bufferHeight, gy1);

  // Sample each pixel
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      // Convert buffer coords to glyph space
      const gx = (x - offsetX) / scale;
      const gy = (y - offsetY) / scale;

      if (pointInGlyph(gx, gy, outline)) {
        const idx = y * bufferWidth + x;
        buffer[idx] = 1;
      }
    }
  }
}

/**
 * Rasterize text to a coverage buffer
 */
export async function rasterizeText(
  text: string,
  fontName: string,
  width: number,
  height: number,
  fontSize: number
): Promise<RasterizedText> {
  const buffer = new Float32Array(width * height);

  // Get glyphs
  const glyphs: GlyphOutline[] = [];
  let totalWidth = 0;
  let maxHeight = 0;

  for (const char of text) {
    try {
      const glyph = fontParser.getGlyphOutline(char, fontName);
      glyphs.push(glyph);
      totalWidth += glyph.width;
      maxHeight = Math.max(maxHeight, glyph.bounds.zMax - glyph.bounds.zMin);
    } catch {
      // Skip unknown characters
    }
  }

  if (glyphs.length === 0) {
    return {
      width,
      height,
      coverage: buffer,
      uvBounds: { uMin: 0, uMax: 0, vMin: 0, vMax: 0 }
    };
  }

  // Calculate scale to fit
  const scale = fontSize / maxHeight;
  const scaledWidth = totalWidth * scale;

  // Center in buffer
  const startX = (width - scaledWidth) / 2;
  const startY = (height - fontSize) / 2;

  // Rasterize each glyph
  let x = startX;
  for (const glyph of glyphs) {
    rasterizeGlyph(glyph, buffer, width, height, x, startY, scale);
    x += glyph.width * scale;
  }

  return {
    width,
    height,
    coverage: buffer,
    uvBounds: {
      uMin: startX / width,
      uMax: (startX + scaledWidth) / width,
      vMin: startY / height,
      vMax: (startY + fontSize) / height
    }
  };
}

/**
 * Evaluate text layer at a UV coordinate
 */
export function evaluateTextLayer(
  layer: TextLayer,
  u: number,
  v: number,
  rasterized: RasterizedText
): { coverage: number; color: Color } {
  // Check if in bounds
  if (u < rasterized.uvBounds.uMin || u > rasterized.uvBounds.uMax ||
      v < rasterized.uvBounds.vMin || v > rasterized.uvBounds.vMax) {
    return { coverage: 0, color: layer.color };
  }

  // Map UV to buffer coordinates
  const bufferX = Math.floor(u * rasterized.width);
  const bufferY = Math.floor(v * rasterized.height);

  if (bufferX < 0 || bufferX >= rasterized.width ||
      bufferY < 0 || bufferY >= rasterized.height) {
    return { coverage: 0, color: layer.color };
  }

  const idx = bufferY * rasterized.width + bufferX;
  const coverage = rasterized.coverage[idx] ?? 0;

  return { coverage, color: layer.color };
}

/**
 * TextRasterizer class for caching and managing text rendering
 */
export class TextRasterizer {
  private cache = new Map<string, RasterizedText>();
  private defaultResolution = 256;

  /**
   * Rasterize text with caching
   */
  async rasterize(
    text: string,
    fontName: string = 'default',
    fontSize: number = 64,
    resolution?: number
  ): Promise<RasterizedText> {
    const res = resolution ?? this.defaultResolution;
    const cacheKey = `${text}:${fontName}:${fontSize}:${res}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const result = await rasterizeText(text, fontName, res, res, fontSize);
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Set default resolution
   */
  setDefaultResolution(res: number): void {
    this.defaultResolution = res;
  }
}

/**
 * Create a text texture result for compositing
 */
export function createTextResult(
  layer: TextLayer,
  coverage: number
): TextureResult {
  const result = defaultResult();

  if (coverage > 0) {
    result.albedo = layer.color;
    // Text is typically sharp/smooth
    result.roughness = 0.3;
  } else if (layer.backgroundColor) {
    result.albedo = layer.backgroundColor;
    result.roughness = 0.5;
  }

  result.metallic = 0;
  result.normal = new Vec3(0, 0, 1);
  result.height = coverage * 0.01; // Slight embossing

  return result;
}

// Export singleton
export const textRasterizer = new TextRasterizer();
