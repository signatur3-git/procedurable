/**
 * ProceduralFont - Native vector graphics font system
 *
 * Registers letter shapes from YAML builders as a "procedural font"
 * that can be used by TextSign without external font files.
 */

import { GlyphContour } from './FontParser';
import { Shape2D, Point2D } from '../../platform/geometry/Shape2D';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

/**
 * Glyph data for a single character
 */
export interface ProceduralGlyph {
  char: string;
  width: number;       // Advance width (how much to move for next char)
  height: number;
  contours: GlyphContour[];
  bounds: {
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
  };
}

/**
 * Procedural font definition
 */
export interface ProceduralFontDef {
  name: string;
  glyphs: Map<string, ProceduralGlyph>;
  defaultSpacing: number;
  lineHeight: number;
}

/**
 * Procedural font registry
 */
class ProceduralFontRegistry {
  private fonts: Map<string, ProceduralFontDef> = new Map();
  private initialized = false;

  /**
   * Register a new procedural font
   */
  registerFont(name: string, spacing: number = 0.1, lineHeight: number = 1.2): ProceduralFontDef {
    const font: ProceduralFontDef = {
      name,
      glyphs: new Map(),
      defaultSpacing: spacing,
      lineHeight
    };
    this.fonts.set(name, font);
    return font;
  }

  /**
   * Register a glyph from a Shape2D
   */
  registerGlyph(fontName: string, char: string, shape: Shape2D, advanceWidth?: number): void {
    let font = this.fonts.get(fontName);
    if (!font) {
      font = this.registerFont(fontName);
    }

    const bounds = shape.getBounds();
    const width = advanceWidth ?? (bounds.maxX - bounds.minX);
    const height = bounds.maxZ - bounds.minZ;

    // Convert Shape2D points to GlyphContour format
    const contour: GlyphContour = {
      points: shape.points.map(p => ({ x: p.x, z: p.z })),
      isHole: false
    };

    const glyph: ProceduralGlyph = {
      char,
      width,
      height,
      contours: [contour],
      bounds: {
        xMin: bounds.minX,
        xMax: bounds.maxX,
        zMin: bounds.minZ,
        zMax: bounds.maxZ
      }
    };

    font.glyphs.set(char, glyph);
  }

  /**
   * Register a glyph from raw points
   */
  registerGlyphFromPoints(
    fontName: string,
    char: string,
    points: Point2D[],
    advanceWidth?: number
  ): void {
    const shape = Shape2D.polygon(points);
    this.registerGlyph(fontName, char, shape, advanceWidth);
  }

  /**
   * Register a glyph with multiple contours (for letters with holes like O, A, D)
   */
  registerGlyphWithContours(
    fontName: string,
    char: string,
    contours: { points: Point2D[]; isHole: boolean }[],
    advanceWidth?: number
  ): void {
    let font = this.fonts.get(fontName);
    if (!font) {
      font = this.registerFont(fontName);
    }

    // Calculate bounds from all contours
    let xMin = Infinity, xMax = -Infinity;
    let zMin = Infinity, zMax = -Infinity;

    for (const contour of contours) {
      for (const p of contour.points) {
        xMin = Math.min(xMin, p.x);
        xMax = Math.max(xMax, p.x);
        zMin = Math.min(zMin, p.z);
        zMax = Math.max(zMax, p.z);
      }
    }

    const width = advanceWidth ?? (xMax - xMin);
    const height = zMax - zMin;

    const glyph: ProceduralGlyph = {
      char,
      width,
      height,
      contours: contours.map(c => ({
        points: c.points.map(p => ({ x: p.x, z: p.z })),
        isHole: c.isHole
      })),
      bounds: { xMin, xMax, zMin, zMax }
    };

    font.glyphs.set(char, glyph);
  }

  /**
   * Check if font is registered
   */
  hasFont(name: string): boolean {
    return this.fonts.has(name);
  }

  /**
   * Check if a specific glyph exists
   */
  hasGlyph(fontName: string, char: string): boolean {
    const font = this.fonts.get(fontName);
    return font ? font.glyphs.has(char) : false;
  }

  /**
   * Get a glyph from the registry
   */
  getGlyph(fontName: string, char: string): ProceduralGlyph | undefined {
    const font = this.fonts.get(fontName);
    return font?.glyphs.get(char);
  }

  /**
   * Get all glyphs for a font
   */
  getFont(name: string): ProceduralFontDef | undefined {
    return this.fonts.get(name);
  }

  /**
   * Get list of registered fonts
   */
  getFontNames(): string[] {
    return Array.from(this.fonts.keys());
  }

  /**
   * Get available characters in a font
   */
  getAvailableChars(fontName: string): string[] {
    const font = this.fonts.get(fontName);
    return font ? Array.from(font.glyphs.keys()) : [];
  }

  /**
   * Load letters from YAML builder files
   */
  async loadLettersFromDirectory(dir: string, fontName: string = 'procedural'): Promise<number> {
    if (!fs.existsSync(dir)) {
      console.warn(`Letter directory not found: ${dir}`);
      return 0;
    }

    let count = 0;
    const files = fs.readdirSync(dir);

    for (const file of files) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;

      try {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const builder = yaml.parse(content);

        // Look for letter in filename (e.g., LetterH.yaml -> 'H')
        const match = file.match(/Letter([A-Z0-9])/i);
        if (!match) continue;

        const char = match[1].toUpperCase();

        // Extract shape from builder
        if (builder.shapes) {
          const shapeKey = Object.keys(builder.shapes).find(k =>
            k.includes('outline') || k.includes('letter') || k.includes('shape')
          ) || Object.keys(builder.shapes)[0];

          const shapeDef = builder.shapes[shapeKey];
          if (shapeDef?.type === 'polygon' && shapeDef.points) {
            // Parse points - they might be expressions or literal values
            const points: Point2D[] = shapeDef.points.map((p: any) => ({
              x: typeof p.x === 'number' ? p.x : 0,  // Simplified: use 0 for expressions
              z: typeof p.z === 'number' ? p.z : 0
            }));

            // For now, skip shapes with expression-based points
            // (we'd need to evaluate them with measurements)
            const hasExpressions = shapeDef.points.some((p: any) =>
              typeof p.x === 'string' || typeof p.z === 'string'
            );

            if (!hasExpressions && points.length >= 3) {
              this.registerGlyphFromPoints(fontName, char, points);
              count++;
              console.log(`✓ Registered letter: ${char}`);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to load letter from ${file}:`, error);
      }
    }

    return count;
  }

  /**
   * Register built-in simple glyphs for common characters
   * These are simplified geometric representations
   *
   * COORDINATE SYSTEM:
   * - Letters are defined with z=0 at TOP, z=h at BOTTOM
   * - This ensures letters appear right-side up when viewed from the front
   *   (from positive Z looking toward negative Z, or equivalently, after
   *   rotating to view the sign from its intended viewing position)
   * - X increases left to right
   */
  registerBuiltinGlyphs(): void {
    const fontName = 'simple';

    // Basic dimensions
    const w = 0.6;  // width
    const h = 1.0;  // height
    const sw = 0.15; // stroke width

    // Helper to flip Z: converts from natural (z=0 bottom) to display (z=0 top)
    const flip = (z: number) => h - z;

    // Register some simple geometric letters
    // These are polygon outlines that trace the letter shape

    // Letter H (z-flipped for correct orientation when viewed from front)
    this.registerGlyphFromPoints(fontName, 'H', [
      { x: 0, z: flip(0) },         // bottom-left of left stroke
      { x: sw, z: flip(0) },        // bottom-right of left stroke
      { x: sw, z: flip(h/2 - sw/2) }, // bottom of crossbar
      { x: w - sw, z: flip(h/2 - sw/2) },
      { x: w - sw, z: flip(0) },    // bottom of right stroke
      { x: w, z: flip(0) },         // bottom-right corner
      { x: w, z: flip(h) },         // top-right corner
      { x: w - sw, z: flip(h) },
      { x: w - sw, z: flip(h/2 + sw/2) }, // top of crossbar
      { x: sw, z: flip(h/2 + sw/2) },
      { x: sw, z: flip(h) },        // top of left stroke
      { x: 0, z: flip(h) }          // top-left corner
    ], w + 0.1);

    // Letter E (z-flipped)
    this.registerGlyphFromPoints(fontName, 'E', [
      { x: 0, z: flip(0) },
      { x: w, z: flip(0) },
      { x: w, z: flip(sw) },
      { x: sw, z: flip(sw) },
      { x: sw, z: flip(h/2 - sw/2) },
      { x: w * 0.7, z: flip(h/2 - sw/2) },
      { x: w * 0.7, z: flip(h/2 + sw/2) },
      { x: sw, z: flip(h/2 + sw/2) },
      { x: sw, z: flip(h - sw) },
      { x: w, z: flip(h - sw) },
      { x: w, z: flip(h) },
      { x: 0, z: flip(h) }
    ], w + 0.1);

    // Letter L (z-flipped)
    this.registerGlyphFromPoints(fontName, 'L', [
      { x: 0, z: flip(0) },
      { x: w, z: flip(0) },
      { x: w, z: flip(sw) },
      { x: sw, z: flip(sw) },
      { x: sw, z: flip(h) },
      { x: 0, z: flip(h) }
    ], w + 0.1);

    // Letter O with proper hole using multi-contour support
    const outerR = w / 2;
    const innerR = outerR - sw;
    const cx = w / 2;
    const cz = h / 2;
    const segments = 12;

    // Outer contour (counter-clockwise when viewed from above)
    const outerPoints: Point2D[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      outerPoints.push({
        x: cx + Math.cos(angle) * outerR,
        z: flip(cz + Math.sin(angle) * (h/2 - sw/2))  // Elliptical to fill height
      });
    }

    // Inner contour (clockwise = hole)
    const innerPoints: Point2D[] = [];
    for (let i = segments - 1; i >= 0; i--) {  // Reverse order for clockwise
      const angle = (i / segments) * Math.PI * 2;
      innerPoints.push({
        x: cx + Math.cos(angle) * innerR,
        z: flip(cz + Math.sin(angle) * (h/2 - sw - sw/2))
      });
    }

    this.registerGlyphWithContours(fontName, 'O', [
      { points: outerPoints, isHole: false },
      { points: innerPoints, isHole: true }
    ], w + 0.1);

    // Letter I (z-flipped)
    this.registerGlyphFromPoints(fontName, 'I', [
      { x: 0, z: flip(0) },
      { x: w * 0.6, z: flip(0) },
      { x: w * 0.6, z: flip(sw) },
      { x: w * 0.35, z: flip(sw) },
      { x: w * 0.35, z: flip(h - sw) },
      { x: w * 0.6, z: flip(h - sw) },
      { x: w * 0.6, z: flip(h) },
      { x: 0, z: flip(h) },
      { x: 0, z: flip(h - sw) },
      { x: w * 0.25, z: flip(h - sw) },
      { x: w * 0.25, z: flip(sw) },
      { x: 0, z: flip(sw) }
    ], w * 0.6 + 0.1);

    // Letter N (z-flipped)
    this.registerGlyphFromPoints(fontName, 'N', [
      { x: 0, z: flip(0) },
      { x: sw, z: flip(0) },
      { x: sw, z: flip(h * 0.6) },
      { x: w - sw, z: flip(0) },
      { x: w, z: flip(0) },
      { x: w, z: flip(h) },
      { x: w - sw, z: flip(h) },
      { x: w - sw, z: flip(h * 0.4) },
      { x: sw, z: flip(h) },
      { x: 0, z: flip(h) }
    ], w + 0.1);

    // Letter X (z-flipped)
    this.registerGlyphFromPoints(fontName, 'X', [
      { x: 0, z: flip(0) },
      { x: sw * 1.2, z: flip(0) },
      { x: w/2, z: flip(h/2 - sw/2) },
      { x: w - sw * 1.2, z: flip(0) },
      { x: w, z: flip(0) },
      { x: w/2 + sw/2, z: flip(h/2) },
      { x: w, z: flip(h) },
      { x: w - sw * 1.2, z: flip(h) },
      { x: w/2, z: flip(h/2 + sw/2) },
      { x: sw * 1.2, z: flip(h) },
      { x: 0, z: flip(h) },
      { x: w/2 - sw/2, z: flip(h/2) }
    ], w + 0.1);

    // Letter T (z-flipped)
    this.registerGlyphFromPoints(fontName, 'T', [
      { x: w/2 - sw/2, z: flip(0) },
      { x: w/2 + sw/2, z: flip(0) },
      { x: w/2 + sw/2, z: flip(h - sw) },
      { x: w, z: flip(h - sw) },
      { x: w, z: flip(h) },
      { x: 0, z: flip(h) },
      { x: 0, z: flip(h - sw) },
      { x: w/2 - sw/2, z: flip(h - sw) }
    ], w + 0.1);

    // Space character (no points, just advance)
    this.fonts.get(fontName)?.glyphs.set(' ', {
      char: ' ',
      width: w * 0.5,
      height: h,
      contours: [],
      bounds: { xMin: 0, xMax: 0, zMin: 0, zMax: 0 }
    });

    // Additional letters for complete text support
    this.registerAdditionalLetters(fontName, w, h, sw, flip);

    console.log(`✓ Registered ${this.fonts.get(fontName)?.glyphs.size} built-in glyphs for '${fontName}' font`);
  }

  /**
   * Register additional letters for more complete text support
   */
  private registerAdditionalLetters(
    fontName: string,
    w: number,
    h: number,
    sw: number,
    flip: (z: number) => number
  ): void {
    // Letter A with hole
    const aOuter: Point2D[] = [
      { x: w/2, z: flip(h) },           // top point
      { x: w, z: flip(0) },             // bottom right
      { x: w - sw, z: flip(0) },        // bottom right inner
      { x: w - sw * 1.5, z: flip(h * 0.35) }, // crossbar right outer
      { x: sw * 1.5, z: flip(h * 0.35) },     // crossbar left outer
      { x: sw, z: flip(0) },            // bottom left inner
      { x: 0, z: flip(0) }              // bottom left
    ];
    // Simplified A without hole for now (complex hole shape)
    this.registerGlyphFromPoints(fontName, 'A', aOuter, w + 0.1);

    // Letter B - simplified solid
    this.registerGlyphFromPoints(fontName, 'B', [
      { x: 0, z: flip(0) },
      { x: w * 0.7, z: flip(0) },
      { x: w, z: flip(h * 0.15) },
      { x: w, z: flip(h * 0.35) },
      { x: w * 0.7, z: flip(h/2) },
      { x: w, z: flip(h * 0.65) },
      { x: w, z: flip(h * 0.85) },
      { x: w * 0.7, z: flip(h) },
      { x: 0, z: flip(h) }
    ], w + 0.1);

    // Letter C
    const cOuter: Point2D[] = [];
    const segments = 10;
    const cx = w / 2;
    const cz = h / 2;
    // C is an arc from ~45° to ~315°
    for (let i = 2; i <= segments - 1; i++) {
      const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
      cOuter.push({
        x: cx + Math.cos(angle) * (w / 2),
        z: flip(cz + Math.sin(angle) * (h / 2))
      });
    }
    // Add inner arc in reverse
    for (let i = segments - 1; i >= 2; i--) {
      const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
      cOuter.push({
        x: cx + Math.cos(angle) * (w / 2 - sw),
        z: flip(cz + Math.sin(angle) * (h / 2 - sw))
      });
    }
    this.registerGlyphFromPoints(fontName, 'C', cOuter, w + 0.1);

    // Letter D with hole
    const dOuter: Point2D[] = [
      { x: 0, z: flip(0) },
      { x: w * 0.5, z: flip(0) },
      { x: w, z: flip(h * 0.3) },
      { x: w, z: flip(h * 0.7) },
      { x: w * 0.5, z: flip(h) },
      { x: 0, z: flip(h) }
    ];
    this.registerGlyphFromPoints(fontName, 'D', dOuter, w + 0.1);

    // Letter F
    this.registerGlyphFromPoints(fontName, 'F', [
      { x: 0, z: flip(0) },
      { x: sw, z: flip(0) },
      { x: sw, z: flip(h/2 - sw/2) },
      { x: w * 0.6, z: flip(h/2 - sw/2) },
      { x: w * 0.6, z: flip(h/2 + sw/2) },
      { x: sw, z: flip(h/2 + sw/2) },
      { x: sw, z: flip(h - sw) },
      { x: w, z: flip(h - sw) },
      { x: w, z: flip(h) },
      { x: 0, z: flip(h) }
    ], w + 0.1);

    // Letter G
    const gOuter: Point2D[] = [];
    for (let i = 2; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
      gOuter.push({
        x: cx + Math.cos(angle) * (w / 2),
        z: flip(cz + Math.sin(angle) * (h / 2))
      });
    }
    // Crossbar
    gOuter.push({ x: w, z: flip(h/2) });
    gOuter.push({ x: w * 0.6, z: flip(h/2) });
    gOuter.push({ x: w * 0.6, z: flip(h/2 - sw) });
    // Inner arc
    for (let i = segments; i >= 2; i--) {
      const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
      gOuter.push({
        x: cx + Math.cos(angle) * (w / 2 - sw),
        z: flip(cz + Math.sin(angle) * (h / 2 - sw))
      });
    }
    this.registerGlyphFromPoints(fontName, 'G', gOuter, w + 0.1);

    // Letter J
    this.registerGlyphFromPoints(fontName, 'J', [
      { x: w * 0.3, z: flip(0) },
      { x: w - sw, z: flip(0) },
      { x: w, z: flip(h * 0.2) },
      { x: w, z: flip(h) },
      { x: w - sw, z: flip(h) },
      { x: w - sw, z: flip(h * 0.2) },
      { x: w * 0.5, z: flip(sw) },
      { x: w * 0.3, z: flip(sw) }
    ], w + 0.1);

    // Letter K
    this.registerGlyphFromPoints(fontName, 'K', [
      { x: 0, z: flip(0) },
      { x: sw, z: flip(0) },
      { x: sw, z: flip(h * 0.4) },
      { x: w - sw, z: flip(0) },
      { x: w, z: flip(0) },
      { x: sw * 2, z: flip(h/2) },
      { x: w, z: flip(h) },
      { x: w - sw, z: flip(h) },
      { x: sw, z: flip(h * 0.6) },
      { x: sw, z: flip(h) },
      { x: 0, z: flip(h) }
    ], w + 0.1);

    // Letter M
    this.registerGlyphFromPoints(fontName, 'M', [
      { x: 0, z: flip(0) },
      { x: sw, z: flip(0) },
      { x: sw, z: flip(h * 0.7) },
      { x: w/2, z: flip(h * 0.3) },
      { x: w - sw, z: flip(h * 0.7) },
      { x: w - sw, z: flip(0) },
      { x: w, z: flip(0) },
      { x: w, z: flip(h) },
      { x: w - sw, z: flip(h) },
      { x: w/2, z: flip(h * 0.5) },
      { x: sw, z: flip(h) },
      { x: 0, z: flip(h) }
    ], w + 0.1);

    // Letter P
    this.registerGlyphFromPoints(fontName, 'P', [
      { x: 0, z: flip(0) },
      { x: sw, z: flip(0) },
      { x: sw, z: flip(h/2 - sw/2) },
      { x: w * 0.6, z: flip(h/2 - sw/2) },
      { x: w, z: flip(h * 0.65) },
      { x: w, z: flip(h * 0.85) },
      { x: w * 0.6, z: flip(h) },
      { x: 0, z: flip(h) }
    ], w + 0.1);

    // Letter Q (O with tail)
    const qOuter: Point2D[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      qOuter.push({
        x: cx + Math.cos(angle) * (w / 2),
        z: flip(cz + Math.sin(angle) * (h / 2 - sw/2))
      });
    }
    // Add tail
    qOuter.splice(segments * 3/4, 0,
      { x: w, z: flip(0) },
      { x: w * 0.7, z: flip(h * 0.3) }
    );
    this.registerGlyphFromPoints(fontName, 'Q', qOuter, w + 0.1);

    // Letter R
    this.registerGlyphFromPoints(fontName, 'R', [
      { x: 0, z: flip(0) },
      { x: sw, z: flip(0) },
      { x: sw, z: flip(h/2 - sw/2) },
      { x: w * 0.5, z: flip(h/2 - sw/2) },
      { x: w - sw, z: flip(0) },
      { x: w, z: flip(0) },
      { x: w * 0.6, z: flip(h/2) },
      { x: w, z: flip(h * 0.65) },
      { x: w, z: flip(h * 0.85) },
      { x: w * 0.6, z: flip(h) },
      { x: 0, z: flip(h) }
    ], w + 0.1);

    // Letter S
    this.registerGlyphFromPoints(fontName, 'S', [
      { x: 0, z: flip(0) },
      { x: 0, z: flip(sw) },
      { x: w * 0.7, z: flip(sw) },
      { x: w, z: flip(h * 0.2) },
      { x: w * 0.3, z: flip(h/2 - sw/2) },
      { x: 0, z: flip(h * 0.65) },
      { x: 0, z: flip(h - sw) },
      { x: w * 0.8, z: flip(h - sw) },
      { x: w, z: flip(h) },
      { x: 0, z: flip(h) },
      { x: 0, z: flip(h * 0.65) },
      { x: w * 0.3, z: flip(h/2 + sw/2) },
      { x: w, z: flip(h * 0.35) },
      { x: w, z: flip(0) }
    ], w + 0.1);

    // Letter U
    this.registerGlyphFromPoints(fontName, 'U', [
      { x: 0, z: flip(h * 0.3) },
      { x: sw, z: flip(h * 0.3) },
      { x: sw, z: flip(h) },
      { x: 0, z: flip(h) },
      { x: 0, z: flip(h * 0.3) },
      { x: w * 0.3, z: flip(0) },
      { x: w * 0.7, z: flip(0) },
      { x: w, z: flip(h * 0.3) },
      { x: w, z: flip(h) },
      { x: w - sw, z: flip(h) },
      { x: w - sw, z: flip(h * 0.3) },
      { x: w * 0.65, z: flip(sw) },
      { x: w * 0.35, z: flip(sw) },
      { x: sw, z: flip(h * 0.3) }
    ], w + 0.1);

    // Letter V
    this.registerGlyphFromPoints(fontName, 'V', [
      { x: 0, z: flip(h) },
      { x: sw, z: flip(h) },
      { x: w/2, z: flip(sw) },
      { x: w - sw, z: flip(h) },
      { x: w, z: flip(h) },
      { x: w/2, z: flip(0) }
    ], w + 0.1);

    // Letter W
    this.registerGlyphFromPoints(fontName, 'W', [
      { x: 0, z: flip(h) },
      { x: sw, z: flip(h) },
      { x: w * 0.25, z: flip(sw) },
      { x: w/2, z: flip(h * 0.5) },
      { x: w * 0.75, z: flip(sw) },
      { x: w - sw, z: flip(h) },
      { x: w, z: flip(h) },
      { x: w * 0.8, z: flip(0) },
      { x: w/2, z: flip(h * 0.3) },
      { x: w * 0.2, z: flip(0) }
    ], w + 0.1);

    // Letter Y
    this.registerGlyphFromPoints(fontName, 'Y', [
      { x: 0, z: flip(h) },
      { x: sw, z: flip(h) },
      { x: w/2, z: flip(h/2 + sw) },
      { x: w/2 + sw/2, z: flip(h/2) },
      { x: w/2 + sw/2, z: flip(0) },
      { x: w/2 - sw/2, z: flip(0) },
      { x: w/2 - sw/2, z: flip(h/2) },
      { x: w/2, z: flip(h/2 + sw) },
      { x: w - sw, z: flip(h) },
      { x: w, z: flip(h) },
      { x: w/2 + sw/2, z: flip(h/2 + sw) },
      { x: w/2 - sw/2, z: flip(h/2 + sw) }
    ], w + 0.1);

    // Letter Z
    this.registerGlyphFromPoints(fontName, 'Z', [
      { x: 0, z: flip(0) },
      { x: w, z: flip(0) },
      { x: w, z: flip(sw) },
      { x: sw * 1.5, z: flip(h - sw) },
      { x: w, z: flip(h - sw) },
      { x: w, z: flip(h) },
      { x: 0, z: flip(h) },
      { x: 0, z: flip(h - sw) },
      { x: w - sw * 1.5, z: flip(sw) },
      { x: 0, z: flip(sw) }
    ], w + 0.1);
  }

  /**
   * Initialize the registry with built-in fonts
   */
  async initialize(buildersDir?: string): Promise<void> {
    if (this.initialized) return;

    // Register built-in simple glyphs
    this.registerBuiltinGlyphs();

    // Try to load custom letters from builders/letters/ if available
    if (buildersDir) {
      const lettersDir = path.join(buildersDir, 'letters');
      try {
        await this.loadLettersFromDirectory(lettersDir, 'custom');
      } catch (e) {
        // Ignore if directory doesn't exist
      }
    }

    this.initialized = true;
  }
}

// Singleton instance
export const proceduralFontRegistry = new ProceduralFontRegistry();

/**
 * Get text outlines using procedural fonts
 */
export function getProceduralTextOutlines(
  fontName: string,
  text: string,
  size: number = 1.0,
  spacing: number = 0.0
): ProceduralGlyph[] {
  const font = proceduralFontRegistry.getFont(fontName);
  if (!font) {
    throw new Error(`Procedural font not loaded: ${fontName}. Available: ${proceduralFontRegistry.getFontNames().join(', ')}`);
  }

  const outlines: ProceduralGlyph[] = [];
  let currentX = 0;

  for (const char of text.toUpperCase()) {
    const glyph = font.glyphs.get(char);
    if (!glyph) {
      // Skip unknown characters, just add spacing
      currentX += size * 0.3;
      continue;
    }

    // Clone and scale the glyph
    const scaledGlyph: ProceduralGlyph = {
      char: glyph.char,
      width: glyph.width * size,
      height: glyph.height * size,
      contours: glyph.contours.map(c => ({
        points: c.points.map(p => ({
          x: p.x * size + currentX,
          z: p.z * size
        })),
        isHole: c.isHole
      })),
      bounds: {
        xMin: glyph.bounds.xMin * size + currentX,
        xMax: glyph.bounds.xMax * size + currentX,
        zMin: glyph.bounds.zMin * size,
        zMax: glyph.bounds.zMax * size
      }
    };

    outlines.push(scaledGlyph);
    currentX += glyph.width * size + spacing;
  }

  return outlines;
}
