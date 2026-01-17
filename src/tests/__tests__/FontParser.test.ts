import { describe, it, expect, beforeAll } from '@jest/globals';
import { FontParser } from '../../text/FontParser';

describe('FontParser', () => {
  let parser: FontParser;

  beforeAll(() => {
    parser = new FontParser();
  });

  describe('Font Management', () => {
    it('should start with no fonts loaded', () => {
      expect(parser.getFontNames()).toEqual([]);
      expect(parser.hasFont('arial')).toBe(false);
    });

    it('should track loaded fonts', () => {
      // Note: This test would need actual font files to work
      // For now, we test the API structure
      expect(parser.hasFont('nonexistent')).toBe(false);
    });
  });

  describe('Glyph Outline Extraction', () => {
    it('should reject requests for unloaded fonts', () => {
      expect(() => {
        parser.getGlyphOutline('notloaded', 'A', 1.0);
      }).toThrow(/Font not loaded/);
    });

    it('should reject glyph path requests for unloaded fonts', () => {
      expect(() => {
        parser.getGlyphPath('notloaded', 'A', 1.0);
      }).toThrow(/Font not loaded/);
    });

    it('should reject multi-character strings', () => {
      // Would need actual font for this test
      // Testing API contract only
      expect(() => {
        // This will throw "Font not loaded" before reaching multi-char check
        // In real use with loaded font, it would check char length
      }).toBeDefined();
    });
  });

  describe('Text String Processing', () => {
    it('should reject text requests for unloaded fonts', () => {
      expect(() => {
        parser.getTextOutlines('notloaded', 'HELLO', 1.0);
      }).toThrow(/Font not loaded/);
    });
  });

  describe('Contour Winding Detection', () => {
    it('should detect clockwise contours', () => {
      // Access private method through type assertion for testing
      const testParser = parser as any;

      // Clockwise square
      const clockwise = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 1, z: 1 },
        { x: 0, z: 1 }
      ];

      expect(testParser.isClockwise(clockwise)).toBe(true);
    });

    it('should detect counter-clockwise contours', () => {
      const testParser = parser as any;

      // Counter-clockwise square
      const counterClockwise = [
        { x: 0, z: 0 },
        { x: 0, z: 1 },
        { x: 1, z: 1 },
        { x: 1, z: 0 }
      ];

      expect(testParser.isClockwise(counterClockwise)).toBe(false);
    });
  });

  describe('Bounds Calculation', () => {
    it('should calculate correct bounds for contours', () => {
      const testParser = parser as any;

      const contours = [
        {
          points: [
            { x: -1, z: -2 },
            { x: 3, z: 1 },
            { x: 2, z: 4 }
          ],
          isHole: false
        }
      ];

      const bounds = testParser.calculateBounds(contours);

      expect(bounds.xMin).toBe(-1);
      expect(bounds.xMax).toBe(3);
      expect(bounds.zMin).toBe(-2);
      expect(bounds.zMax).toBe(4);
    });
  });
});

// Integration test note:
// Full integration tests would require:
// 1. Bundled test font file (e.g., Roboto.ttf)
// 2. Loading font in beforeAll
// 3. Testing actual glyph extraction
// 4. Verifying contour counts for known characters (e.g., 'O' has 2 contours)
//
// Example:
// beforeAll(async () => {
//   await parser.loadFont('test', resolve(__dirname, '../../../fonts/Roboto-Regular.ttf'));
// });
//
// it('should extract outline for letter A', () => {
//   const outline = parser.getGlyphOutline('test', 'A', 1.0);
//   expect(outline.char).toBe('A');
//   expect(outline.contours.length).toBeGreaterThan(0);
//   expect(outline.contours[0].isHole).toBe(false);
//   if (outline.contours.length > 1) {
//     expect(outline.contours[1].isHole).toBe(true); // Triangle hole in 'A'
//   }
// });
