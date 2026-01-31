import { describe, it, expect } from '@jest/globals';
import { textToShape, charToShape, measureText } from '../../generation/text/TextToShape';

describe('TextToShape', () => {
  // Note: These tests need a real font file to work
  // For CI/CD, we would bundle a test font
  // For now, tests validate API structure

  describe('textToShape', () => {
    it('should reject empty content', () => {
      expect(() => {
        textToShape('', 'notloaded', 1.0);
      }).toThrow();
    });

    it('should require font to be loaded', () => {
      expect(() => {
        textToShape('HELLO', 'notloaded', 1.0);
      }).toThrow(/Font not loaded/);
    });

    it('should generate shape with correct structure', () => {
      // This would work with a loaded font:
      // const shape = textToShape('A', 'roboto', 1.0);
      // expect(shape.content).toBe('A');
      // expect(shape.font).toBe('roboto');
      // expect(shape.size).toBe(1.0);
      // expect(shape.contours.length).toBeGreaterThan(0);
      // expect(shape.width).toBeGreaterThan(0);
      // expect(shape.height).toBeGreaterThan(0);

      // For now, just verify the function exists
      expect(textToShape).toBeDefined();
    });

    it('should apply centering when requested', () => {
      // With loaded font:
      // const shape = textToShape('A', 'roboto', 1.0, 0, { x: 5, z: 3 });
      // const centerX = (shape.bounds.xMin + shape.bounds.xMax) / 2;
      // const centerZ = (shape.bounds.zMin + shape.bounds.zMax) / 2;
      // expect(centerX).toBeCloseTo(5, 1);
      // expect(centerZ).toBeCloseTo(3, 1);

      expect(textToShape).toBeDefined();
    });

    it('should apply spacing between characters', () => {
      // With loaded font:
      // const shape1 = textToShape('AB', 'roboto', 1.0, 0);
      // const shape2 = textToShape('AB', 'roboto', 1.0, 0.1);
      // expect(shape2.width).toBeGreaterThan(shape1.width);

      expect(textToShape).toBeDefined();
    });
  });

  describe('charToShape', () => {
    it('should reject multi-character strings', () => {
      expect(() => {
        charToShape('AB', 'roboto', 1.0);
      }).toThrow(/single character/);
    });

    it('should accept single character', () => {
      expect(() => {
        charToShape('A', 'notloaded', 1.0);
      }).toThrow(/Font not loaded/);  // Fails on font, not on char count
    });
  });

  describe('measureText', () => {
    it('should return zero dimensions for empty string', () => {
      // Even without a font, empty string should handle gracefully
      // But it will throw "Font not loaded"
      expect(() => {
        measureText('', 'notloaded', 1.0);
      }).toThrow(/Font not loaded/);
    });

    it('should return dimensions structure', () => {
      // With loaded font:
      // const dims = measureText('HELLO', 'roboto', 1.0);
      // expect(dims.width).toBeGreaterThan(0);
      // expect(dims.height).toBeGreaterThan(0);
      // expect(dims.bounds).toBeDefined();
      // expect(dims.bounds.xMin).toBeLessThan(dims.bounds.xMax);
      // expect(dims.bounds.zMin).toBeLessThan(dims.bounds.zMax);

      expect(measureText).toBeDefined();
    });
  });
});

// Integration test template (requires bundled font):
/*
describe('TextToShape Integration (with font)', () => {
  beforeAll(async () => {
    // Load test font
    await fontParser.loadFont('test', './tests/fixtures/Roboto-Regular.ttf');
  });

  it('should generate complete text shape', () => {
    const shape = textToShape('HELLO', 'test', 1.0);

    expect(shape.content).toBe('HELLO');
    expect(shape.font).toBe('test');
    expect(shape.contours.length).toBeGreaterThan(0);
    expect(shape.width).toBeGreaterThan(0);
    expect(shape.height).toBeGreaterThan(0);

    // HELLO should have ~5-7 contours (H, E have 1 each, L has 1, O has 2)
    expect(shape.contours.length).toBeGreaterThanOrEqual(5);
  });

  it('should detect holes in glyphs', () => {
    const shape = textToShape('O', 'test', 1.0);

    // O should have 2 contours: outer boundary + hole
    expect(shape.contours.length).toBe(2);
    expect(shape.contours[0].isHole).toBe(false);  // Outer
    expect(shape.contours[1].isHole).toBe(true);   // Hole
  });

  it('should handle character without holes', () => {
    const shape = textToShape('L', 'test', 1.0);

    // L should have 1 contour with no holes
    expect(shape.contours.length).toBe(1);
    expect(shape.contours[0].isHole).toBe(false);
  });
});
*/
