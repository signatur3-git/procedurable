import * as opentype from 'opentype.js';
import { proceduralFontRegistry } from './ProceduralFont';

/**
 * 2D point for glyph outlines
 */
export interface Point2D {
  x: number;
  z: number; // Using z instead of y to match our XZ ground plane convention
}

/**
 * Contour in a glyph outline (can be outer boundary or hole)
 */
export interface GlyphContour {
  points: Point2D[];
  isHole: boolean; // True if this contour represents a hole (e.g., inside 'O', 'A', 'D')
}

/**
 * Glyph outline with multiple contours
 */
export interface GlyphOutline {
  char: string;
  width: number;  // Advance width for kerning
  height: number; // Font height
  contours: GlyphContour[];
  bounds: {
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
  };
}

/**
 * Font parser using opentype.js
 */
export class FontParser {
  private fonts: Map<string, opentype.Font> = new Map();

  constructor() {
    // Will load default fonts on first use
  }

  /**
   * Load a font from file
   */
  async loadFont(name: string, path: string): Promise<void> {
    try {
      const font = await opentype.load(path);
      this.fonts.set(name, font);
      console.log(`✓ Loaded font: ${name} from ${path}`);
    } catch (error) {
      throw new Error(`Failed to load font ${name} from ${path}: ${error}`);
    }
  }

  /**
   * Load bundled default fonts
   */
  async loadDefaultFonts(): Promise<void> {
    // For now, we'll use system fonts or bundled ones
    // In production, we'd bundle open-source fonts like Roboto, Open Sans
    // For MVP, we'll provide helper methods that work with any loaded font
    console.log('FontParser: Default fonts can be loaded via loadFont()');
  }

  /**
   * Check if font is loaded (external or procedural)
   */
  hasFont(name: string): boolean {
    return this.fonts.has(name) || proceduralFontRegistry.hasFont(name);
  }

  /**
   * Get loaded font names (both external and procedural)
   */
  getFontNames(): string[] {
    const external = Array.from(this.fonts.keys());
    const procedural = proceduralFontRegistry.getFontNames();
    return [...new Set([...external, ...procedural])];
  }

  /**
   * Get glyph outline for a single character
   */
  getGlyphOutline(
    fontName: string,
    char: string,
    size: number = 1.0
  ): GlyphOutline {
    const font = this.fonts.get(fontName);
    if (!font) {
      throw new Error(`Font not loaded: ${fontName}. Available: ${this.getFontNames().join(', ')}`);
    }

    if (char.length !== 1) {
      throw new Error(`getGlyphOutline expects single character, got: "${char}"`);
    }

    const glyph = font.charToGlyph(char);
    if (!glyph) {
      throw new Error(`Character not found in font: "${char}"`);
    }

    // Get glyph path
    const path = glyph.getPath(0, 0, size);

    // Extract contours from path commands
    const contours = this.extractContours(path, size, font.unitsPerEm);

    // Calculate bounds
    const bounds = this.calculateBounds(contours);

    // Get advance width (for kerning)
    const width = (glyph.advanceWidth || font.unitsPerEm) / font.unitsPerEm * size;
    const height = size;

    return {
      char,
      width,
      height,
      contours,
      bounds
    };
  }

  /**
   * Get outlines for a string of text
   */
  getTextOutlines(
    fontName: string,
    text: string,
    size: number = 1.0,
    spacing: number = 0.0 // Additional spacing between characters
  ): GlyphOutline[] {
    const font = this.fonts.get(fontName);

    // Check for procedural font fallback
    if (!font) {
      if (proceduralFontRegistry.hasFont(fontName)) {
        return this.getProceduralTextOutlines(fontName, text, size, spacing);
      }
      throw new Error(`Font not loaded: ${fontName}. Available: ${this.getFontNames().join(', ')}`);
    }

    const outlines: GlyphOutline[] = [];
    let currentX = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Skip spaces (or handle them specially)
      if (char === ' ') {
        currentX += size * 0.3; // Space width approximation
        continue;
      }

      const outline = this.getGlyphOutline(fontName, char, size);

      // Offset contours by current X position
      for (const contour of outline.contours) {
        for (const point of contour.points) {
          point.x += currentX;
        }
      }

      // Update bounds
      outline.bounds.xMin += currentX;
      outline.bounds.xMax += currentX;

      outlines.push(outline);

      // Advance to next character position
      currentX += outline.width + spacing;

      // Optional: Apply kerning if next character exists
      if (i < text.length - 1) {
        const nextChar = text[i + 1];
        const kerning = font.getKerningValue(font.charToGlyph(char), font.charToGlyph(nextChar));
        currentX += (kerning / font.unitsPerEm) * size;
      }
    }

    return outlines;
  }

  /**
   * Extract contours from opentype.js Path object
   */
  private extractContours(
    path: opentype.Path,
    size: number,
    unitsPerEm: number
  ): GlyphContour[] {
    const contours: GlyphContour[] = [];
    let currentContour: Point2D[] = [];

    const scale = size / unitsPerEm;

    for (const cmd of path.commands) {
      switch (cmd.type) {
        case 'M': // Move to (start new contour)
          if (currentContour.length > 0) {
            contours.push({
              points: currentContour,
              isHole: this.isClockwise(currentContour) // Holes are typically CW
            });
            currentContour = [];
          }
          currentContour.push({
            x: cmd.x * scale,
            z: -cmd.y * scale // Flip Y to Z, negate for correct orientation
          });
          break;

        case 'L': // Line to
          currentContour.push({
            x: cmd.x * scale,
            z: -cmd.y * scale
          });
          break;

        case 'Q': // Quadratic bezier
          // Approximate with line segments
          const lastPoint = currentContour[currentContour.length - 1];
          const steps = 8;
          for (let t = 1; t <= steps; t++) {
            const u = t / steps;
            const x = Math.pow(1 - u, 2) * lastPoint.x +
                     2 * (1 - u) * u * cmd.x1 * scale +
                     Math.pow(u, 2) * cmd.x * scale;
            const z = -(Math.pow(1 - u, 2) * (-lastPoint.z) +
                       2 * (1 - u) * u * cmd.y1 +
                       Math.pow(u, 2) * cmd.y);
            currentContour.push({ x, z: z * scale });
          }
          break;

        case 'C': // Cubic bezier
          // Approximate with line segments
          const last = currentContour[currentContour.length - 1];
          const bezierSteps = 10;
          for (let t = 1; t <= bezierSteps; t++) {
            const u = t / bezierSteps;
            const x = Math.pow(1 - u, 3) * last.x +
                     3 * Math.pow(1 - u, 2) * u * cmd.x1 * scale +
                     3 * (1 - u) * Math.pow(u, 2) * cmd.x2 * scale +
                     Math.pow(u, 3) * cmd.x * scale;
            const z = -(Math.pow(1 - u, 3) * (-last.z) +
                       3 * Math.pow(1 - u, 2) * u * cmd.y1 +
                       3 * (1 - u) * Math.pow(u, 2) * cmd.y2 +
                       Math.pow(u, 3) * cmd.y);
            currentContour.push({ x, z: z * scale });
          }
          break;

        case 'Z': // Close path
          if (currentContour.length > 0) {
            contours.push({
              points: currentContour,
              isHole: this.isClockwise(currentContour)
            });
            currentContour = [];
          }
          break;
      }
    }

    // Add last contour if not closed
    if (currentContour.length > 0) {
      contours.push({
        points: currentContour,
        isHole: this.isClockwise(currentContour)
      });
    }

    return contours;
  }

  /**
   * Check if a contour is clockwise (typically indicates a hole)
   */
  private isClockwise(points: Point2D[]): boolean {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      sum += (p2.x - p1.x) * (p2.z + p1.z);
    }
    return sum < 0; // Changed from > 0: negative sum = clockwise
  }

  /**
   * Calculate bounding box for contours
   */
  private calculateBounds(contours: GlyphContour[]): {
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
  } {
    let xMin = Infinity;
    let xMax = -Infinity;
    let zMin = Infinity;
    let zMax = -Infinity;

    for (const contour of contours) {
      for (const point of contour.points) {
        xMin = Math.min(xMin, point.x);
        xMax = Math.max(xMax, point.x);
        zMin = Math.min(zMin, point.z);
        zMax = Math.max(zMax, point.z);
      }
    }

    return { xMin, xMax, zMin, zMax };
  }

  /**
   * Get text outlines using procedural fonts (fallback when no external font loaded)
   */
  private getProceduralTextOutlines(
    fontName: string,
    text: string,
    size: number,
    spacing: number
  ): GlyphOutline[] {
    const font = proceduralFontRegistry.getFont(fontName);
    if (!font) {
      throw new Error(`Procedural font not found: ${fontName}`);
    }

    const outlines: GlyphOutline[] = [];
    let currentX = 0;

    for (const char of text.toUpperCase()) {
      const glyph = font.glyphs.get(char);

      if (!glyph) {
        // Unknown character - add spacing and continue
        currentX += size * 0.3;
        continue;
      }

      // Skip space characters (they have no contours)
      if (glyph.contours.length === 0) {
        currentX += glyph.width * size + spacing;
        continue;
      }

      // Scale and offset the glyph
      // Letters are defined with z=0 at bottom, z=h at top
      // When viewing from above (positive Y), high Z is at the far side
      // This is correct for a nameplate viewed from above
      const scaledContours: GlyphContour[] = glyph.contours.map(c => ({
        points: c.points.map(p => ({
          x: p.x * size + currentX,
          z: p.z * size
        })),
        isHole: c.isHole
      }));

      const outline: GlyphOutline = {
        char: glyph.char,
        width: glyph.width * size,
        height: glyph.height * size,
        contours: scaledContours,
        bounds: {
          xMin: glyph.bounds.xMin * size + currentX,
          xMax: glyph.bounds.xMax * size + currentX,
          zMin: glyph.bounds.zMin * size,
          zMax: glyph.bounds.zMax * size
        }
      };

      outlines.push(outline);
      currentX += glyph.width * size + spacing;
    }

    return outlines;
  }
}

// Global font parser instance
export const fontParser = new FontParser();
