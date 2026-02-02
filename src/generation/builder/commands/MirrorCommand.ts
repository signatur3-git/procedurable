/**
 * MirrorCommand - Mirror mesh across a plane
 *
 * Creates a mirrored copy of geometry, optionally welding it with the original.
 * Useful for symmetric objects: build half, mirror to get the complete form.
 *
 * YAML usage:
 *   - mirror: symmetric_chair
 *     plane: x              # Mirror across YZ plane (x=0)
 *     weld: true            # Merge with original (optional, default false)
 *
 *   - mirror: custom_mirror
 *     plane:
 *       point: { x: 0.5, y: 0, z: 0 }
 *       normal: { x: 1, y: 0, z: 0 }
 *     weld: false
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand } from '../YamlBuilderTypes';
import { MeshOperations } from '../../../platform/geometry/MeshOperations';
import { Vec3 } from '../../../platform/math/Vec3';

interface MirrorCommandDef {
  mirror: string;                           // Trace name
  plane?: 'x' | 'y' | 'z' | {
    point?: { x?: number | string; y?: number | string; z?: number | string };
    normal?: { x?: number | string; y?: number | string; z?: number | string };
  };
  weld?: boolean;
}

export class MirrorCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'mirror';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const mirrorCmd = cmd as unknown as MirrorCommandDef;
    const { builder, evaluateExpression } = context;

    // Parse plane definition
    let plane: 'x' | 'y' | 'z' | { point: Vec3; normal: Vec3 };

    if (!mirrorCmd.plane || typeof mirrorCmd.plane === 'string') {
      // Simple axis plane
      plane = mirrorCmd.plane ?? 'x';
    } else {
      // Custom plane with point and normal
      const p = mirrorCmd.plane;
      const point = new Vec3(
        evaluateExpression(p.point?.x ?? 0),
        evaluateExpression(p.point?.y ?? 0),
        evaluateExpression(p.point?.z ?? 0)
      );
      const normal = new Vec3(
        evaluateExpression(p.normal?.x ?? 1),
        evaluateExpression(p.normal?.y ?? 0),
        evaluateExpression(p.normal?.z ?? 0)
      );
      plane = { point, normal };
    }

    const weld = mirrorCmd.weld ?? false;

    // Get current mesh and apply mirror
    const currentMesh = builder.getMesh();
    const mirrored = MeshOperations.mirror(currentMesh, plane, weld);

    // Replace mesh with mirrored version
    builder.replaceMesh(mirrored);

    // Trace the operation
    const planeDesc = typeof plane === 'string' ? plane : `custom`;
    builder.trace(`mirror:${mirrorCmd.mirror}`, {
      plane: planeDesc,
      weld,
      vertexCount: mirrored.vertices.length,
      faceCount: mirrored.faces.length
    });
  }
}
