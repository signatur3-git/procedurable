/**
 * Table Designer - CAD-based table generation system
 */

import { Mesh } from '../geometry/Mesh';
import { Vec3 } from '../core/Vec3';
import { Random } from '../core/Random';
import { createLeg, LegStyle } from './furnitureParts';
import { createPanel, ProfileType } from './primitives';
import { EdgeLoop } from '../geometry/EdgeLoop';
import { MeshOperations } from '../geometry/MeshOperations';
import type { Vertex } from '../geometry/Vertex';

export type TableTopShape = 'rectangular' | 'round' | 'oval' | 'square';

export interface TableSpec {
  name: string;
  top: {
    shape: TableTopShape;
    width: number;
    depth: number;
    thickness: number;
    bevel: number;
    overhang: number;
  };
  legs: {
    style: LegStyle;
    count: 4 | 3 | 1;
    height: number;
    topRadius: number;
    bottomRadius: number;
    profile: ProfileType;
    splayAngle: number;
  };
  apron?: {
    enabled: boolean;
    height: number;
    thickness: number;
    inset: number;
  };
  stretchers?: {
    enabled: boolean;
    style: 'H' | 'X' | 'box';
    height: number;
    thickness: number;
  };
}

export const TABLE_STYLES: Record<string, TableSpec> = {
  'dining': {
    name: 'Dining Table',
    top: { shape: 'rectangular', width: 1.60, depth: 0.90, thickness: 0.04, bevel: 0.005, overhang: 0.08 },
    legs: { style: 'tapered', count: 4, height: 0.72, topRadius: 0.035, bottomRadius: 0.025, profile: 'rounded-square', splayAngle: 0.03 },
    apron: { enabled: true, height: 0.08, thickness: 0.025, inset: 0.03 }
  },
  'coffee': {
    name: 'Coffee Table',
    top: { shape: 'rectangular', width: 1.20, depth: 0.60, thickness: 0.035, bevel: 0.004, overhang: 0.06 },
    legs: { style: 'reverse-taper', count: 4, height: 0.42, topRadius: 0.02, bottomRadius: 0.025, profile: 'rounded-square', splayAngle: 0.05 }
  },
  'round-dining': {
    name: 'Round Dining Table',
    top: { shape: 'round', width: 1.20, depth: 1.20, thickness: 0.04, bevel: 0.006, overhang: 0.10 },
    legs: { style: 'turned', count: 4, height: 0.72, topRadius: 0.04, bottomRadius: 0.03, profile: 'circle', splayAngle: 0.06 },
    apron: { enabled: true, height: 0.06, thickness: 0.02, inset: 0.04 }
  },
  'side': {
    name: 'Side Table',
    top: { shape: 'round', width: 0.45, depth: 0.45, thickness: 0.025, bevel: 0.004, overhang: 0.05 },
    legs: { style: 'sabre', count: 3, height: 0.55, topRadius: 0.02, bottomRadius: 0.015, profile: 'circle', splayAngle: 0.10 }
  }
};

function createTableTop(spec: TableSpec['top']): Mesh {
  if (spec.shape === 'round') {
    const radius = spec.width / 2;
    const bottom = EdgeLoop.createCircle(Vec3.zero(), radius, 32);
    const top = EdgeLoop.createCircle(new Vec3(0, spec.thickness, 0), radius, 32);
    const mesh = MeshOperations.loft([bottom, top]);
    MeshOperations.cap(bottom, mesh, true);
    MeshOperations.cap(top, mesh, false);
    mesh.calculateNormals();
    return mesh;
  }
  return createPanel(spec.width, spec.depth, spec.thickness, spec.bevel);
}

export function assembleTable(spec: TableSpec): Mesh {
  const mesh = new Mesh();
  const topHeight = spec.legs.height;

  // Table top
  const top = createTableTop(spec.top);
  top.vertices.forEach((v: Vertex) => v.position.y += topHeight);
  mesh.merge(top);

  // Legs
  const legPositions = calculateTableLegPositions(spec);
  for (const legPos of legPositions) {
    const leg = createLeg({
      style: spec.legs.style,
      height: spec.legs.height,
      topRadius: spec.legs.topRadius,
      bottomRadius: spec.legs.bottomRadius,
      profile: spec.legs.profile,
      splayAngle: spec.legs.splayAngle
    });

    const splayOffset = Math.tan(spec.legs.splayAngle) * spec.legs.height;
    leg.vertices.forEach((v: Vertex) => {
      const heightRatio = 1 - (v.position.y / spec.legs.height);
      v.position.x += legPos.top.x + legPos.splayDir.x * splayOffset * heightRatio;
      v.position.z += legPos.top.z + legPos.splayDir.z * splayOffset * heightRatio;
    });
    mesh.merge(leg);
  }

  mesh.calculateNormals();
  return mesh;
}

function calculateTableLegPositions(spec: TableSpec): Array<{ top: Vec3; splayDir: Vec3 }> {
  const legInset = spec.top.overhang;

  if (spec.legs.count === 1) {
    return [{ top: Vec3.zero(), splayDir: Vec3.zero() }];
  }

  if (spec.legs.count === 3) {
    const radius = Math.min(spec.top.width, spec.top.depth) / 2 - legInset;
    const positions: Array<{ top: Vec3; splayDir: Vec3 }> = [];
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
      positions.push({
        top: new Vec3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
        splayDir: new Vec3(Math.cos(angle), 0, Math.sin(angle))
      });
    }
    return positions;
  }

  // Four legs
  const hw = spec.top.width / 2 - legInset;
  const hd = spec.top.depth / 2 - legInset;
  return [
    { top: new Vec3(-hw, 0, -hd), splayDir: new Vec3(-1, 0, -1).normalize() },
    { top: new Vec3(hw, 0, -hd), splayDir: new Vec3(1, 0, -1).normalize() },
    { top: new Vec3(-hw, 0, hd), splayDir: new Vec3(-1, 0, 1).normalize() },
    { top: new Vec3(hw, 0, hd), splayDir: new Vec3(1, 0, 1).normalize() }
  ];
}

export function generateRandomTable(baseStyle: keyof typeof TABLE_STYLES, random: Random, variationAmount: number = 0.1): Mesh {
  const base = TABLE_STYLES[baseStyle];
  const spec: TableSpec = {
    ...base,
    top: {
      ...base.top,
      width: base.top.width * (1 + random.range(-variationAmount, variationAmount)),
      depth: base.top.depth * (1 + random.range(-variationAmount, variationAmount))
    },
    legs: {
      ...base.legs,
      height: base.legs.height * (1 + random.range(-variationAmount * 0.3, variationAmount * 0.3))
    }
  };
  return assembleTable(spec);
}
