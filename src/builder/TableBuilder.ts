/**
 * TableBuilder - Demonstrates builder composition
 *
 * A table composed of:
 * - A tabletop (built inline)
 * - 4 legs (each using LegBuilder sub-builder)
 */

import { TracedBuilder, TracedOutput } from './TracedBuilder';
import { Vec3 } from '../core/Vec3';

// ============================================================================
// LEG BUILDER (Sub-Builder)
// ============================================================================

/**
 * Build a single table/chair leg
 * Can be round, square, or tapered
 */
export function buildLeg(seed: number, overrides?: Record<string, any>): TracedOutput {
  const builder = new TracedBuilder('Leg', seed, overrides);

  // Measurements
  const height = builder.decideNumber('height', 0.35, 0.50, 0.45);
  const topRadius = builder.decideNumber('top_radius', 0.02, 0.04, 0.025);
  const style = builder.decide('style', ['round', 'square', 'tapered'], [0.4, 0.3, 0.3]);

  builder.defineMeasurement('height', height);
  builder.defineMeasurement('top_radius', topRadius);

  const segments = style === 'square' ? 4 : 8;
  const bottomRadius = style === 'tapered'
    ? topRadius * builder.decideNumber('taper_ratio', 0.6, 0.9)
    : topRadius;

  builder.defineMeasurement('bottom_radius', bottomRadius);

  // Create top loop (at origin, will be positioned by parent)
  builder.createCircleLoop(
    'top',
    { x: '0', y: 'height', z: '0' },
    'top_radius',
    segments,
    'structural',
    new Vec3(0, 1, 0)
  );

  // Create bottom loop
  builder.createCircleLoop(
    'bottom',
    { x: '0', y: '0', z: '0' },
    'bottom_radius',
    segments,
    'structural',
    new Vec3(0, 1, 0)
  );

  // Loft and cap
  builder.loftLoops('shaft', 'bottom', 'top');
  builder.capLoop('top_cap', 'top', false);
  builder.capLoop('bottom_cap', 'bottom', true);

  return builder.build();
}

// ============================================================================
// TABLE BUILDER (Composite Builder)
// ============================================================================

/**
 * Build a dining table by composing:
 * - Tabletop (inline)
 * - 4 legs (via LegBuilder composition)
 */
export function buildTable(seed: number, overrides?: Record<string, any>): TracedOutput {
  const builder = new TracedBuilder('Table', seed, overrides);

  // ==========================================================================
  // DECISIONS
  // ==========================================================================

  const tableStyle = builder.decide('table_style', ['rectangular', 'round'], [0.7, 0.3]);
  const legStyle = builder.decide('leg_style', ['round', 'square', 'tapered'], [0.4, 0.3, 0.3]);

  // ==========================================================================
  // MEASUREMENTS
  // ==========================================================================

  const tableWidth = 1.2 + builder.decideNumber('width_variation', -0.2, 0.2);
  const tableDepth = 0.8 + builder.decideNumber('depth_variation', -0.1, 0.1);
  const tableHeight = 0.75 + builder.decideNumber('height_variation', -0.05, 0.05);
  const topThickness = 0.03 + builder.decideNumber('thickness_variation', -0.005, 0.01);
  const legInset = 0.08 + builder.decideNumber('inset_variation', -0.02, 0.02);

  builder.defineMeasurement('table_width', tableWidth);
  builder.defineMeasurement('table_depth', tableDepth);
  builder.defineMeasurement('table_height', tableHeight);
  builder.defineMeasurement('top_thickness', topThickness);
  builder.defineMeasurement('leg_inset', legInset);

  // Derived measurements
  builder.defineDerived('half_width', 'table_width / 2');
  builder.defineDerived('half_depth', 'table_depth / 2');
  builder.defineDerived('leg_height', 'table_height - top_thickness');
  builder.defineDerived('leg_x', 'half_width - leg_inset');
  builder.defineDerived('leg_z', 'half_depth - leg_inset');

  // ==========================================================================
  // TABLETOP (inline geometry)
  // ==========================================================================

  if (tableStyle === 'rectangular') {
    // Rectangular tabletop - 8 vertices (top and bottom rectangles)
    builder.placeVertex('top_fl', { x: '-half_width', y: 'table_height', z: 'half_depth' });
    builder.placeVertex('top_fr', { x: 'half_width', y: 'table_height', z: 'half_depth' });
    builder.placeVertex('top_br', { x: 'half_width', y: 'table_height', z: '-half_depth' });
    builder.placeVertex('top_bl', { x: '-half_width', y: 'table_height', z: '-half_depth' });

    builder.placeVertex('bot_fl', { x: '-half_width', y: 'leg_height', z: 'half_depth' });
    builder.placeVertex('bot_fr', { x: 'half_width', y: 'leg_height', z: 'half_depth' });
    builder.placeVertex('bot_br', { x: 'half_width', y: 'leg_height', z: '-half_depth' });
    builder.placeVertex('bot_bl', { x: '-half_width', y: 'leg_height', z: '-half_depth' });

    // Top face
    builder.createFace('top_face', ['top_fl', 'top_fr', 'top_br', 'top_bl']);
    // Bottom face
    builder.createFace('bottom_face', ['bot_bl', 'bot_br', 'bot_fr', 'bot_fl']);
    // Side faces
    builder.createFace('front_face', ['top_fl', 'bot_fl', 'bot_fr', 'top_fr']);
    builder.createFace('right_face', ['top_fr', 'bot_fr', 'bot_br', 'top_br']);
    builder.createFace('back_face', ['top_br', 'bot_br', 'bot_bl', 'top_bl']);
    builder.createFace('left_face', ['top_bl', 'bot_bl', 'bot_fl', 'top_fl']);
  } else {
    // Round tabletop
    const segments = 16;
    builder.defineMeasurement('table_radius', tableWidth / 2);

    builder.createCircleLoop('top_edge',
      { x: '0', y: 'table_height', z: '0' },
      'table_radius', segments, 'structural', new Vec3(0, 1, 0));
    builder.createCircleLoop('bottom_edge',
      { x: '0', y: 'leg_height', z: '0' },
      'table_radius', segments, 'structural', new Vec3(0, 1, 0));

    builder.loftLoops('top_rim', 'bottom_edge', 'top_edge');
    builder.capLoop('top_cap', 'top_edge', false);
    builder.capLoop('bottom_cap', 'bottom_edge', true);
  }

  // ==========================================================================
  // LEGS (composed sub-builders)
  // ==========================================================================

  // Get leg height from context
  const legHeight = tableHeight - topThickness;

  // Leg positions depend on table style
  let legPositions: Array<{ name: string; x: number; z: number }>;

  if (tableStyle === 'rectangular') {
    // Rectangular table: legs at corners with inset
    legPositions = [
      { name: 'leg_fl', x: -(tableWidth / 2 - legInset), z: (tableDepth / 2 - legInset) },
      { name: 'leg_fr', x: (tableWidth / 2 - legInset), z: (tableDepth / 2 - legInset) },
      { name: 'leg_br', x: (tableWidth / 2 - legInset), z: -(tableDepth / 2 - legInset) },
      { name: 'leg_bl', x: -(tableWidth / 2 - legInset), z: -(tableDepth / 2 - legInset) },
    ];
  } else {
    // Round table: legs in circular pattern
    const tableRadius = tableWidth / 2;
    const legRadius = tableRadius - legInset; // Place legs inside the table edge
    legPositions = [
      { name: 'leg_1', x: legRadius * Math.cos(Math.PI * 0.25), z: legRadius * Math.sin(Math.PI * 0.25) },
      { name: 'leg_2', x: legRadius * Math.cos(Math.PI * 0.75), z: legRadius * Math.sin(Math.PI * 0.75) },
      { name: 'leg_3', x: legRadius * Math.cos(Math.PI * 1.25), z: legRadius * Math.sin(Math.PI * 1.25) },
      { name: 'leg_4', x: legRadius * Math.cos(Math.PI * 1.75), z: legRadius * Math.sin(Math.PI * 1.75) },
    ];
  }

  for (const leg of legPositions) {
    builder.compose(leg.name, buildLeg, {
      offset: { x: leg.x, y: 0, z: leg.z },
      overrides: {
        style: legStyle,
        height: legHeight
      }
    });
  }

  return builder.build();
}

// ============================================================================
// TEST
// ============================================================================

export function testTableBuilder() {
  console.log('Testing TableBuilder...\n');

  // Test with different seeds
  for (const seed of [1, 42, 100]) {
    const result = buildTable(seed);

    console.log(`Seed ${seed}:`);
    console.log(`  Style: ${result.decisions.get('table_style')?.value}`);
    console.log(`  Leg Style: ${result.decisions.get('leg_style')?.value}`);
    console.log(`  Dimensions: ${result.measurements.get('table_width')?.value.toFixed(2)}m x ${result.measurements.get('table_depth')?.value.toFixed(2)}m`);
    console.log(`  Height: ${result.measurements.get('table_height')?.value.toFixed(2)}m`);
    console.log(`  Vertices: ${result.validation.vertexCount}, Faces: ${result.validation.faceCount}`);
    console.log(`  Sub-builders: ${result.subBuilders.size}`);

    // Show sub-builder decisions (prefixed)
    const legDecisions = Array.from(result.decisions.entries())
      .filter(([k]) => k.startsWith('leg_fl.'));
    if (legDecisions.length > 0) {
      console.log(`  Front-left leg decisions:`);
      for (const [k, v] of legDecisions) {
        console.log(`    ${k}: ${v.value}`);
      }
    }
    console.log('');
  }
}

