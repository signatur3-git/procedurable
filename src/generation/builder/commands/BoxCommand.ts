/**
 * BoxCommand - Creates a box primitive with proper UVs
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand, YamlPosition } from '../YamlBuilderTypes';
import { resolveGeometryMaterial } from '../MaterialResolver';
import { MeshOperations } from '../../../platform/geometry/MeshOperations';
import * as MeshTransform from '../../../platform/geometry/MeshTransform';
import { Vec3 } from '../../../platform/math/Vec3';

interface BoxCommandDef {
  box: {
    name: string;
    center: YamlPosition;
    size: YamlPosition;
    color?: string;
    uv_mode?: 'normalized' | 'world_scale';
  };
}

export class BoxCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'box';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const boxCmd = cmd as BoxCommandDef;
    const boxDef = boxCmd.box;
    const name = boxDef.name;

    const { builder, materials, materialSlots, evaluateExpression } = context;

    // Evaluate center and size
    const cx = evaluateExpression(String(boxDef.center.x));
    const cy = evaluateExpression(String(boxDef.center.y));
    const cz = evaluateExpression(String(boxDef.center.z));
    const sx = evaluateExpression(String(boxDef.size.x));
    const sy = evaluateExpression(String(boxDef.size.y));
    const sz = evaluateExpression(String(boxDef.size.z));

    // Resolve color and material slot
    const { color, materialSlotIndex } = resolveGeometryMaterial(boxDef.color, materials, materialSlots, builder.mesh);

    // Get UV mode (default to normalized for backwards compatibility)
    const uvMode = boxDef.uv_mode || 'normalized';

    // Create box with UVs at origin, then translate to center
    let boxMesh = MeshOperations.createBox(sx, sy, sz, uvMode);

    // Translate to center
    if (cx !== 0 || cy !== 0 || cz !== 0) {
      boxMesh = MeshTransform.translate(boxMesh, new Vec3(cx, cy, cz));
    }

    // Apply color and material to all faces
    for (const face of boxMesh.faces) {
      if (color) {
        face.color = color;
      }
      if (materialSlotIndex !== undefined) {
        face.materialSlotIndex = materialSlotIndex;
      }
    }

    // Merge box mesh into builder's mesh
    builder.getMesh().merge(boxMesh);

    // Trace the box
    builder.trace(`box:${name}`, {
      center: { x: cx, y: cy, z: cz },
      size: { x: sx, y: sy, z: sz },
      vertices: boxMesh.vertices.length,
      faces: boxMesh.faces.length,
      hasUVs: true
    });
  }
}
