/**
 * Clean Chair Builder
 *
 * This is the reference implementation of a builder using:
 * - SafePrimitives for all geometry
 * - SceneNode for all positioning
 * - No direct vertex manipulation
 *
 * Follow this pattern for all new builders.
 */

import { SceneNode } from '../../core/SceneNode';
import { createRod, createPanel, createBox, createHorizontalRod } from '../../cad/SafePrimitives';

/**
 * Chair specification - all dimensions in meters
 */
export interface ChairSpec {
  name: string;

  // Seat
  seatWidth: number;      // X dimension
  seatDepth: number;      // Z dimension
  seatThickness: number;  // Y dimension
  seatHeight: number;     // Height from floor to seat top

  // Legs
  legRadius: number;
  legInset: number;       // How far legs are inset from seat edge

  // Back
  backHeight: number;     // Height above seat
  backThickness: number;
  backInset: number;      // Distance from back of seat

  // Optional
  hasStretchers?: boolean;
  stretcherRadius?: number;
  stretcherHeight?: number;
}

/**
 * Predefined chair styles
 */
export const CHAIR_STYLES: Record<string, ChairSpec> = {
  simple: {
    name: 'Simple Chair',
    seatWidth: 0.45,
    seatDepth: 0.42,
    seatThickness: 0.025,
    seatHeight: 0.45,
    legRadius: 0.02,
    legInset: 0.03,
    backHeight: 0.40,
    backThickness: 0.02,
    backInset: 0.02,
    hasStretchers: false
  },

  dining: {
    name: 'Dining Chair',
    seatWidth: 0.44,
    seatDepth: 0.40,
    seatThickness: 0.03,
    seatHeight: 0.46,
    legRadius: 0.018,
    legInset: 0.025,
    backHeight: 0.45,
    backThickness: 0.025,
    backInset: 0.015,
    hasStretchers: true,
    stretcherRadius: 0.01,
    stretcherHeight: 0.15
  },

  stool: {
    name: 'Bar Stool',
    seatWidth: 0.35,
    seatDepth: 0.35,
    seatThickness: 0.03,
    seatHeight: 0.75,
    legRadius: 0.015,
    legInset: 0.02,
    backHeight: 0.20,
    backThickness: 0.02,
    backInset: 0.01,
    hasStretchers: true,
    stretcherRadius: 0.012,
    stretcherHeight: 0.35
  }
};

/**
 * Build a chair using the clean pattern
 */
export function buildChair(spec: ChairSpec): SceneNode {
  const chair = new SceneNode('chair');

  // ==========================================
  // SEAT
  // ==========================================
  const seatMesh = createPanel(spec.seatWidth, spec.seatDepth, spec.seatThickness);
  const seat = SceneNode.fromMesh('seat', seatMesh);
  seat.setPosition(0, spec.seatHeight - spec.seatThickness, 0);
  chair.addChild(seat);

  // ==========================================
  // LEGS
  // ==========================================
  const legHeight = spec.seatHeight - spec.seatThickness;
  const legMesh = createRod(spec.legRadius, legHeight);

  // Calculate leg positions (inset from seat corners)
  const legX = spec.seatWidth / 2 - spec.legInset;
  const legZ = spec.seatDepth / 2 - spec.legInset;

  const legPositions = [
    { name: 'leg_front_left',  x: -legX, z: legZ },
    { name: 'leg_front_right', x: legX,  z: legZ },
    { name: 'leg_back_left',   x: -legX, z: -legZ },
    { name: 'leg_back_right',  x: legX,  z: -legZ }
  ];

  for (const pos of legPositions) {
    const leg = SceneNode.fromMesh(pos.name, legMesh.clone());
    leg.setPosition(pos.x, 0, pos.z);
    chair.addChild(leg);
  }

  // ==========================================
  // STRETCHERS (optional)
  // ==========================================
  if (spec.hasStretchers && spec.stretcherRadius && spec.stretcherHeight) {
    const stretcherY = spec.stretcherHeight;

    // Side stretchers (along Z axis)
    const sideStretcherLength = spec.seatDepth - spec.legInset * 2;
    const sideStretcherMesh = createHorizontalRod(spec.stretcherRadius, sideStretcherLength, 'z');

    const leftStretcher = SceneNode.fromMesh('stretcher_left', sideStretcherMesh);
    leftStretcher.setPosition(-legX, stretcherY, 0);
    chair.addChild(leftStretcher);

    const rightStretcher = SceneNode.fromMesh('stretcher_right', sideStretcherMesh.clone());
    rightStretcher.setPosition(legX, stretcherY, 0);
    chair.addChild(rightStretcher);

    // Front/back stretchers (along X axis)
    const frontStretcherLength = spec.seatWidth - spec.legInset * 2;
    const frontStretcherMesh = createHorizontalRod(spec.stretcherRadius, frontStretcherLength, 'x');

    const frontStretcher = SceneNode.fromMesh('stretcher_front', frontStretcherMesh);
    frontStretcher.setPosition(0, stretcherY, legZ);
    chair.addChild(frontStretcher);

    const backStretcher = SceneNode.fromMesh('stretcher_back', frontStretcherMesh.clone());
    backStretcher.setPosition(0, stretcherY, -legZ);
    chair.addChild(backStretcher);
  }

  // ==========================================
  // BACK
  // ==========================================
  const backMesh = createBox(
    spec.seatWidth - spec.legInset * 2,  // Width
    spec.backHeight,                      // Height
    spec.backThickness                    // Depth
  );
  const back = SceneNode.fromMesh('back', backMesh);
  back.setPosition(
    0,
    spec.seatHeight,  // Sits on top of seat
    -spec.seatDepth / 2 + spec.backInset + spec.backThickness / 2
  );
  chair.addChild(back);

  return chair;
}

/**
 * Build multiple chair variants
 */
export function buildChairShowcase(): SceneNode {
  const showcase = new SceneNode('chair_showcase');

  const styles = Object.keys(CHAIR_STYLES);
  const spacing = 0.8;

  styles.forEach((styleName, index) => {
    const spec = CHAIR_STYLES[styleName];
    const chair = buildChair(spec);

    // Position in a row
    const x = (index - (styles.length - 1) / 2) * spacing;
    chair.setPosition(x, 0, 0);

    showcase.addChild(chair);
  });

  return showcase;
}

