/**
 * PersonBuilder - Procedural human figure using advanced geometry tools
 *
 * Uses:
 * - Subdivision surfaces for head
 * - Lathe for torso
 * - Limb segments for arms/legs
 * - Composition for assembly
 *
 * Based on classical figure proportions (7.5-8 heads tall)
 */

import { TracedBuilder, TracedOutput } from './TracedBuilder';
import { Vec3 } from '../core/Vec3';
import { Vertex } from '../geometry/Vertex';
import { Face } from '../geometry/Face';
import { createIcosphere } from '../geometry/Subdivision';
import { lathe, createLimbSegment } from '../geometry/Sweep';

// ============================================================================
// PROPORTIONS DATABASE
// ============================================================================

/**
 * Human proportions in "head heights" (1 head = reference unit)
 * Based on classical figure drawing proportions
 */
export interface HumanProportions {
  // Overall
  totalHeads: number;        // Total height in head units (7.5-8)
  headHeight: number;        // Actual head height in meters

  // Widths (in head units)
  shoulderWidth: number;     // Shoulder width
  hipWidth: number;          // Hip width
  waistWidth: number;        // Waist width

  // Vertical positions (from ground, in head units)
  hipHeight: number;         // Hip/crotch height
  waistHeight: number;       // Waist height
  chestHeight: number;       // Chest/nipple height
  shoulderHeight: number;    // Shoulder height
  chinHeight: number;        // Chin height

  // Limb proportions
  upperArmLength: number;    // Upper arm (shoulder to elbow)
  lowerArmLength: number;    // Lower arm (elbow to wrist)
  handLength: number;        // Hand length
  upperLegLength: number;    // Upper leg (hip to knee)
  lowerLegLength: number;    // Lower leg (knee to ankle)
  footLength: number;        // Foot length

  // Radii (in head units)
  neckRadius: number;
  upperArmRadius: number;
  lowerArmRadius: number;
  upperLegRadius: number;
  lowerLegRadius: number;
}

/**
 * Default adult proportions
 */
export function getDefaultProportions(
  bodyType: 'slim' | 'average' | 'muscular' | 'heavy' = 'average',
  genderShape: 'masculine' | 'feminine' | 'androgynous' = 'androgynous'
): HumanProportions {
  const base: HumanProportions = {
    totalHeads: 7.5,
    headHeight: 0.23,  // ~23cm head = ~173cm tall person

    shoulderWidth: 1.8,
    hipWidth: 1.5,
    waistWidth: 1.2,

    hipHeight: 4.0,
    waistHeight: 4.5,
    chestHeight: 5.5,
    shoulderHeight: 6.25,
    chinHeight: 6.75,

    upperArmLength: 1.3,
    lowerArmLength: 1.1,
    handLength: 0.75,
    upperLegLength: 2.0,
    lowerLegLength: 1.8,
    footLength: 1.0,

    neckRadius: 0.25,
    upperArmRadius: 0.2,
    lowerArmRadius: 0.15,
    upperLegRadius: 0.35,
    lowerLegRadius: 0.2,
  };

  // Adjust for body type
  if (bodyType === 'slim') {
    base.shoulderWidth *= 0.9;
    base.waistWidth *= 0.85;
    base.upperArmRadius *= 0.8;
    base.upperLegRadius *= 0.85;
  } else if (bodyType === 'muscular') {
    base.shoulderWidth *= 1.15;
    base.waistWidth *= 1.05;
    base.upperArmRadius *= 1.3;
    base.upperLegRadius *= 1.2;
  } else if (bodyType === 'heavy') {
    base.shoulderWidth *= 1.1;
    base.waistWidth *= 1.3;
    base.hipWidth *= 1.2;
    base.upperArmRadius *= 1.2;
    base.upperLegRadius *= 1.3;
  }

  // Adjust for gender shape
  if (genderShape === 'masculine') {
    base.shoulderWidth *= 1.1;
    base.hipWidth *= 0.9;
    base.waistWidth *= 1.05;
  } else if (genderShape === 'feminine') {
    base.shoulderWidth *= 0.9;
    base.hipWidth *= 1.1;
    base.waistWidth *= 0.9;
  }

  return base;
}

// ============================================================================
// HEAD BUILDER
// ============================================================================

export function buildHead(seed: number, overrides?: Record<string, any>): TracedOutput {
  const builder = new TracedBuilder('Head', seed, overrides);

  // Decisions
  const headShape = builder.decide('head_shape', ['round', 'oval', 'square'], [0.3, 0.5, 0.2]);
  const headWidth = builder.decideNumber('head_width_factor', 0.9, 1.1);
  const headDepth = builder.decideNumber('head_depth_factor', 0.85, 1.0);

  // Base measurements
  const headHeight = 0.23; // Standard head height
  builder.defineMeasurement('head_height', headHeight);
  builder.defineMeasurement('head_width', headHeight * 0.7 * headWidth);
  builder.defineMeasurement('head_depth', headHeight * 0.85 * headDepth);

  // Create base sphere and scale for head shape
  const baseSphere = createIcosphere(headHeight / 2, 2);

  // Scale based on head shape
  let scaleX = headWidth;
  let scaleY = 1.0;
  let scaleZ = headDepth;

  if (headShape === 'oval') {
    scaleY = 1.1;
    scaleX *= 0.95;
  } else if (headShape === 'square') {
    scaleY = 0.95;
    scaleX *= 1.05;
  }

  // Apply scaling to vertices
  for (const v of baseSphere.vertices) {
    v.position = new Vec3(
      v.position.x * scaleX,
      v.position.y * scaleY,
      v.position.z * scaleZ
    );
  }

  // Merge into builder's mesh
  for (const v of baseSphere.vertices) {
    builder['mesh'].addVertex(new Vertex(v.position));
  }
  for (const f of baseSphere.faces) {
    builder['mesh'].addFace(new Face([...f.indices]));
  }

  return builder.build();
}

// ============================================================================
// TORSO BUILDER
// ============================================================================

export function buildTorso(seed: number, overrides?: Record<string, any>): TracedOutput {
  const builder = new TracedBuilder('Torso', seed, overrides);

  // Get proportions
  const bodyType = builder.decide<'slim' | 'average' | 'muscular' | 'heavy'>('body_type', ['slim', 'average', 'muscular', 'heavy'], [0.2, 0.5, 0.2, 0.1]);
  const genderShape = builder.decide<'masculine' | 'feminine' | 'androgynous'>('gender_shape', ['masculine', 'feminine', 'androgynous'], [0.35, 0.35, 0.3]);

  const props = getDefaultProportions(bodyType, genderShape);
  const headHeight = props.headHeight;

  // Calculate absolute measurements
  const torsoHeight = (props.shoulderHeight - props.hipHeight) * headHeight;
  const shoulderWidth = props.shoulderWidth * headHeight;
  const waistWidth = props.waistWidth * headHeight;
  const hipWidth = props.hipWidth * headHeight;

  builder.defineMeasurement('torso_height', torsoHeight);
  builder.defineMeasurement('shoulder_width', shoulderWidth);
  builder.defineMeasurement('waist_width', waistWidth);
  builder.defineMeasurement('hip_width', hipWidth);

  // Create torso profile for lathe
  // Profile goes from hip (y=0) to shoulders (y=torsoHeight)
  const waistY = (props.waistHeight - props.hipHeight) / (props.shoulderHeight - props.hipHeight) * torsoHeight;
  const chestY = (props.chestHeight - props.hipHeight) / (props.shoulderHeight - props.hipHeight) * torsoHeight;

  const profile: Array<{ x: number; y: number }> = [
    { x: 0, y: 0 },                          // Center bottom
    { x: hipWidth / 2, y: 0 },               // Hip
    { x: waistWidth / 2, y: waistY },        // Waist
    { x: shoulderWidth / 2 * 0.9, y: chestY }, // Chest
    { x: shoulderWidth / 2, y: torsoHeight },  // Shoulders
    { x: 0, y: torsoHeight },                  // Center top (for neck)
  ];

  // Create torso mesh via lathe
  const torsoMesh = lathe(profile, 12);

  // Merge into builder
  for (const v of torsoMesh.vertices) {
    builder['mesh'].addVertex(new Vertex(v.position));
  }
  for (const f of torsoMesh.faces) {
    builder['mesh'].addFace(new Face([...f.indices]));
  }

  return builder.build();
}

// ============================================================================
// LIMB BUILDER
// ============================================================================

export function buildLimb(seed: number, overrides?: Record<string, any>): TracedOutput {
  const builder = new TracedBuilder('Limb', seed, overrides);

  const limbType = builder.decide('limb_type', ['upper_arm', 'lower_arm', 'upper_leg', 'lower_leg'], [0.25, 0.25, 0.25, 0.25]);
  const muscleTone = builder.decideNumber('muscle_tone', 0.8, 1.3);

  let length: number, startRadius: number, endRadius: number, bulgePos: number, bulgeAmt: number;

  const headHeight = 0.23;
  const props = getDefaultProportions();

  switch (limbType) {
    case 'upper_arm':
      length = props.upperArmLength * headHeight;
      startRadius = props.upperArmRadius * headHeight * muscleTone;
      endRadius = startRadius * 0.7;
      bulgePos = 0.35;
      bulgeAmt = 1.15 * muscleTone;
      break;
    case 'lower_arm':
      length = props.lowerArmLength * headHeight;
      startRadius = props.lowerArmRadius * headHeight * muscleTone;
      endRadius = startRadius * 0.6;
      bulgePos = 0.25;
      bulgeAmt = 1.1;
      break;
    case 'upper_leg':
      length = props.upperLegLength * headHeight;
      startRadius = props.upperLegRadius * headHeight * muscleTone;
      endRadius = startRadius * 0.6;
      bulgePos = 0.3;
      bulgeAmt = 1.2 * muscleTone;
      break;
    case 'lower_leg':
    default:
      length = props.lowerLegLength * headHeight;
      startRadius = props.lowerLegRadius * headHeight * muscleTone;
      endRadius = startRadius * 0.5;
      bulgePos = 0.25;
      bulgeAmt = 1.15;
      break;
  }

  builder.defineMeasurement('length', length);
  builder.defineMeasurement('start_radius', startRadius);
  builder.defineMeasurement('end_radius', endRadius);

  // Create limb mesh
  const limbMesh = createLimbSegment(length, startRadius, endRadius, bulgePos, bulgeAmt, 8, 5);

  // Merge into builder
  for (const v of limbMesh.vertices) {
    builder['mesh'].addVertex(new Vertex(v.position));
  }
  for (const f of limbMesh.faces) {
    builder['mesh'].addFace(new Face([...f.indices]));
  }

  return builder.build();
}

// ============================================================================
// FULL PERSON BUILDER
// ============================================================================

export function buildPerson(seed: number, overrides?: Record<string, any>): TracedOutput {
  const builder = new TracedBuilder('Person', seed, overrides);

  // Top-level decisions
  const bodyType = builder.decide<'slim' | 'average' | 'muscular' | 'heavy'>('body_type', ['slim', 'average', 'muscular', 'heavy'], [0.2, 0.5, 0.2, 0.1]);
  const genderShape = builder.decide<'masculine' | 'feminine' | 'androgynous'>('gender_shape', ['masculine', 'feminine', 'androgynous'], [0.35, 0.35, 0.3]);
  const heightVariation = builder.decideNumber('height_variation', -0.1, 0.1);

  const props = getDefaultProportions(bodyType, genderShape);
  const headHeight = props.headHeight * (1 + heightVariation);
  const totalHeight = props.totalHeads * headHeight;

  builder.defineMeasurement('total_height', totalHeight);
  builder.defineMeasurement('head_height', headHeight);

  // Calculate key positions (from ground)
  const hipY = props.hipHeight * headHeight;
  const shoulderY = props.shoulderHeight * headHeight;
  const headCenterY = (props.chinHeight + 0.5) * headHeight;

  // Compose sub-builders

  // 1. Head
  builder.compose('head', buildHead, {
    offset: { x: 0, y: headCenterY, z: 0 },
    overrides: { head_shape: builder.decide('head_shape', ['round', 'oval', 'square'], [0.3, 0.5, 0.2]) }
  });

  // 2. Torso
  builder.compose('torso', buildTorso, {
    offset: { x: 0, y: hipY, z: 0 },
    overrides: { body_type: bodyType, gender_shape: genderShape }
  });

  // 3. Arms (composed as limbs with positioning)
  const shoulderX = props.shoulderWidth * headHeight / 2;

  // Upper arms
  builder.compose('upper_arm_l', buildLimb, {
    offset: { x: -shoulderX, y: shoulderY, z: 0 },
    rotation: { x: 0, y: 0, z: Math.PI },  // Point down
    overrides: { limb_type: 'upper_arm' }
  });
  builder.compose('upper_arm_r', buildLimb, {
    offset: { x: shoulderX, y: shoulderY, z: 0 },
    rotation: { x: 0, y: 0, z: Math.PI },  // Point down
    overrides: { limb_type: 'upper_arm' }
  });

  // Lower arms
  const elbowY = shoulderY - props.upperArmLength * headHeight;
  builder.compose('lower_arm_l', buildLimb, {
    offset: { x: -shoulderX, y: elbowY, z: 0 },
    rotation: { x: 0, y: 0, z: Math.PI },
    overrides: { limb_type: 'lower_arm' }
  });
  builder.compose('lower_arm_r', buildLimb, {
    offset: { x: shoulderX, y: elbowY, z: 0 },
    rotation: { x: 0, y: 0, z: Math.PI },
    overrides: { limb_type: 'lower_arm' }
  });

  // 4. Legs
  const hipX = props.hipWidth * headHeight / 4;  // Legs closer together than hip width

  // Upper legs
  builder.compose('upper_leg_l', buildLimb, {
    offset: { x: -hipX, y: hipY, z: 0 },
    rotation: { x: 0, y: 0, z: Math.PI },
    overrides: { limb_type: 'upper_leg' }
  });
  builder.compose('upper_leg_r', buildLimb, {
    offset: { x: hipX, y: hipY, z: 0 },
    rotation: { x: 0, y: 0, z: Math.PI },
    overrides: { limb_type: 'upper_leg' }
  });

  // Lower legs
  const kneeY = hipY - props.upperLegLength * headHeight;
  builder.compose('lower_leg_l', buildLimb, {
    offset: { x: -hipX, y: kneeY, z: 0 },
    rotation: { x: 0, y: 0, z: Math.PI },
    overrides: { limb_type: 'lower_leg' }
  });
  builder.compose('lower_leg_r', buildLimb, {
    offset: { x: hipX, y: kneeY, z: 0 },
    rotation: { x: 0, y: 0, z: Math.PI },
    overrides: { limb_type: 'lower_leg' }
  });

  return builder.build();
}

// ============================================================================
// TEST
// ============================================================================

export function testPersonBuilder() {
  console.log('Testing PersonBuilder...\n');

  for (const seed of [1, 42, 100]) {
    const result = buildPerson(seed);

    console.log(`Seed ${seed}:`);
    console.log(`  Body Type: ${result.decisions.get('body_type')?.value}`);
    console.log(`  Gender Shape: ${result.decisions.get('gender_shape')?.value}`);
    console.log(`  Head Shape: ${result.decisions.get('head_shape')?.value}`);
    console.log(`  Total Height: ${result.measurements.get('total_height')?.value.toFixed(2)}m`);
    console.log(`  Vertices: ${result.validation.vertexCount}, Faces: ${result.validation.faceCount}`);
    console.log(`  Sub-builders: ${result.subBuilders.size}`);
    console.log('');
  }
}

