/**
 * Furniture Parts - Higher-level components built from CAD primitives
 *
 * Each part function returns a mesh positioned at a standard origin
 * with known dimensions and attachment semantics.
 */

import { Mesh } from '../geometry/Mesh';
import type { Vertex } from '../geometry/Vertex';
import {
  createPanel,
  createTaperedRod,
  createTurnedRod,
  createCurvedPanel,
  createSpindles,
  ProfileType
} from './primitives';

/**
 * Seat styles define the shape and profile of the seat pan
 */
export type SeatStyle = 'flat' | 'contoured' | 'scooped';

/**
 * Creates a chair seat
 * Origin at bottom center, top surface at y = thickness
 */
export function createSeat(
  width: number,
  depth: number,
  thickness: number,
  style: SeatStyle = 'flat',
  bevel: number = 0.005
): Mesh {
  switch (style) {
    case 'contoured':
      return createPanel(width, depth, thickness * 1.1, bevel);
    case 'scooped':
      return createPanel(width, depth, thickness, bevel * 2);
    case 'flat':
    default:
      return createPanel(width, depth, thickness, bevel);
  }
}

/**
 * Leg styles with characteristic profiles
 */
export type LegStyle =
  | 'straight'
  | 'tapered'
  | 'reverse-taper'
  | 'turned'
  | 'cabriole'
  | 'sabre'
  | 'splayed';

export interface LegParams {
  style: LegStyle;
  height: number;
  topRadius: number;
  bottomRadius?: number;
  profile?: ProfileType;
  splayAngle?: number;
}

/**
 * Creates a single leg
 * Origin at bottom center, extends upward along Y
 */
export function createLeg(params: LegParams): Mesh {
  const {
    style,
    height,
    topRadius,
    bottomRadius = topRadius,
    profile = 'circle'
  } = params;

  switch (style) {
    case 'straight':
      return createTaperedRod(topRadius, topRadius, height, 12, profile);

    case 'tapered':
      return createTaperedRod(bottomRadius * 0.7, topRadius, height, 12, profile);

    case 'reverse-taper':
      return createTaperedRod(topRadius, bottomRadius * 0.7, height, 12, profile);

    case 'turned':
      return createTurnedRod([
        { height: 0, radius: bottomRadius * 0.8 },
        { height: height * 0.05, radius: bottomRadius },
        { height: height * 0.15, radius: bottomRadius * 0.7 },
        { height: height * 0.1, radius: bottomRadius * 0.9 },
        { height: height * 0.1, radius: bottomRadius * 0.6 },
        { height: height * 0.5, radius: topRadius * 0.8 },
        { height: height * 0.1, radius: topRadius }
      ], 12, profile);

    case 'cabriole':
      return createTurnedRod([
        { height: 0, radius: bottomRadius * 0.6 },
        { height: height * 0.1, radius: bottomRadius * 0.8 },
        { height: height * 0.2, radius: bottomRadius * 0.5 },
        { height: height * 0.3, radius: bottomRadius * 0.7 },
        { height: height * 0.2, radius: topRadius * 0.9 },
        { height: height * 0.2, radius: topRadius * 1.2 }
      ], 12, profile);

    case 'sabre':
      return createTurnedRod([
        { height: 0, radius: bottomRadius * 0.8 },
        { height: height * 0.3, radius: bottomRadius * 0.7 },
        { height: height * 0.7, radius: topRadius }
      ], 12, profile);

    case 'splayed':
    default:
      return createTaperedRod(bottomRadius * 0.8, topRadius, height, 12, profile);
  }
}

/**
 * Chair back styles
 */
export type BackStyle =
  | 'solid'
  | 'slatted'
  | 'spindle'
  | 'ladder'
  | 'open-frame'
  | 'curved';

export interface BackParams {
  style: BackStyle;
  width: number;
  height: number;
  thickness: number;
  curvature?: number;
  slatCount?: number;
  spindleCount?: number;
}

/**
 * Creates a chair back
 * Origin at bottom center, extends upward
 */
export function createBack(params: BackParams): Mesh {
  const {
    style,
    width,
    height,
    thickness,
    curvature = 0.05,
    slatCount = 3,
    spindleCount = 5
  } = params;

  console.log(`[createBack] Creating ${style} back: height=${height}, width=${width}`);

  const mesh = new Mesh();

  switch (style) {
    case 'solid':
      return createCurvedPanel(width, height, thickness, curvature, 6);

    case 'curved':
      return createCurvedPanel(width, height, thickness, curvature * 2, 10);

    case 'spindle': {
      const topRail = createTaperedRod(thickness, thickness, width, 8, 'rounded-square');
      topRail.vertices.forEach((v: Vertex) => {
        const temp = v.position.y;
        v.position.y = height - thickness;
        v.position.x = v.position.x + temp - width / 2;
      });
      mesh.merge(topRail);

      const bottomRail = createTaperedRod(thickness * 0.8, thickness * 0.8, width, 8, 'rounded-square');
      bottomRail.vertices.forEach((v: Vertex) => {
        const temp = v.position.y;
        v.position.y = thickness;
        v.position.x = v.position.x + temp - width / 2;
      });
      mesh.merge(bottomRail);

      const spindles = createSpindles(
        spindleCount,
        width * 0.85,
        height - thickness * 2.5,
        thickness * 0.25,
        thickness * 0.35,
        thickness * 0.25,
        8
      );
      spindles.vertices.forEach((v: Vertex) => v.position.y += thickness * 1.5);
      mesh.merge(spindles);

      mesh.calculateNormals();
      return mesh;
    }

    case 'ladder': {
      const postHeight = height;
      const postWidth = thickness * 1.2;

      // Create left post
      const leftPost = createTaperedRod(postWidth / 2, postWidth / 2 * 0.9, postHeight, 8, 'rounded-square');
      leftPost.vertices.forEach((v: Vertex) => v.position.x -= width / 2 - postWidth / 2);
      mesh.merge(leftPost);

      // Create right post
      const rightPost = createTaperedRod(postWidth / 2, postWidth / 2 * 0.9, postHeight, 8, 'rounded-square');
      rightPost.vertices.forEach((v: Vertex) => v.position.x += width / 2 - postWidth / 2);
      mesh.merge(rightPost);

      // Create horizontal slats
      const slatSpacing = (height - thickness * 2) / (slatCount + 1);
      const slatWidth = width - postWidth * 2;
      const slatThickness = thickness * 0.6;

      for (let i = 1; i <= slatCount; i++) {
        const slatY = i * slatSpacing + thickness;
        // Use non-beveled panel (bevel=0) - beveled panels have a bug
        const slat = createPanel(slatWidth, thickness * 0.8, slatThickness, 0);
        slat.vertices.forEach((v: Vertex) => v.position.y += slatY);
        mesh.merge(slat);
      }

      mesh.calculateNormals();

      return mesh;
    }

    case 'slatted': {
      const slatHeight = (height - thickness) / slatCount;

      for (let i = 0; i < slatCount; i++) {
        const slatY = i * slatHeight;
        const slat = createCurvedPanel(width * 0.95, slatHeight * 0.7, thickness * 0.5, curvature, 4);
        slat.vertices.forEach((v: Vertex) => v.position.y += slatY + slatHeight * 0.15);
        mesh.merge(slat);
      }

      mesh.calculateNormals();
      return mesh;
    }

    case 'open-frame':
    default: {
      const frameThickness = thickness * 1.5;

      const top = createPanel(width, frameThickness, thickness, 0.002);
      top.vertices.forEach((v: Vertex) => v.position.y += height - frameThickness);
      mesh.merge(top);

      const left = createTaperedRod(frameThickness / 2, frameThickness / 2, height, 8, 'rounded-square');
      left.vertices.forEach((v: Vertex) => v.position.x -= width / 2 - frameThickness / 2);
      mesh.merge(left);

      const right = createTaperedRod(frameThickness / 2, frameThickness / 2, height, 8, 'rounded-square');
      right.vertices.forEach((v: Vertex) => v.position.x += width / 2 - frameThickness / 2);
      mesh.merge(right);

      mesh.calculateNormals();
      return mesh;
    }
  }
}

/**
 * Creates a stretcher (horizontal support between legs)
 * Centered at origin, extends along specified axis
 */
export function createStretcher(
  length: number,
  thickness: number,
  axis: 'x' | 'z' = 'x',
  profile: ProfileType = 'circle'
): Mesh {
  const rod = createTaperedRod(thickness / 2, thickness / 2, length, 8, profile);

  rod.vertices.forEach((v: Vertex) => {
    const originalY = v.position.y;
    const originalX = v.position.x;
    const originalZ = v.position.z;
    const centered = originalY - length / 2;

    if (axis === 'x') {
      v.position.x = centered;
      v.position.y = originalZ;
      v.position.z = originalX;
    } else {
      v.position.z = centered;
      v.position.y = originalX;
      v.position.x = originalZ;
    }
  });

  rod.calculateNormals();
  return rod;
}

/**
 * Creates an armrest
 */
export function createArmrest(
  length: number,
  height: number,
  thickness: number,
  style: 'straight' | 'curved' = 'straight'
): Mesh {
  if (style === 'curved') {
    return createTurnedRod([
      { height: 0, radius: thickness / 2 },
      { height: length * 0.3, radius: thickness / 2 * 0.9 },
      { height: length * 0.5, radius: thickness / 2 * 0.85 },
      { height: length * 0.2, radius: thickness / 2 }
    ], 8, 'rounded-square');
  }

  const arm = createPanel(thickness, length, thickness * 0.8, 0.003);
  arm.vertices.forEach((v: Vertex) => {
    const oldZ = v.position.z;
    v.position.z = v.position.y;
    v.position.y = height + oldZ;
  });
  return arm;
}

