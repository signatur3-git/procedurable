/**
 * ChairBuilder - Procedural chair generation with seeded randomness
 *
 * This demonstrates "virtual artist" decision-making:
 * - Same seed → identical chair
 * - Different seed → different design choices
 * - All decisions traceable and overridable
 *
 * Decisions include: leg style, back style, proportions, details
 */

import { TracedBuilder, TracedOutput } from './TracedBuilder';

// ============================================================================
// TYPES
// ============================================================================

export type LegStyle = 'round' | 'square' | 'tapered' | 'turned';
export type BackStyle = 'solid' | 'slat' | 'ladder' | 'spindle';
export type SeatShape = 'square' | 'rounded' | 'contoured';

export interface ChairOptions {
  seed?: number;
  // Explicit overrides for any decision
  overrides?: Record<string, any>;
  // Measurement overrides (take precedence)
  measurements?: Partial<ChairMeasurements>;
}

export interface ChairMeasurements {
  seat_width: number;
  seat_depth: number;
  seat_height: number;
  seat_thickness: number;
  leg_radius: number;
  leg_inset: number;
  back_height: number;
  back_thickness: number;
  back_angle: number;
}

// ============================================================================
// MAIN BUILDER
// ============================================================================

/**
 * Build a dining chair with procedural variety
 *
 * Same seed → identical output
 * Different seed → different design decisions
 */
export function buildDiningChair(options?: ChairOptions): TracedOutput {
  const seed = options?.seed;
  const overrides = options?.overrides ?? {};
  const measurements = options?.measurements ?? {};

  const builder = new TracedBuilder('DiningChair', seed, overrides);

  // ==========================================================================
  // DESIGN DECISIONS (Virtual Artist Choices)
  // ==========================================================================

  // Style decisions - these drive the overall look
  const legStyle = builder.decide<LegStyle>('leg_style',
    ['round', 'square', 'tapered', 'turned'],
    [0.4, 0.2, 0.3, 0.1]  // Weights: round most common, turned rare
  );

  const backStyle = builder.decide<BackStyle>('back_style',
    ['solid', 'slat', 'ladder', 'spindle'],
    [0.3, 0.3, 0.25, 0.15]
  );

  // Seat shape decision (for future geometry variations)
  void builder.decide<SeatShape>('seat_shape',
    ['square', 'rounded', 'contoured'],
    [0.5, 0.35, 0.15]
  );

  // Proportion decisions - add subtle variety within style
  const legTaper = builder.decideNumber('leg_taper', 0.6, 1.0);  // Top radius as fraction of bottom
  const backRecline = builder.decideNumber('back_recline', 3, 8);  // degrees
  void builder.decideNumber('seat_curve', 0, 0.02);  // Slight curve in seat (for future geometry)

  // Detail decisions
  const hasStretchers = builder.decideBoolean('has_stretchers', 0.6);  // 60% chance
  const stretcherHeight = builder.decideNumber('stretcher_height', 0.08, 0.15);

  // Back detail counts (for future geometry)
  if (backStyle === 'slat') void builder.decideCount('slat_count', 3, 5);
  if (backStyle === 'ladder') void builder.decideCount('ladder_rung_count', 2, 4);
  if (backStyle === 'spindle') void builder.decideCount('spindle_count', 5, 9);

  // ==========================================================================
  // MEASUREMENTS (all traceable, with sources)
  // Explicit overrides take precedence, then decisions add variety
  // ==========================================================================

  // Base measurements from furniture standards, with slight random variation
  const baseWidth = 0.42;
  const widthVariation = builder.decideNumber('width_variation', -0.03, 0.03);
  builder.defineMeasurement('seat_width', measurements.seat_width ?? (baseWidth + widthVariation),
    { source: 'Standard dining chair width with variation' });

  const baseDepth = 0.38;
  const depthVariation = builder.decideNumber('depth_variation', -0.02, 0.02);
  builder.defineMeasurement('seat_depth', measurements.seat_depth ?? (baseDepth + depthVariation),
    { source: 'Standard dining chair depth with variation' });

  builder.defineMeasurement('seat_height', measurements.seat_height ?? 0.45,
    { source: 'Ergonomic seating height' });
  builder.defineMeasurement('seat_thickness', measurements.seat_thickness ?? 0.025,
    { source: 'Typical plywood/solid wood thickness' });

  // Leg measurements vary by style
  const baseLegRadius = legStyle === 'square' ? 0.018 : 0.02;
  builder.defineMeasurement('leg_radius', measurements.leg_radius ?? baseLegRadius,
    { source: `${legStyle} leg radius` });
  builder.defineMeasurement('leg_inset', measurements.leg_inset ?? 0.03,
    { source: 'Structural inset from edge' });
  builder.defineMeasurement('leg_segments', legStyle === 'square' ? 4 : 8);
  builder.defineMeasurement('leg_taper_ratio', legTaper,
    { source: 'Leg taper (top radius / bottom radius)' });

  // Back measurements
  const baseBackHeight = 0.35;
  const backHeightVariation = builder.decideNumber('back_height_variation', 0, 0.1);
  builder.defineMeasurement('back_height', measurements.back_height ?? (baseBackHeight + backHeightVariation),
    { source: 'Chair back height above seat with variation' });
  builder.defineMeasurement('back_thickness', measurements.back_thickness ?? 0.02,
    { source: 'Back panel/slat thickness' });
  builder.defineMeasurement('back_angle', measurements.back_angle ?? backRecline,
    { source: 'Recline angle from decision' });

  // Stretcher measurements (if applicable)
  if (hasStretchers) {
    builder.defineMeasurement('stretcher_height', stretcherHeight,
      { source: 'Stretcher height from floor' });
    builder.defineMeasurement('stretcher_radius', 0.008,
      { source: 'Stretcher rod radius' });
  }

  // ==========================================================================
  // DERIVED VALUES (calculated from measurements)
  // ==========================================================================

  builder.defineDerived('half_width', 'seat_width / 2');
  builder.defineDerived('half_depth', 'seat_depth / 2');
  builder.defineDerived('seat_top', 'seat_height + seat_thickness');
  builder.defineDerived('leg_x_outer', 'half_width - leg_inset');
  builder.defineDerived('leg_z_outer', 'half_depth - leg_inset');
  builder.defineDerived('leg_top_radius', 'leg_radius * leg_taper_ratio');

  // ==========================================================================
  // SEAT - Using explicit vertices
  // ==========================================================================

  // Bottom of seat (4 corners)
  builder.placeVertex('seat_bl_b', { x: '-half_width', y: 'seat_height', z: '-half_depth' });
  builder.placeVertex('seat_br_b', { x: 'half_width', y: 'seat_height', z: '-half_depth' });
  builder.placeVertex('seat_fr_b', { x: 'half_width', y: 'seat_height', z: 'half_depth' });
  builder.placeVertex('seat_fl_b', { x: '-half_width', y: 'seat_height', z: 'half_depth' });

  // Top of seat (4 corners)
  builder.placeVertex('seat_bl_t', { x: '-half_width', y: 'seat_top', z: '-half_depth' });
  builder.placeVertex('seat_br_t', { x: 'half_width', y: 'seat_top', z: '-half_depth' });
  builder.placeVertex('seat_fr_t', { x: 'half_width', y: 'seat_top', z: 'half_depth' });
  builder.placeVertex('seat_fl_t', { x: '-half_width', y: 'seat_top', z: 'half_depth' });

  // Seat faces
  builder.createFace('seat_bottom', ['seat_bl_b', 'seat_fl_b', 'seat_fr_b', 'seat_br_b']);
  builder.createFace('seat_top', ['seat_bl_t', 'seat_br_t', 'seat_fr_t', 'seat_fl_t']);
  builder.createFace('seat_back', ['seat_bl_b', 'seat_br_b', 'seat_br_t', 'seat_bl_t']);
  builder.createFace('seat_front', ['seat_fl_b', 'seat_fl_t', 'seat_fr_t', 'seat_fr_b']);
  builder.createFace('seat_left', ['seat_bl_b', 'seat_bl_t', 'seat_fl_t', 'seat_fl_b']);
  builder.createFace('seat_right', ['seat_br_b', 'seat_fr_b', 'seat_fr_t', 'seat_br_t']);

  // ==========================================================================
  // LEGS - Style-dependent geometry
  // ==========================================================================

  const legPositions = [
    { name: 'bl', x: '-leg_x_outer', z: '-leg_z_outer' },
    { name: 'br', x: 'leg_x_outer', z: '-leg_z_outer' },
    { name: 'fl', x: '-leg_x_outer', z: 'leg_z_outer' },
    { name: 'fr', x: 'leg_x_outer', z: 'leg_z_outer' },
  ];

  for (const leg of legPositions) {
    // Bottom loop (full radius)
    builder.createCircleLoop(`leg_${leg.name}_bottom`,
      { x: leg.x, y: '0', z: leg.z },
      'leg_radius',
      legStyle === 'square' ? 4 : 8,
      'structural'
    );

    // Top loop (tapered if applicable)
    builder.createCircleLoop(`leg_${leg.name}_top`,
      { x: leg.x, y: 'seat_height', z: leg.z },
      'leg_top_radius',
      legStyle === 'square' ? 4 : 8,
      'structural'
    );

    builder.loftLoops(`leg_${leg.name}_surface`, `leg_${leg.name}_bottom`, `leg_${leg.name}_top`);
    builder.capLoop(`leg_${leg.name}_cap`, `leg_${leg.name}_bottom`, true);
  }

  // ==========================================================================
  // BACK - Style-dependent
  // ==========================================================================

  const backAngleRad = (backRecline * Math.PI) / 180;
  const backOffset = `${Math.sin(backAngleRad).toFixed(4)} * back_height`;

  // Back frame vertices
  builder.placeVertex('back_bl_b', { x: '-half_width', y: 'seat_top', z: '-half_depth' });
  builder.placeVertex('back_br_b', { x: 'half_width', y: 'seat_top', z: '-half_depth' });
  builder.placeVertex('back_bl_t', {
    x: '-half_width',
    y: 'seat_top + back_height',
    z: `-half_depth - ${backOffset}`
  });
  builder.placeVertex('back_br_t', {
    x: 'half_width',
    y: 'seat_top + back_height',
    z: `-half_depth - ${backOffset}`
  });

  // Create back based on style
  if (backStyle === 'solid') {
    builder.createFace('back_front', ['back_bl_b', 'back_br_b', 'back_br_t', 'back_bl_t']);
  } else {
    // For slat/ladder/spindle, still create a minimal frame
    builder.createFace('back_front', ['back_bl_b', 'back_br_b', 'back_br_t', 'back_bl_t']);
    // TODO: Add slats, rungs, or spindles based on style and counts
  }

  // ==========================================================================
  // STRETCHERS - Horizontal bars connecting legs for stability
  // ==========================================================================

  if (hasStretchers) {
    // Stretchers are horizontal rods connecting the legs
    // We create 4 stretchers: front, back, left, right (forming a rectangle)
    // IMPORTANT: Both loops must have the SAME normal direction for proper face winding
    const stretcherY = `${stretcherHeight}`;
    const stretcherSegs = 6; // Fewer segments for small rods

    // Front stretcher (connects front-left to front-right legs)
    // Both loops use same normal so loft creates outward-facing faces
    builder.createCircleLoop('stretcher_front_l',
      { x: '-leg_x_outer', y: stretcherY, z: 'leg_z_outer' },
      'stretcher_radius', stretcherSegs, 'structural',
      { x: 1, y: 0, z: 0 }
    );
    builder.createCircleLoop('stretcher_front_r',
      { x: 'leg_x_outer', y: stretcherY, z: 'leg_z_outer' },
      'stretcher_radius', stretcherSegs, 'structural',
      { x: 1, y: 0, z: 0 }  // Same normal as left end
    );
    builder.loftLoops('stretcher_front', 'stretcher_front_l', 'stretcher_front_r');

    // Back stretcher (connects back-left to back-right legs)
    builder.createCircleLoop('stretcher_back_l',
      { x: '-leg_x_outer', y: stretcherY, z: '-leg_z_outer' },
      'stretcher_radius', stretcherSegs, 'structural',
      { x: 1, y: 0, z: 0 }
    );
    builder.createCircleLoop('stretcher_back_r',
      { x: 'leg_x_outer', y: stretcherY, z: '-leg_z_outer' },
      'stretcher_radius', stretcherSegs, 'structural',
      { x: 1, y: 0, z: 0 }  // Same normal as left end
    );
    builder.loftLoops('stretcher_back', 'stretcher_back_l', 'stretcher_back_r');

    // Left stretcher (connects front-left to back-left legs)
    builder.createCircleLoop('stretcher_left_f',
      { x: '-leg_x_outer', y: stretcherY, z: 'leg_z_outer' },
      'stretcher_radius', stretcherSegs, 'structural',
      { x: 0, y: 0, z: -1 }
    );
    builder.createCircleLoop('stretcher_left_b',
      { x: '-leg_x_outer', y: stretcherY, z: '-leg_z_outer' },
      'stretcher_radius', stretcherSegs, 'structural',
      { x: 0, y: 0, z: -1 }  // Same normal as front end
    );
    builder.loftLoops('stretcher_left', 'stretcher_left_f', 'stretcher_left_b');

    // Right stretcher (connects front-right to back-right legs)
    builder.createCircleLoop('stretcher_right_f',
      { x: 'leg_x_outer', y: stretcherY, z: 'leg_z_outer' },
      'stretcher_radius', stretcherSegs, 'structural',
      { x: 0, y: 0, z: -1 }
    );
    builder.createCircleLoop('stretcher_right_b',
      { x: 'leg_x_outer', y: stretcherY, z: '-leg_z_outer' },
      'stretcher_radius', stretcherSegs, 'structural',
      { x: 0, y: 0, z: -1 }  // Same normal as front end
    );
    builder.loftLoops('stretcher_right', 'stretcher_right_f', 'stretcher_right_b');
  }

  // ==========================================================================
  // BUILD
  // ==========================================================================

  return builder.build();
}

/**
 * Quick test - demonstrates variety from different seeds
 */
export function testChairBuilder(): void {
  console.log('\n=== Testing Chair Builder with Seeded Randomness ===\n');

  // Same seed → same output
  const chair1 = buildDiningChair({ seed: 42 });
  const chair2 = buildDiningChair({ seed: 42 });

  console.log('Seed 42 (run 1):', chair1.decisions.get('leg_style')?.value);
  console.log('Seed 42 (run 2):', chair2.decisions.get('leg_style')?.value);
  console.log('Same?', chair1.decisions.get('leg_style')?.value === chair2.decisions.get('leg_style')?.value);

  // Different seeds → different decisions
  console.log('\n=== Variety from different seeds ===');
  for (let seed = 1; seed <= 5; seed++) {
    const chair = buildDiningChair({ seed });
    const decisions = chair.decisions;
    console.log(`Seed ${seed}: leg=${decisions.get('leg_style')?.value}, back=${decisions.get('back_style')?.value}, taper=${decisions.get('leg_taper')?.value.toFixed(2)}`);
  }

  // Override example
  console.log('\n=== With override ===');
  const customChair = buildDiningChair({
    seed: 42,
    overrides: { leg_style: 'turned', back_style: 'spindle' }
  });
  console.log('Overridden leg_style:', customChair.decisions.get('leg_style')?.value, '(source:', customChair.decisions.get('leg_style')?.source + ')');
  console.log('Overridden back_style:', customChair.decisions.get('back_style')?.value, '(source:', customChair.decisions.get('back_style')?.source + ')');

  // Build details
  const output = buildDiningChair({ seed: 12345 });
  console.log('\n=== Build Results (seed 12345) ===');
  console.log(`Seed: ${output.seed}`);
  console.log(`Vertices: ${output.validation.vertexCount}`);
  console.log(`Faces: ${output.validation.faceCount}`);
  console.log(`Bounds: ${output.validation.bounds.size.x.toFixed(3)} x ${output.validation.bounds.size.y.toFixed(3)} x ${output.validation.bounds.size.z.toFixed(3)}m`);

  console.log('\n=== All Decisions ===');
  for (const [name, decision] of output.decisions) {
    const val = typeof decision.value === 'number' ? decision.value.toFixed(3) : decision.value;
    console.log(`  ${name}: ${val} (${decision.source})`);
  }
}

