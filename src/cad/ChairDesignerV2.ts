/**
 * Chair Designer V2 - Using proper SceneNode hierarchy
 *
 * This version uses the Transform/SceneNode system for clean
 * part assembly without directly manipulating vertices.
 */

import { Mesh } from '../geometry/Mesh';
import { SceneNode } from '../core/SceneNode';
import { Random } from '../core/Random';
import {
  createSeat,
  createLeg,
  createBack,
  createStretcher
} from './furnitureParts';
import {
  ChairSpec as ChairSpecType,
  CHAIR_STYLES as CHAIR_STYLES_OBJ
} from './ChairDesigner';

// Re-export with proper names
export type ChairSpec = ChairSpecType;
export const CHAIR_STYLES = CHAIR_STYLES_OBJ;

/**
 * Assembles a complete chair using SceneNode hierarchy
 * Returns a SceneNode tree that can be inspected or flattened to mesh
 */
export function assembleChairV2(spec: ChairSpecType): SceneNode {
  const root = new SceneNode('chair');

  const seatHeight = spec.legs.height;
  const seatThickness = spec.seat.thickness;

  // ============================================
  // 1. SEAT
  // ============================================
  const seatMesh = createSeat(
    spec.seat.width,
    spec.seat.depth,
    seatThickness,
    spec.seat.style,
    spec.seat.bevel
  );

  const seatNode = SceneNode.fromMesh('seat', seatMesh);
  seatNode.setPosition(0, seatHeight, 0);
  root.addChild(seatNode);

  // ============================================
  // 2. LEGS
  // ============================================
  const legPositions = [
    { name: 'leg_back_left', x: -1, z: -1 },
    { name: 'leg_back_right', x: 1, z: -1 },
    { name: 'leg_front_left', x: -1, z: 1 },
    { name: 'leg_front_right', x: 1, z: 1 }
  ];

  const hw = spec.seat.width / 2 - spec.legs.inset;
  const hd = spec.seat.depth / 2 - spec.legs.inset;

  for (const legDef of legPositions) {
    const legMesh = createLeg({
      style: spec.legs.style,
      height: spec.legs.height,
      topRadius: spec.legs.topRadius,
      bottomRadius: spec.legs.bottomRadius,
      profile: spec.legs.profile
    });

    const legNode = SceneNode.fromMesh(legDef.name, legMesh);

    // Position at corner
    const posX = legDef.x * hw;
    const posZ = legDef.z * hd;

    // Calculate splay: rotate the leg outward
    // The leg is created pointing up (Y+), we rotate it to splay outward
    const splayAngle = spec.legs.splayAngle;

    // Rotation axis is perpendicular to the splay direction
    // For a corner leg at (-1, -1), splay direction is (-1, 0, -1)
    // We rotate around an axis perpendicular to that in the XZ plane
    const rotX = legDef.z * splayAngle;  // Tilt forward/backward
    const rotZ = -legDef.x * splayAngle; // Tilt left/right

    legNode.setPosition(posX, 0, posZ);
    legNode.setRotation(rotX, 0, rotZ);

    root.addChild(legNode);
  }

  // ============================================
  // 3. STRETCHERS
  // ============================================
  if (spec.stretchers.enabled) {
    const stretcherHeight = spec.stretchers.height;
    const stretcherThickness = spec.stretchers.thickness;

    // Calculate position adjustment for splay at stretcher height
    const splayRatio = 1 - (stretcherHeight / spec.legs.height);
    const splayOffset = Math.tan(spec.legs.splayAngle) * spec.legs.height * splayRatio;

    if (spec.stretchers.sides) {
      // Left side stretcher (along Z axis, connects front-left to back-left)
      const leftStretcherMesh = createStretcher(
        spec.seat.depth - spec.legs.inset * 2,
        stretcherThickness,
        'z'  // Along Z axis
      );
      const leftStretcher = SceneNode.fromMesh('stretcher_left', leftStretcherMesh);
      leftStretcher.setPosition(-hw - splayOffset, stretcherHeight, 0);
      root.addChild(leftStretcher);

      // Right side stretcher
      const rightStretcherMesh = createStretcher(
        spec.seat.depth - spec.legs.inset * 2,
        stretcherThickness,
        'z'
      );
      const rightStretcher = SceneNode.fromMesh('stretcher_right', rightStretcherMesh);
      rightStretcher.setPosition(hw + splayOffset, stretcherHeight, 0);
      root.addChild(rightStretcher);
    }

    if (spec.stretchers.front) {
      const frontStretcherMesh = createStretcher(
        spec.seat.width - spec.legs.inset * 2,
        stretcherThickness,
        'x'  // Along X axis
      );
      const frontStretcher = SceneNode.fromMesh('stretcher_front', frontStretcherMesh);
      frontStretcher.setPosition(0, stretcherHeight, hd + splayOffset);
      root.addChild(frontStretcher);
    }

    if (spec.stretchers.back) {
      const backStretcherMesh = createStretcher(
        spec.seat.width - spec.legs.inset * 2,
        stretcherThickness,
        'x'
      );
      const backStretcher = SceneNode.fromMesh('stretcher_back', backStretcherMesh);
      backStretcher.setPosition(0, stretcherHeight, -hd - splayOffset);
      root.addChild(backStretcher);
    }
  }

  // ============================================
  // 4. BACK
  // ============================================
  if (spec.back.height > 0) {
    const backMesh = createBack({
      style: spec.back.style,
      width: spec.seat.width * 0.9,
      height: spec.back.height,
      thickness: spec.back.thickness,
      curvature: spec.back.curvature,
      spindleCount: spec.back.spindleCount,
      slatCount: spec.back.slatCount
    });

    const backNode = SceneNode.fromMesh('back', backMesh);

    // Position at back of seat, rotated for recline
    backNode.setPosition(
      0,
      seatHeight + seatThickness,
      -spec.seat.depth / 2 + spec.back.thickness / 2
    );
    // TEMPORARILY DISABLED for debugging:
    // // DISABLED: backNode.setRotation(-spec.back.angle, 0, 0); // Negative to recline backward

    root.addChild(backNode);
  }

  // ============================================
  // 5. ARMS (if enabled)
  // ============================================
  if (spec.arms?.enabled) {
    // Arms would be added here similarly
    // For now, skipping as they need more work
  }

  return root;
}

/**
 * Assemble and flatten to mesh (convenience function)
 */
export function buildChairV2(spec: ChairSpecType): Mesh {
  const node = assembleChairV2(spec);
  return node.toMesh();
}

/**
 * Generate random variation
 */
export function generateRandomChairV2(
  baseStyle: keyof typeof CHAIR_STYLES_OBJ,
  random: Random,
  variationAmount: number = 0.1
): Mesh {
  const base = CHAIR_STYLES_OBJ[baseStyle];

  const spec: ChairSpecType = {
    ...base,
    seat: {
      ...base.seat,
      width: base.seat.width * (1 + random.range(-variationAmount, variationAmount)),
      depth: base.seat.depth * (1 + random.range(-variationAmount, variationAmount)),
    },
    legs: {
      ...base.legs,
      height: base.legs.height * (1 + random.range(-variationAmount * 0.5, variationAmount * 0.5)),
    },
    back: {
      ...base.back,
      height: base.back.height * (1 + random.range(-variationAmount * 0.5, variationAmount * 0.5)),
    }
  };

  return buildChairV2(spec);
}

/**
 * Debug: build and print hierarchy
 */
export function debugChair(styleName: keyof typeof CHAIR_STYLES_OBJ): void {
  const spec = CHAIR_STYLES_OBJ[styleName];
  const node = assembleChairV2(spec);
  console.log(`\n=== ${spec.name} Hierarchy ===`);
  node.printHierarchy();
}

