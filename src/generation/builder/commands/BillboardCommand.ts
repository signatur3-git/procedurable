/**
 * BillboardCommand - Creates billboard (camera-facing quad) primitives (G7-001)
 *
 * Billboards are quads that face the camera in the final render.
 * Common uses: smoke, sparkles, glow effects, distant vegetation.
 *
 * In authoring, billboards are simple quads with a flag indicating
 * they should face the camera at render time.
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand, YamlPosition } from '../YamlBuilderTypes';
import { resolveGeometryMaterial } from '../MaterialResolver';
import { Mesh } from '../../../platform/geometry/Mesh';
import { Vertex } from '../../../platform/geometry/Vertex';
import { Face } from '../../../platform/geometry/Face';
import { Vec3 } from '../../../platform/math/Vec3';
import * as MeshTransform from '../../../platform/geometry/MeshTransform';

/**
 * Billboard facing modes
 */
export type BillboardFacing = 'camera' | 'axis_x' | 'axis_y' | 'axis_z';

interface BillboardCommandDef {
  billboard: {
    name: string;
    center: YamlPosition;
    width: number | string;
    height: number | string;
    /** How the billboard should face:
     * - 'camera': Always face the camera (spherical billboard)
     * - 'axis_x': Rotate around X axis to face camera (cylindrical)
     * - 'axis_y': Rotate around Y axis to face camera (cylindrical, most common for vegetation)
     * - 'axis_z': Rotate around Z axis to face camera (cylindrical)
     */
    facing?: BillboardFacing;
    color?: string;
    /** Pivot point for rotation: 'center' (default), 'bottom' (for vegetation) */
    pivot?: 'center' | 'bottom';
  };
}

/**
 * Create a billboard quad mesh
 *
 * @param width Width of the billboard
 * @param height Height of the billboard
 * @param pivot Where the pivot point is ('center' or 'bottom')
 * @returns Mesh representing the billboard quad
 */
export function createBillboardQuad(width: number, height: number, pivot: 'center' | 'bottom' = 'center'): Mesh {
  const mesh = new Mesh();

  const hw = width / 2;
  const hh = height / 2;

  // Vertical offset based on pivot
  // For 'bottom' pivot, the quad's bottom edge is at Y=0
  // For 'center' pivot, the quad's center is at Y=0
  const yOffset = pivot === 'bottom' ? hh : 0;

  // Create quad vertices in XY plane (facing +Z)
  // With UVs for texturing (0,0 at bottom-left, 1,1 at top-right)
  const v0 = new Vertex(new Vec3(-hw, -hh + yOffset, 0), { uv: [0, 0] });
  const v1 = new Vertex(new Vec3(hw, -hh + yOffset, 0), { uv: [1, 0] });
  const v2 = new Vertex(new Vec3(hw, hh + yOffset, 0), { uv: [1, 1] });
  const v3 = new Vertex(new Vec3(-hw, hh + yOffset, 0), { uv: [0, 1] });

  mesh.addVertex(v0);
  mesh.addVertex(v1);
  mesh.addVertex(v2);
  mesh.addVertex(v3);

  // Front face (CCW winding when viewed from +Z)
  mesh.addFace(new Face([0, 1, 2, 3]));

  // Back face (for double-sided rendering)
  mesh.addFace(new Face([3, 2, 1, 0]));

  return mesh;
}

export class BillboardCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'billboard';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const billboardCmd = cmd as BillboardCommandDef;
    const def = billboardCmd.billboard;
    const name = def.name;

    const { builder, materials, materialSlots, evaluateExpression } = context;

    // Evaluate center position
    const cx = evaluateExpression(String(def.center.x));
    const cy = evaluateExpression(String(def.center.y));
    const cz = evaluateExpression(String(def.center.z));

    // Evaluate dimensions
    const width = evaluateExpression(String(def.width));
    const height = evaluateExpression(String(def.height));

    // Get facing mode (default to camera)
    const facing: BillboardFacing = def.facing || 'camera';

    // Get pivot mode (default to center)
    const pivot = def.pivot || 'center';

    // Resolve color and material slot
    const { color, materialSlotIndex } = resolveGeometryMaterial(def.color, materials, materialSlots, builder.mesh);

    // Create the billboard quad
    let billboardMesh = createBillboardQuad(width, height, pivot);

    // Translate to center position
    if (cx !== 0 || cy !== 0 || cz !== 0) {
      billboardMesh = MeshTransform.translate(billboardMesh, new Vec3(cx, cy, cz));
    }

    // Apply color and material to all faces
    for (const face of billboardMesh.faces) {
      if (color) {
        face.color = color;
      }
      if (materialSlotIndex !== undefined) {
        face.materialSlotIndex = materialSlotIndex;
      }
    }

    // Merge billboard mesh into builder's mesh
    builder.getMesh().merge(billboardMesh);

    // Trace the billboard with metadata for PSD/export
    builder.trace(`billboard:${name}`, {
      center: { x: cx, y: cy, z: cz },
      width,
      height,
      facing,
      pivot,
      vertices: billboardMesh.vertices.length,
      faces: billboardMesh.faces.length,
      type: 'billboard'
    });
  }
}
