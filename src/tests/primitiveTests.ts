/**
 * Primitive Validation Tests
 *
 * Run these to verify primitives produce expected bounds.
 * This is the foundation - if these fail, nothing else will work.
 */

import { createTaperedRod, createPanel, createProfile } from '../cad/primitives';

interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const results: TestResult[] = [];
const TOLERANCE = 0.001;

function assertBounds(
  name: string,
  mesh: { vertices: Array<{ position: { x: number; y: number; z: number } }> },
  expected: { minY: number; maxY: number; minX?: number; maxX?: number }
): void {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const v of mesh.vertices) {
    minX = Math.min(minX, v.position.x);
    maxX = Math.max(maxX, v.position.x);
    minY = Math.min(minY, v.position.y);
    maxY = Math.max(maxY, v.position.y);
    minZ = Math.min(minZ, v.position.z);
    maxZ = Math.max(maxZ, v.position.z);
  }

  const yOk = Math.abs(minY - expected.minY) < TOLERANCE &&
              Math.abs(maxY - expected.maxY) < TOLERANCE;

  const xOk = expected.minX === undefined ||
              (Math.abs(minX - expected.minX) < TOLERANCE &&
               Math.abs(maxX - expected.maxX!) < TOLERANCE);

  const passed = yOk && xOk;

  results.push({
    name,
    passed,
    expected: `Y: [${expected.minY}, ${expected.maxY}]`,
    actual: `Y: [${minY.toFixed(4)}, ${maxY.toFixed(4)}]`
  });
}

export function runPrimitiveTests(): void {
  console.log('═══════════════════════════════════════════════════════');
  console.log('PRIMITIVE VALIDATION TESTS');
  console.log('═══════════════════════════════════════════════════════');

  // Test 1: createTaperedRod with circle profile
  try {
    const rod1 = createTaperedRod(0.02, 0.02, 0.5, 12, 'circle');
    assertBounds('TaperedRod(circle, h=0.5)', rod1, { minY: 0, maxY: 0.5 });
  } catch (e) {
    results.push({ name: 'TaperedRod(circle)', passed: false, expected: 'no error', actual: String(e) });
  }

  // Test 2: createTaperedRod with rounded-square profile
  try {
    const rod2 = createTaperedRod(0.015, 0.0135, 0.5, 8, 'rounded-square');
    assertBounds('TaperedRod(rounded-square, h=0.5)', rod2, { minY: 0, maxY: 0.5 });
  } catch (e) {
    results.push({ name: 'TaperedRod(rounded-square)', passed: false, expected: 'no error', actual: String(e) });
  }

  // Test 3: createPanel non-beveled
  try {
    const panel1 = createPanel(0.4, 0.3, 0.03, 0);
    assertBounds('Panel(non-beveled, t=0.03)', panel1, { minY: 0, maxY: 0.03 });
  } catch (e) {
    results.push({ name: 'Panel(non-beveled)', passed: false, expected: 'no error', actual: String(e) });
  }

  // Test 4: createPanel beveled (THIS IS THE KNOWN BUG)
  try {
    const panel2 = createPanel(0.336, 0.02, 0.015, 0.002);
    assertBounds('Panel(beveled, t=0.015)', panel2, { minY: 0, maxY: 0.015 });
  } catch (e) {
    results.push({ name: 'Panel(beveled)', passed: false, expected: 'no error', actual: String(e) });
  }

  // Test 5: Profile should be at Y=0
  try {
    const profile = createProfile('rounded-square', 0.03, 8);
    let minY = Infinity, maxY = -Infinity;
    for (const v of profile.vertices) {
      minY = Math.min(minY, v.position.y);
      maxY = Math.max(maxY, v.position.y);
    }
    const passed = Math.abs(minY) < TOLERANCE && Math.abs(maxY) < TOLERANCE;
    results.push({
      name: 'Profile(rounded-square) Y=0',
      passed,
      expected: 'Y: [0, 0]',
      actual: `Y: [${minY.toFixed(4)}, ${maxY.toFixed(4)}]`
    });
  } catch (e) {
    results.push({ name: 'Profile Y=0', passed: false, expected: 'no error', actual: String(e) });
  }

  // Test 6: Rod normals should point outward (positive dot product with radial direction)
  try {
    const rod = createTaperedRod(0.1, 0.1, 0.5, 12, 'circle');
    let outwardCount = 0;
    let inwardCount = 0;

    for (const v of rod.vertices) {
      if (v.attributes.normal) {
        // For side vertices (not caps), the normal should point away from Y axis
        // Radial direction from center is (x, 0, z) normalized
        const radialLen = Math.sqrt(v.position.x * v.position.x + v.position.z * v.position.z);
        if (radialLen > 0.01) { // Skip cap vertices near center
          const radialDir = { x: v.position.x / radialLen, z: v.position.z / radialLen };
          const dotProduct = v.attributes.normal.x * radialDir.x + v.attributes.normal.z * radialDir.z;
          if (dotProduct > 0) outwardCount++;
          else inwardCount++;
        }
      }
    }

    const passed = outwardCount > inwardCount;
    results.push({
      name: 'Rod normals point outward',
      passed,
      expected: 'outward > inward',
      actual: `outward=${outwardCount}, inward=${inwardCount}`
    });
  } catch (e) {
    results.push({ name: 'Rod normals', passed: false, expected: 'no error', actual: String(e) });
  }

  // Print results
  console.log('');
  let passCount = 0;
  let failCount = 0;

  for (const r of results) {
    if (r.passed) {
      console.log(`✅ PASS: ${r.name}`);
      passCount++;
    } else {
      console.log(`❌ FAIL: ${r.name}`);
      console.log(`   Expected: ${r.expected}`);
      console.log(`   Actual:   ${r.actual}`);
      failCount++;
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`RESULTS: ${passCount} passed, ${failCount} failed`);
  console.log('═══════════════════════════════════════════════════════');

  if (failCount > 0) {
    console.log('');
    console.log('⚠️  FIX THESE PRIMITIVE ISSUES BEFORE PROCEEDING');
    console.log('    The foundation must be solid before building on it.');
  }
}

