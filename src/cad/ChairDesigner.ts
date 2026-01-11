/**
 * Chair Designer - CAD-based chair generation system
 *
 * This demonstrates how to design furniture procedurally using
 * proper CAD principles: parts, dimensions, and assembly.
 */

import { Mesh } from '../geometry/Mesh';
import { Vec3 } from '../core/Vec3';
import { Random } from '../core/Random';
import type { Vertex } from '../geometry/Vertex';
import {
  createSeat,
  createLeg,
  createBack,
  createStretcher,
  createArmrest,
  LegStyle,
  BackStyle,
  SeatStyle
} from './furnitureParts';
import { ProfileType } from './primitives';

/**
 * Complete chair specification
 */
export interface ChairSpec {
  // Overall style name
  name: string;

  // Seat parameters
  seat: {
    width: number;
    depth: number;
    thickness: number;
    style: SeatStyle;
    bevel: number;
  };

  // Leg parameters
  legs: {
    style: LegStyle;
    height: number;        // From floor to bottom of seat
    topRadius: number;
    bottomRadius: number;
    profile: ProfileType;
    splayAngle: number;    // Radians, 0 = straight down
    inset: number;         // Distance from seat edge
  };

  // Back parameters
  back: {
    style: BackStyle;
    height: number;        // From seat to top of back
    thickness: number;
    angle: number;         // Recline angle in radians (0 = vertical)
    curvature: number;
    spindleCount?: number;
    slatCount?: number;
  };

  // Stretchers (horizontal supports)
  stretchers: {
    enabled: boolean;
    height: number;        // From floor
    thickness: number;
    sides: boolean;        // Side stretchers
    front: boolean;        // Front stretcher
    back: boolean;         // Back stretcher
  };

  // Arms (optional)
  arms?: {
    enabled: boolean;
    height: number;        // From seat
    length: number;
    thickness: number;
    style: 'straight' | 'curved';
  };
}

/**
 * Pre-defined chair styles
 */
export const CHAIR_STYLES: Record<string, ChairSpec> = {
  'windsor': {
    name: 'Windsor Chair',
    seat: {
      width: 0.45,
      depth: 0.42,
      thickness: 0.045,
      style: 'scooped',
      bevel: 0.008
    },
    legs: {
      style: 'turned',
      height: 0.42,
      topRadius: 0.018,
      bottomRadius: 0.015,
      profile: 'circle',
      splayAngle: 0.15,  // ~8.5 degrees
      inset: 0.04
    },
    back: {
      style: 'spindle',
      height: 0.45,
      thickness: 0.02,
      angle: 0.18,  // ~10 degrees recline
      curvature: 0.03,
      spindleCount: 7
    },
    stretchers: {
      enabled: true,
      height: 0.12,
      thickness: 0.015,
      sides: true,
      front: true,
      back: true
    }
  },

  'modern-dining': {
    name: 'Modern Dining Chair',
    seat: {
      width: 0.46,
      depth: 0.44,
      thickness: 0.025,
      style: 'flat',
      bevel: 0.003
    },
    legs: {
      style: 'tapered',
      height: 0.45,
      topRadius: 0.02,
      bottomRadius: 0.015,
      profile: 'rounded-square',
      splayAngle: 0.05,
      inset: 0.025
    },
    back: {
      style: 'curved',
      height: 0.42,
      thickness: 0.015,
      angle: 0.12,
      curvature: 0.08
    },
    stretchers: {
      enabled: false,
      height: 0,
      thickness: 0,
      sides: false,
      front: false,
      back: false
    }
  },

  'ladderback': {
    name: 'Ladder Back Chair',
    seat: {
      width: 0.44,
      depth: 0.40,
      thickness: 0.03,
      style: 'flat',
      bevel: 0.005
    },
    legs: {
      style: 'straight',
      height: 0.44,
      topRadius: 0.02,
      bottomRadius: 0.02,
      profile: 'rounded-square',
      splayAngle: 0,
      inset: 0.02
    },
    back: {
      style: 'ladder',
      height: 0.50,
      thickness: 0.025,
      angle: 0.1,
      curvature: 0.02,
      slatCount: 4
    },
    stretchers: {
      enabled: true,
      height: 0.15,
      thickness: 0.018,
      sides: true,
      front: true,
      back: false
    }
  },

  'queen-anne': {
    name: 'Queen Anne Chair',
    seat: {
      width: 0.48,
      depth: 0.45,
      thickness: 0.035,
      style: 'contoured',
      bevel: 0.01
    },
    legs: {
      style: 'cabriole',
      height: 0.43,
      topRadius: 0.025,
      bottomRadius: 0.018,
      profile: 'circle',
      splayAngle: 0.08,
      inset: 0.03
    },
    back: {
      style: 'solid',
      height: 0.55,
      thickness: 0.02,
      angle: 0.15,
      curvature: 0.06
    },
    stretchers: {
      enabled: false,
      height: 0,
      thickness: 0,
      sides: false,
      front: false,
      back: false
    }
  },

  'stool': {
    name: 'Bar Stool',
    seat: {
      width: 0.35,
      depth: 0.35,
      thickness: 0.04,
      style: 'contoured',
      bevel: 0.006
    },
    legs: {
      style: 'splayed',
      height: 0.72,
      topRadius: 0.018,
      bottomRadius: 0.015,
      profile: 'circle',
      splayAngle: 0.12,
      inset: 0.03
    },
    back: {
      style: 'solid',
      height: 0,  // No back
      thickness: 0,
      angle: 0,
      curvature: 0
    },
    stretchers: {
      enabled: true,
      height: 0.35,
      thickness: 0.018,
      sides: true,
      front: true,
      back: true
    }
  },

  'lounge': {
    name: 'Lounge Chair',
    seat: {
      width: 0.60,
      depth: 0.55,
      thickness: 0.08,
      style: 'contoured',
      bevel: 0.012
    },
    legs: {
      style: 'reverse-taper',
      height: 0.35,
      topRadius: 0.025,
      bottomRadius: 0.03,
      profile: 'rounded-square',
      splayAngle: 0.08,
      inset: 0.04
    },
    back: {
      style: 'solid',
      height: 0.50,
      thickness: 0.06,
      angle: 0.35,  // ~20 degrees, very reclined
      curvature: 0.10
    },
    stretchers: {
      enabled: false,
      height: 0,
      thickness: 0,
      sides: false,
      front: false,
      back: false
    },
    arms: {
      enabled: true,
      height: 0.20,
      length: 0.45,
      thickness: 0.05,
      style: 'curved'
    }
  }
};

/**
 * Assembles a complete chair from a specification
 */
export function assembleChair(spec: ChairSpec): Mesh {
  const mesh = new Mesh();

  const seatHeight = spec.legs.height;
  const seatThickness = spec.seat.thickness;

  // ============================================
  // 1. CREATE AND POSITION SEAT
  // ============================================
  const seat = createSeat(
    spec.seat.width,
    spec.seat.depth,
    seatThickness,
    spec.seat.style,
    spec.seat.bevel
  );
  // Position seat at leg height
  seat.vertices.forEach((v: Vertex) => v.position.y += seatHeight);
  mesh.merge(seat);

  // ============================================
  // 2. CREATE AND POSITION LEGS
  // ============================================
  const legPositions = calculateLegPositions(
    spec.seat.width,
    spec.seat.depth,
    spec.legs.inset,
    spec.legs.splayAngle
  );

  for (const legPos of legPositions) {
    const leg = createLeg({
      style: spec.legs.style,
      height: spec.legs.height,
      topRadius: spec.legs.topRadius,
      bottomRadius: spec.legs.bottomRadius,
      profile: spec.legs.profile,
      splayAngle: spec.legs.splayAngle
    });

    // Apply splay angle by offsetting bottom relative to top
    const splayOffset = Math.tan(spec.legs.splayAngle) * spec.legs.height;

    leg.vertices.forEach((v: Vertex) => {
      // Calculate splay based on height
      const heightRatio = 1 - (v.position.y / spec.legs.height);
      const splayX = legPos.splayDir.x * splayOffset * heightRatio;
      const splayZ = legPos.splayDir.z * splayOffset * heightRatio;

      v.position.x += legPos.top.x + splayX;
      v.position.z += legPos.top.z + splayZ;
    });

    mesh.merge(leg);
  }

  // ============================================
  // 3. CREATE AND POSITION STRETCHERS
  // ============================================
  if (spec.stretchers.enabled) {
    const stretcherHeight = spec.stretchers.height;
    const stretcherThickness = spec.stretchers.thickness;

    // Calculate stretcher positions based on leg positions at stretcher height
    const heightRatio = 1 - (stretcherHeight / spec.legs.height);
    const splayOffset = Math.tan(spec.legs.splayAngle) * spec.legs.height * heightRatio;

    if (spec.stretchers.sides) {
      // Left side stretcher
      const leftStretcher = createStretcher(spec.seat.depth - spec.legs.inset * 2, stretcherThickness);
      leftStretcher.vertices.forEach((v: Vertex) => {
        const temp = v.position.y;
        v.position.y = stretcherHeight;
        v.position.z = temp - spec.seat.depth / 2 + spec.legs.inset;
        v.position.x = -spec.seat.width / 2 + spec.legs.inset - splayOffset;
      });
      mesh.merge(leftStretcher);

      // Right side stretcher
      const rightStretcher = createStretcher(spec.seat.depth - spec.legs.inset * 2, stretcherThickness);
      rightStretcher.vertices.forEach((v: Vertex) => {
        const temp = v.position.y;
        v.position.y = stretcherHeight;
        v.position.z = temp - spec.seat.depth / 2 + spec.legs.inset;
        v.position.x = spec.seat.width / 2 - spec.legs.inset + splayOffset;
      });
      mesh.merge(rightStretcher);
    }

    if (spec.stretchers.front) {
      const frontStretcher = createStretcher(spec.seat.width - spec.legs.inset * 2, stretcherThickness);
      frontStretcher.vertices.forEach((v: Vertex) => {
        const temp = v.position.y;
        v.position.y = stretcherHeight;
        v.position.x = temp - spec.seat.width / 2 + spec.legs.inset;
        v.position.z = spec.seat.depth / 2 - spec.legs.inset + splayOffset;
      });
      mesh.merge(frontStretcher);
    }

    if (spec.stretchers.back) {
      const backStretcher = createStretcher(spec.seat.width - spec.legs.inset * 2, stretcherThickness);
      backStretcher.vertices.forEach((v: Vertex) => {
        const temp = v.position.y;
        v.position.y = stretcherHeight;
        v.position.x = temp - spec.seat.width / 2 + spec.legs.inset;
        v.position.z = -spec.seat.depth / 2 + spec.legs.inset - splayOffset;
      });
      mesh.merge(backStretcher);
    }
  }

  // ============================================
  // 4. CREATE AND POSITION BACK
  // ============================================
  if (spec.back.height > 0) {
    const back = createBack({
      style: spec.back.style,
      width: spec.seat.width * 0.9,
      height: spec.back.height,
      thickness: spec.back.thickness,
      curvature: spec.back.curvature,
      spindleCount: spec.back.spindleCount,
      slatCount: spec.back.slatCount
    });

    // Apply recline angle
    const reclineAngle = spec.back.angle;
    back.vertices.forEach((v: Vertex) => {
      // Rotate around X axis at seat level
      const y = v.position.y;
      const z = v.position.z;
      v.position.y = y * Math.cos(reclineAngle) - z * Math.sin(reclineAngle);
      v.position.z = y * Math.sin(reclineAngle) + z * Math.cos(reclineAngle);

      // Position at back of seat
      v.position.y += seatHeight + seatThickness;
      v.position.z -= spec.seat.depth / 2 - spec.back.thickness / 2;
    });

    mesh.merge(back);
  }

  // ============================================
  // 5. CREATE AND POSITION ARMS (if enabled)
  // ============================================
  if (spec.arms?.enabled) {
    const armHeight = seatHeight + seatThickness + spec.arms.height;

    // Left arm
    const leftArm = createArmrest(
      spec.arms.length,
      spec.arms.height,
      spec.arms.thickness,
      spec.arms.style
    );
    leftArm.vertices.forEach((v: Vertex) => {
      v.position.x -= spec.seat.width / 2 - spec.arms!.thickness / 2;
      v.position.y += armHeight;
      v.position.z += spec.seat.depth / 2 - spec.arms!.length / 2;
    });
    mesh.merge(leftArm);

    // Right arm
    const rightArm = createArmrest(
      spec.arms.length,
      spec.arms.height,
      spec.arms.thickness,
      spec.arms.style
    );
    rightArm.vertices.forEach((v: Vertex) => {
      v.position.x += spec.seat.width / 2 - spec.arms!.thickness / 2;
      v.position.y += armHeight;
      v.position.z += spec.seat.depth / 2 - spec.arms!.length / 2;
    });
    mesh.merge(rightArm);
  }

  mesh.calculateNormals();
  return mesh;
}

/**
 * Calculate leg attachment positions with splay directions
 */
function calculateLegPositions(
  seatWidth: number,
  seatDepth: number,
  inset: number,
  _splayAngle: number
): Array<{ top: Vec3; splayDir: Vec3 }> {
  const hw = seatWidth / 2 - inset;
  const hd = seatDepth / 2 - inset;

  return [
    { top: new Vec3(-hw, 0, -hd), splayDir: new Vec3(-1, 0, -1).normalize() },  // Back left
    { top: new Vec3(hw, 0, -hd), splayDir: new Vec3(1, 0, -1).normalize() },    // Back right
    { top: new Vec3(-hw, 0, hd), splayDir: new Vec3(-1, 0, 1).normalize() },    // Front left
    { top: new Vec3(hw, 0, hd), splayDir: new Vec3(1, 0, 1).normalize() }       // Front right
  ];
}

/**
 * Generate a random chair variant within style constraints
 */
export function generateRandomChair(
  baseStyle: keyof typeof CHAIR_STYLES,
  random: Random,
  variationAmount: number = 0.1  // 0-1, how much to vary from base
): Mesh {
  const base = { ...CHAIR_STYLES[baseStyle] };

  // Apply random variations
  const spec: ChairSpec = {
    ...base,
    seat: {
      ...base.seat,
      width: base.seat.width * (1 + random.range(-variationAmount, variationAmount)),
      depth: base.seat.depth * (1 + random.range(-variationAmount, variationAmount)),
      thickness: base.seat.thickness * (1 + random.range(-variationAmount * 0.5, variationAmount * 0.5))
    },
    legs: {
      ...base.legs,
      height: base.legs.height * (1 + random.range(-variationAmount * 0.5, variationAmount * 0.5)),
      topRadius: base.legs.topRadius * (1 + random.range(-variationAmount, variationAmount)),
      splayAngle: base.legs.splayAngle * (1 + random.range(-variationAmount, variationAmount))
    },
    back: {
      ...base.back,
      height: base.back.height * (1 + random.range(-variationAmount * 0.5, variationAmount * 0.5)),
      angle: base.back.angle * (1 + random.range(-variationAmount, variationAmount)),
      curvature: base.back.curvature * (1 + random.range(-variationAmount, variationAmount))
    }
  };

  return assembleChair(spec);
}
