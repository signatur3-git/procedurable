/**
 * SceneBuilder - Composes multiple builders into a scene
 *
 * Demonstrates composition at the scene level:
 * - Places a table in the center
 * - Surrounds it with chairs
 * - Decisions control arrangement
 */

import { TracedBuilder, TracedOutput } from './TracedBuilder';
import { buildDiningChair } from './ChairBuilder';
import { buildTable } from './TableBuilder';

/**
 * Wrapper to adapt buildDiningChair to the compose() signature
 */
function buildChair(seed: number, overrides?: Record<string, any>): TracedOutput {
  return buildDiningChair({ seed, overrides });
}

/**
 * Build a dining scene with table and chairs
 */
export function buildDiningScene(seed: number, overrides?: Record<string, any>): TracedOutput {
  const builder = new TracedBuilder('DiningScene', seed, overrides);

  // ==========================================================================
  // DECISIONS
  // ==========================================================================

  const chairCount = builder.decideCount('chair_count', 2, 6);
  const tableStyle = builder.decide('table_style', ['rectangular', 'round'], [0.7, 0.3]);
  const arrangement = builder.decide('arrangement', ['around', 'pairs'], [0.7, 0.3]);

  // Chair style decisions - made ONCE at scene level for consistency
  // All chairs in the scene will look the same (realistic dining set)
  const chairBackStyle = builder.decide('chair_back_style', ['solid', 'slat', 'ladder'], [0.4, 0.35, 0.25]);
  const chairLegStyle = builder.decide('chair_leg_style', ['round', 'square', 'tapered'], [0.4, 0.3, 0.3]);
  const chairSeatShape = builder.decide('chair_seat_shape', ['square', 'rounded', 'contoured'], [0.3, 0.4, 0.3]);
  const chairHasStretchers = builder.decide('chair_has_stretchers', [true, false], [0.4, 0.6]);

  // Additional style decisions for truly identical chairs
  const chairLegTaper = builder.decideNumber('chair_leg_taper', 0.7, 0.9);
  const chairBackRecline = builder.decideNumber('chair_back_recline', 3.0, 7.0);
  const chairSeatCurve = builder.decideNumber('chair_seat_curve', 0.005, 0.015);
  const chairSlatCount = builder.decideCount('chair_slat_count', 3, 5);

  // ==========================================================================
  // MEASUREMENTS
  // ==========================================================================

  // Table dimensions (will be passed to TableBuilder)
  const tableWidth = 1.2 + builder.decideNumber('table_width_var', -0.2, 0.3);
  const tableDepth = 0.8 + builder.decideNumber('table_depth_var', -0.1, 0.2);

  builder.defineMeasurement('table_width', tableWidth);
  builder.defineMeasurement('table_depth', tableDepth);
  builder.defineMeasurement('chair_count', chairCount);

  // Chair dimensions for spacing calculations
  const chairWidth = 0.50;  // Approximate chair width (increased for safety)
  const chairDepth = 0.50;  // Approximate chair depth (increased for safety)
  const minChairGap = 0.20; // Minimum gap between chairs (increased)

  // Chair spacing from table edge
  const chairSpacing = 0.20; // Increased spacing from table

  // Common chair overrides for all chairs (ensures TRULY identical chairs)
  const chairOverrides = {
    // Style decisions
    back_style: chairBackStyle,
    leg_style: chairLegStyle,
    seat_shape: chairSeatShape,
    has_stretchers: chairHasStretchers,
    // Detail decisions
    leg_taper: chairLegTaper,
    back_recline: chairBackRecline,
    seat_curve: chairSeatCurve,
    slat_count: chairSlatCount,
    ladder_rung_count: chairSlatCount, // Use same count for ladder rungs
    spindle_count: chairSlatCount + 2, // Spindles typically have more
    // Measurement variations (all zero for identical chairs)
    width_variation: 0,
    depth_variation: 0,
    back_height_variation: 0,
    stretcher_height: 0.1, // Fixed stretcher height
  };

  // ==========================================================================
  // TABLE (centered at origin)
  // ==========================================================================

  builder.compose('table', buildTable, {
    offset: { x: 0, y: 0, z: 0 },
    overrides: {
      table_style: tableStyle,
      table_width: tableWidth,
      table_depth: tableDepth
    }
  });

  // ==========================================================================
  // CHAIRS
  // ==========================================================================

  if (arrangement === 'around') {
    // Distribute chairs evenly around the table
    if (tableStyle === 'round') {
      // Circular arrangement for round tables
      const tableRadius = tableWidth / 2;
      const chairRadius = tableRadius + chairDepth / 2 + chairSpacing;

      // Calculate minimum angle between chairs to avoid overlap
      const minAngle = 2 * Math.asin((chairWidth + minChairGap) / (2 * chairRadius));
      const maxChairs = Math.floor((Math.PI * 2) / minAngle);
      const actualChairs = Math.min(chairCount, maxChairs);

      for (let i = 0; i < actualChairs; i++) {
        const angle = (i / actualChairs) * Math.PI * 2;
        const x = Math.cos(angle) * chairRadius;
        const z = Math.sin(angle) * chairRadius;
        // Chair faces inward (toward table center)
        // Chair front is at +Z by default
        // Y rotation is CLOCKWISE when viewed from above
        // To rotate +Z to point toward center from position at angle θ:
        // rotation = 3π/2 - θ (or equivalently -π/2 - θ)
        const rotation = -Math.PI / 2 - angle;

        builder.compose(`chair_${i + 1}`, buildChair, {
          offset: { x, y: 0, z },
          rotation: { x: 0, y: rotation, z: 0 },
          overrides: chairOverrides
        });
      }
    } else {
      // Rectangular arrangement - chairs on long sides, overflow to short sides
      const halfDepth = tableDepth / 2 + chairDepth / 2 + chairSpacing;
      const halfWidth = tableWidth / 2 + chairDepth / 2 + chairSpacing;

      // Calculate how many chairs fit per long side with proper spacing
      // Each chair needs chairWidth + minChairGap of space (except the last one)
      const availableWidth = tableWidth;
      const chairSlotWidth = chairWidth + minChairGap;
      const maxChairsPerLongSide = Math.max(1, Math.floor((availableWidth + minChairGap) / chairSlotWidth));

      // Distribute chairs: prioritize long sides evenly, then short sides
      // Cap each side to what actually fits
      const totalLongSideCapacity = maxChairsPerLongSide * 2;
      const longSideChairs = Math.min(chairCount, totalLongSideCapacity);
      const frontChairs = Math.min(Math.ceil(longSideChairs / 2), maxChairsPerLongSide);
      const backChairs = Math.min(longSideChairs - frontChairs, maxChairsPerLongSide);

      // Remaining chairs go to short sides (head-of-table positions)
      const placedOnLongSides = frontChairs + backChairs;
      const remainingChairs = chairCount - placedOnLongSides;
      const leftChairs = remainingChairs > 0 ? 1 : 0;
      const rightChairs = remainingChairs > 1 ? 1 : 0;

      let chairIndex = 1;

      // Front side (positive Z)
      if (frontChairs > 0) {
        // Calculate actual spacing needed for the chairs we're placing
        const totalChairWidth = frontChairs * chairWidth;
        const totalGapWidth = (frontChairs - 1) * minChairGap;
        const usedWidth = totalChairWidth + totalGapWidth;
        const spacing = frontChairs > 1 ? (usedWidth - chairWidth) / (frontChairs - 1) : 0;
        const startX = frontChairs > 1 ? -usedWidth / 2 + chairWidth / 2 : 0;

        for (let i = 0; i < frontChairs; i++) {
          const x = startX + spacing * i;

          builder.compose(`chair_${chairIndex}`, buildChair, {
            offset: { x, y: 0, z: halfDepth },
            rotation: { x: 0, y: Math.PI, z: 0 },
            overrides: chairOverrides
          });
          chairIndex++;
        }
      }

      // Back side (negative Z)
      if (backChairs > 0) {
        const totalChairWidth = backChairs * chairWidth;
        const totalGapWidth = (backChairs - 1) * minChairGap;
        const usedWidth = totalChairWidth + totalGapWidth;
        const spacing = backChairs > 1 ? (usedWidth - chairWidth) / (backChairs - 1) : 0;
        const startX = backChairs > 1 ? -usedWidth / 2 + chairWidth / 2 : 0;

        for (let i = 0; i < backChairs; i++) {
          const x = startX + spacing * i;

          builder.compose(`chair_${chairIndex}`, buildChair, {
            offset: { x, y: 0, z: -halfDepth },
            rotation: { x: 0, y: 0, z: 0 },
            overrides: chairOverrides
          });
          chairIndex++;
        }
      }

      // Left side (negative X) - chair faces right
      if (leftChairs > 0) {
        builder.compose(`chair_${chairIndex}`, buildChair, {
          offset: { x: -halfWidth, y: 0, z: 0 },
          rotation: { x: 0, y: Math.PI / 2, z: 0 },
          overrides: chairOverrides
        });
        chairIndex++;
      }

      // Right side (positive X) - chair faces left
      if (rightChairs > 0) {
        builder.compose(`chair_${chairIndex}`, buildChair, {
          offset: { x: halfWidth, y: 0, z: 0 },
          rotation: { x: 0, y: -Math.PI / 2, z: 0 },
          overrides: chairOverrides
        });
        chairIndex++;
      }
    }
  } else {
    // Pairs arrangement - chairs facing each other across table
    const halfDepth = tableDepth / 2 + chairDepth / 2 + chairSpacing;
    const pairsCount = Math.ceil(chairCount / 2);

    // Calculate spacing between pairs
    const availableWidth = tableWidth - chairWidth;
    const spacing = pairsCount > 1 ? availableWidth / (pairsCount - 1) : 0;
    const startX = pairsCount > 1 ? -availableWidth / 2 : 0;

    for (let i = 0; i < pairsCount; i++) {
      const x = startX + spacing * i;

      // Front chair
      builder.compose(`chair_${i * 2 + 1}`, buildChair, {
        offset: { x, y: 0, z: halfDepth },
        rotation: { x: 0, y: Math.PI, z: 0 },
        overrides: chairOverrides
      });

      // Back chair (if we have enough)
      if (i * 2 + 2 <= chairCount) {
        builder.compose(`chair_${i * 2 + 2}`, buildChair, {
          offset: { x, y: 0, z: -halfDepth },
          rotation: { x: 0, y: 0, z: 0 },
          overrides: chairOverrides
        });
      }
    }
  }

  return builder.build();
}

// ============================================================================
// TEST
// ============================================================================

export function testDiningScene() {
  console.log('Testing DiningScene...\n');

  for (const seed of [1, 42, 100]) {
    const result = buildDiningScene(seed);

    console.log(`Seed ${seed}:`);
    console.log(`  Chairs: ${result.decisions.get('chair_count')?.value}`);
    console.log(`  Chair Style: ${result.decisions.get('chair_back_style')?.value} back, ${result.decisions.get('chair_leg_style')?.value} legs`);
    console.log(`  Table Style: ${result.decisions.get('table_style')?.value}`);
    console.log(`  Arrangement: ${result.decisions.get('arrangement')?.value}`);
    console.log(`  Vertices: ${result.validation.vertexCount}, Faces: ${result.validation.faceCount}`);
    console.log(`  Sub-builders: ${result.subBuilders.size}`);
    console.log(`  Bounds: ${result.validation.bounds.size.x.toFixed(2)}m x ${result.validation.bounds.size.z.toFixed(2)}m`);
    console.log('');
  }
}

