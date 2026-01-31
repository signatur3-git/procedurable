/**
 * Test glyph hole detection with actual font
 * Run with: npx tsx src/tests/test-glyph-holes.ts
 */

import { FontParser } from '../generation/text/FontParser';
import * as path from 'path';

async function testGlyphHoles() {
  const parser = new FontParser();

  // Try to load Roboto font if it exists
  const fontPath = path.resolve(process.cwd(), 'assets/fonts/Roboto-Regular.ttf');

  try {
    await parser.loadFont('Roboto', fontPath);
    console.log('✓ Loaded Roboto font');
  } catch (error) {
    console.error('✗ Could not load font:', error);
    process.exit(1);
  }

  // Test letters with holes
  const lettersWithHoles = ['A', 'B', 'D', 'O', 'P', 'Q', 'R', 'a', 'b', 'd', 'e', 'o', 'p', 'q'];

  console.log('\nTesting hole detection:\n');

  for (const char of lettersWithHoles) {
    try {
      const outline = parser.getGlyphOutline('Roboto', char, 1.0);
      const holeCount = outline.contours.filter(c => c.isHole).length;
      const outerCount = outline.contours.filter(c => !c.isHole).length;

      console.log(`${char}: ${outline.contours.length} contours (${outerCount} outer, ${holeCount} holes)`);

      // Show winding direction for first few points of each contour
      outline.contours.forEach((contour, i) => {
        const pts = contour.points.slice(0, 4);
        const dir = contour.isHole ? 'HOLE' : 'OUTER';
        console.log(`  Contour ${i} [${dir}]: ${pts.length} total points, first 4: ${
          pts.map(p => `(${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).join(', ')
        }`);
      });
    } catch (error) {
      console.error(`✗ Error processing '${char}':`, error);
    }
  }

  // Test specific case: letter 'O' should have 2 contours (outer + hole)
  console.log('\n\nDetailed test for letter "O":');
  const O = parser.getGlyphOutline('Roboto', 'O', 1.0);
  console.log(`Total contours: ${O.contours.length}`);
  console.log(`Expected: 2 (1 outer + 1 hole)`);

  if (O.contours.length === 2) {
    const outer = O.contours.find(c => !c.isHole);
    const hole = O.contours.find(c => c.isHole);

    if (outer && hole) {
      console.log('✓ Correctly identified outer and hole contours');
    } else {
      console.log('✗ PROBLEM: Both contours marked as same type');
      console.log(`  Contour 0: ${O.contours[0].isHole ? 'HOLE' : 'OUTER'}`);
      console.log(`  Contour 1: ${O.contours[1].isHole ? 'HOLE' : 'OUTER'}`);
    }
  } else {
    console.log(`✗ PROBLEM: Expected 2 contours, got ${O.contours.length}`);
  }
}

testGlyphHoles().catch(console.error);
