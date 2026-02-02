/**
 * TaperCommand - Scale mesh progressively along an axis
 *
 * Creates tapered/cone-like shapes from uniform geometry by scaling
 * perpendicular dimensions based on position along the taper axis.
 *
 * YAML usage:
 *   - taper: cone_shape
 *     axis: y                # Axis along which tapering occurs
 *     start_scale: 1.0       # Scale at minimum axis position (or expression)
 *     end_scale: 0.5         # Scale at maximum axis position (or expression)
 *     center:                # Optional center point
 *       x: 0
 *       y: 0
 *       z: 0
 *
 * Example: A cylinder with taper(axis=y, start=1, end=0) becomes a cone.
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand } from '../YamlBuilderTypes';
import { MeshOperations } from '../../../platform/geometry/MeshOperations';
import { Vec3 } from '../../../platform/math/Vec3';

interface TaperCommandDef {
  taper: string;                           // Trace name
  axis?: 'x' | 'y' | 'z';                  // Taper axis (default: 'y')
  start_scale?: number | string;           // Scale at min (default: 1.0)
  end_scale?: number | string;             // Scale at max (default: 1.0)
  center?: { x?: number | string; y?: number | string; z?: number | string };
}

export class TaperCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'taper';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const taperCmd = cmd as unknown as TaperCommandDef;
    const { builder, evaluateExpression } = context;

    // Evaluate parameters
    const axis = taperCmd.axis ?? 'y';
    const startScale = evaluateExpression(taperCmd.start_scale ?? 1.0);
    const endScale = evaluateExpression(taperCmd.end_scale ?? 1.0);

    // Evaluate optional center point
    let center: Vec3 | undefined;
    if (taperCmd.center) {
      center = new Vec3(
        evaluateExpression(taperCmd.center.x ?? 0),
        evaluateExpression(taperCmd.center.y ?? 0),
        evaluateExpression(taperCmd.center.z ?? 0)
      );
    }

    // Get current mesh and apply taper
    const currentMesh = builder.getMesh();
    const tapered = MeshOperations.taper(currentMesh, axis, startScale, endScale, center);

    // Replace mesh with tapered version
    builder.replaceMesh(tapered);

    // Trace the operation
    builder.trace(`taper:${taperCmd.taper}`, {
      axis,
      startScale,
      endScale,
      center: center ? { x: center.x, y: center.y, z: center.z } : 'auto',
      vertexCount: tapered.vertices.length
    });
  }
}
