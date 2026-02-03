/**
 * BevelCommand - Apply bevel/chamfer to mesh edges
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand } from '../YamlBuilderTypes';
import { MeshOperations } from '../../../platform/geometry/MeshOperations';

interface BevelCommandDef {
  bevel: string;
  mesh: string;
  width: number | string;
  segments?: number | string;
  angle_threshold?: number | string;
}

export class BevelCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'bevel';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const bevelCmd = cmd as BevelCommandDef;
    const { builder, evaluateExpression } = context;

    // Get bevel parameters
    const width = evaluateExpression(bevelCmd.width);

    const segments = bevelCmd.segments !== undefined
      ? Math.round(evaluateExpression(bevelCmd.segments))
      : 1;

    // Default angle threshold: 30 degrees (PI/6) - bevel edges sharper than this
    const angleThreshold = bevelCmd.angle_threshold !== undefined
      ? evaluateExpression(bevelCmd.angle_threshold)
      : Math.PI / 6;

    // Weld coincident vertices for proper edge topology (needed for 24-vertex boxes etc.)
    const currentMesh = builder.getMesh().weldVertices();

    // Get edges to bevel based on angle threshold
    const edgesToBevel = currentMesh.getSharpEdges(angleThreshold);

    if (edgesToBevel.length > 0) {
      // Apply bevel
      const beveledMesh = MeshOperations.bevel(currentMesh, edgesToBevel, width, segments);

      // Apply box projection UVs to ensure all vertices have UVs
      // This is necessary because:
      // 1. weldVertices() produces a mesh without UVs
      // 2. Bevel only adds UVs to newly created vertices
      // Box projection gives consistent UVs for all vertices
      MeshOperations.applyBoxProjectUVs(beveledMesh);

      // Replace the mesh
      builder.replaceMesh(beveledMesh);
    }
  }
}
