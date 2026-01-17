import { fontParser, GlyphContour } from './FontParser';

/**
 * Text shape for use in YAML builders
 */
export interface TextShape {
  content: string;
  font: string;
  size: number;
  spacing?: number;
  center?: { x: number; z: number };
  contours: GlyphContour[];
  bounds: {
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
  };
  width: number;
  height: number;
}

/**
 * Convert text string to 2D shape
 */
export function textToShape(
  content: string,
  font: string,
  size: number = 1.0,
  spacing: number = 0.0,
  center?: { x: number; z: number }
): TextShape {
  // Get outlines for all glyphs
  const outlines = fontParser.getTextOutlines(font, content, size, spacing);

  if (outlines.length === 0) {
    throw new Error(`No glyphs generated for text: "${content}"`);
  }

  // Collect all contours from all glyphs
  const allContours: GlyphContour[] = [];
  for (const outline of outlines) {
    allContours.push(...outline.contours);
  }

  // Calculate overall bounds
  let xMin = Infinity;
  let xMax = -Infinity;
  let zMin = Infinity;
  let zMax = -Infinity;

  for (const contour of allContours) {
    for (const point of contour.points) {
      xMin = Math.min(xMin, point.x);
      xMax = Math.max(xMax, point.x);
      zMin = Math.min(zMin, point.z);
      zMax = Math.max(zMax, point.z);
    }
  }

  const bounds = { xMin, xMax, zMin, zMax };
  const width = xMax - xMin;
  const height = zMax - zMin;

  // Apply centering if requested
  if (center) {
    const offsetX = center.x - (xMin + width / 2);
    const offsetZ = center.z - (zMin + height / 2);

    for (const contour of allContours) {
      for (const point of contour.points) {
        point.x += offsetX;
        point.z += offsetZ;
      }
    }

    // Update bounds
    bounds.xMin += offsetX;
    bounds.xMax += offsetX;
    bounds.zMin += offsetZ;
    bounds.zMax += offsetZ;
  }

  return {
    content,
    font,
    size,
    spacing,
    center,
    contours: allContours,
    bounds,
    width,
    height
  };
}

/**
 * Convert single character to 2D shape
 */
export function charToShape(
  char: string,
  font: string,
  size: number = 1.0,
  center?: { x: number; z: number }
): TextShape {
  if (char.length !== 1) {
    throw new Error(`charToShape expects single character, got: "${char}"`);
  }

  return textToShape(char, font, size, 0, center);
}

/**
 * Get text dimensions without generating full shape
 */
export function measureText(
  content: string,
  font: string,
  size: number = 1.0,
  spacing: number = 0.0
): { width: number; height: number; bounds: { xMin: number; xMax: number; zMin: number; zMax: number } } {
  const outlines = fontParser.getTextOutlines(font, content, size, spacing);

  if (outlines.length === 0) {
    return { width: 0, height: 0, bounds: { xMin: 0, xMax: 0, zMin: 0, zMax: 0 } };
  }

  // Calculate bounds from outlines
  let xMin = Infinity;
  let xMax = -Infinity;
  let zMin = Infinity;
  let zMax = -Infinity;

  for (const outline of outlines) {
    xMin = Math.min(xMin, outline.bounds.xMin);
    xMax = Math.max(xMax, outline.bounds.xMax);
    zMin = Math.min(zMin, outline.bounds.zMin);
    zMax = Math.max(zMax, outline.bounds.zMax);
  }

  return {
    width: xMax - xMin,
    height: zMax - zMin,
    bounds: { xMin, xMax, zMin, zMax }
  };
}
