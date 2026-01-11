﻿import { Mesh } from '../../geometry/Mesh';
import { Vec3 } from '../../core/Vec3';
import { MeshOperations } from '../../geometry/MeshOperations';
import { EdgeLoop } from '../../geometry/EdgeLoop';
export interface TableDesign {
  height: number;
  topWidth: number;
  topDepth: number;
  topThickness: number;
  legThickness: number;
  shape: 'rectangular' | 'round';
}
export class TableGenerator {
  static createTable(style: string = 'default'): Mesh {
    const design = this.getDesign(style);
    const mesh = new Mesh();
    if (design.shape === 'round') {
      const top = this.createRoundTop(design.topWidth / 2, design.topThickness);
      top.vertices.forEach(v => v.position.y += design.height - design.topThickness);
      mesh.merge(top);
    } else {
      const top = MeshOperations.createBox(design.topWidth, design.topThickness, design.topDepth);
      top.vertices.forEach(v => v.position.y += design.height - design.topThickness / 2);
      mesh.merge(top);
    }
    const legHeight = design.height - design.topThickness;
    const legInset = Math.min(design.topWidth, design.topDepth) * 0.15;
    const legPositions = [
      new Vec3(-design.topWidth / 2 + legInset, 0, -design.topDepth / 2 + legInset),
      new Vec3(design.topWidth / 2 - legInset, 0, -design.topDepth / 2 + legInset),
      new Vec3(-design.topWidth / 2 + legInset, 0, design.topDepth / 2 - legInset),
      new Vec3(design.topWidth / 2 - legInset, 0, design.topDepth / 2 - legInset)
    ];
    for (const pos of legPositions) {
      const leg = this.createLeg(design.legThickness, legHeight);
      leg.vertices.forEach(v => {
        v.position.x += pos.x;
        v.position.z += pos.z;
      });
      mesh.merge(leg);
    }
    mesh.calculateNormals();
    return mesh;
  }
  private static getDesign(style: string): TableDesign {
    const designs: Record<string, TableDesign> = {
      default: {
        height: 0.75,
        topWidth: 1.2,
        topDepth: 0.8,
        topThickness: 0.04,
        legThickness: 0.06,
        shape: 'rectangular'
      },
      dining: {
        height: 0.76,
        topWidth: 1.8,
        topDepth: 1.0,
        topThickness: 0.05,
        legThickness: 0.08,
        shape: 'rectangular'
      },
      coffee: {
        height: 0.45,
        topWidth: 1.2,
        topDepth: 0.7,
        topThickness: 0.03,
        legThickness: 0.05,
        shape: 'rectangular'
      },
      round: {
        height: 0.75,
        topWidth: 1.0,
        topDepth: 1.0,
        topThickness: 0.04,
        legThickness: 0.06,
        shape: 'round'
      }
    };
    return designs[style] || designs.default;
  }
  private static createRoundTop(radius: number, thickness: number): Mesh {
    const bottom = EdgeLoop.createCircle(Vec3.zero(), radius, 24);
    const top = EdgeLoop.createCircle(new Vec3(0, thickness, 0), radius, 24);
    const mesh = MeshOperations.loft([bottom, top]);
    MeshOperations.cap(bottom, mesh, true);
    MeshOperations.cap(top, mesh, false);
    return mesh;
  }
  private static createLeg(thickness: number, height: number): Mesh {
    const bottom = EdgeLoop.createCircle(Vec3.zero(), thickness / 2, 8);
    const top = EdgeLoop.createCircle(new Vec3(0, height, 0), thickness / 2 * 0.8, 8);
    const mesh = MeshOperations.loft([bottom, top]);
    MeshOperations.cap(bottom, mesh, true);
    MeshOperations.cap(top, mesh, false);
    return mesh;
  }
}
