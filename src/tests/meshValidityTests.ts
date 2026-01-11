/**
 * Mesh validity tests
 *
 * Fast sanity checks that catch:
 * - invalid indices
 * - NaNs/Infs
 * - degenerate triangles (warning)
 */

import { checkMeshValidity } from '../validation/MeshChecks';
import { createRod, createBox, createPanel } from '../cad/SafePrimitives';
import { buildConnectedChair, buildTree } from '../cad/MeshModeler';

export function runMeshValidityTests(): void {
  console.log('=======================================================');
  console.log('MESH VALIDITY TESTS');
  console.log('=======================================================');

  const cases = [
    { name: 'SafePrimitives.createRod', mesh: createRod(0.05, 0.5, 12) },
    { name: 'SafePrimitives.createBox', mesh: createBox(0.3, 0.2, 0.1) },
    { name: 'SafePrimitives.createPanel(bevel)', mesh: createPanel(0.4, 0.3, 0.03, 0.005) },
    { name: 'MeshModeler.buildConnectedChair', mesh: buildConnectedChair(0.45, 0.4, 0.03, 0.45, 0.02, 0.03, 0.4, 0.02) },
    { name: 'MeshModeler.buildTree', mesh: buildTree(0.05, 0.6, 1, 42) }
  ];

  let pass = 0;
  let fail = 0;

  for (const c of cases) {
    const r = checkMeshValidity(c.mesh);
    if (r.ok) {
      console.log(`PASS: ${c.name}`);
      if (r.warnings.length) {
        console.log(`  warnings: ${r.warnings.length} (showing up to 3)`);
        r.warnings.slice(0, 3).forEach((w: string) => console.log(`   - ${w}`));
      }
      pass++;
    } else {
      console.log(`FAIL: ${c.name}`);
      r.errors.forEach((e: string) => console.log(`   - ${e}`));
      fail++;
    }
  }

  console.log('');
  console.log(`RESULTS: ${pass} passed, ${fail} failed`);
  console.log('=======================================================');
}

