import { Mesh } from '../../geometry/Mesh';
import { EdgeLoop } from '../../geometry/EdgeLoop';
import { Vec3 } from '../../core/Vec3';
import { MeshOperations } from '../../geometry/MeshOperations';

export interface ChairDesign {
  seatHeight: number;
  seatWidth: number;
  seatDepth: number;
  backHeight: number;
  legStyle: 'simple' | 'tapered';
}

export class ChairGenerator {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static createSimpleChair(style: string = 'default'): Mesh {
    const design = this.getDesign(style);
    const mesh = new Mesh();

    const seatThickness = 0.05;
    const legThickness = 0.04;
    const legHeight = design.seatHeight - seatThickness;

    // Create seat
    const seat = this.createSeat(design.seatWidth, design.seatDepth, seatThickness);
    seat.vertices.forEach(v => v.position.y += legHeight);
    mesh.merge(seat);

    // Create legs - properly inset from seat edges
    const legInset = legThickness / 2 + 0.02; // Small inset for stability
    const legPositions = [
      new Vec3(-design.seatWidth / 2 + legInset, 0, -design.seatDepth / 2 + legInset),
      new Vec3(design.seatWidth / 2 - legInset, 0, -design.seatDepth / 2 + legInset),
      new Vec3(-design.seatWidth / 2 + legInset, 0, design.seatDepth / 2 - legInset),
      new Vec3(design.seatWidth / 2 - legInset, 0, design.seatDepth / 2 - legInset)
    ];

    for (const pos of legPositions) {
      const leg = this.createLeg(legThickness, legHeight, design.legStyle);
      leg.vertices.forEach(v => {
        v.position.x += pos.x;
        v.position.z += pos.z;
      });
      mesh.merge(leg);
    }

    // Create back - positioned at back edge of seat
    const backThickness = 0.04;
    const back = this.createBack(
      design.seatWidth,
      design.backHeight,
      backThickness,
      legHeight + seatThickness
    );
    back.vertices.forEach(v => v.position.z -= design.seatDepth / 2 - backThickness / 2);
    mesh.merge(back);

    mesh.calculateNormals();
    return mesh;
  }

  private static getDesign(style: string): ChairDesign {
    const designs: Record<string, ChairDesign> = {
      default: {
        seatHeight: 0.45,
        seatWidth: 0.45,
        seatDepth: 0.45,
        backHeight: 0.4,
        legStyle: 'simple'
      },
      dining: {
        seatHeight: 0.46,
        seatWidth: 0.48,
        seatDepth: 0.46,
        backHeight: 0.5,
        legStyle: 'tapered'
      },
      lounge: {
        seatHeight: 0.40,
        seatWidth: 0.65,
        seatDepth: 0.60,
        backHeight: 0.55,
        legStyle: 'simple'
      }
    };
    return designs[style] || designs.default;
  }

  private static createSeat(width: number, depth: number, thickness: number): Mesh {
    return MeshOperations.createBox(width, thickness, depth);
  }

  private static createLeg(thickness: number, height: number, style: string): Mesh {
    if (style === 'tapered') {
      const bottom = EdgeLoop.createCircle(Vec3.zero(), thickness / 2, 8);
      const top = EdgeLoop.createCircle(new Vec3(0, height, 0), thickness / 2 * 0.7, 8);
      const mesh = MeshOperations.loft([bottom, top]);
      MeshOperations.cap(bottom, mesh, true);
      MeshOperations.cap(top, mesh, false);
      return mesh;
    }
    return MeshOperations.createBox(thickness, height, thickness);
  }

  private static createBack(width: number, height: number, thickness: number, yOffset: number): Mesh {
    const back = MeshOperations.createBox(width * 0.9, height, thickness);
    back.vertices.forEach(v => v.position.y += yOffset + height / 2);
    return back;
  }
}

