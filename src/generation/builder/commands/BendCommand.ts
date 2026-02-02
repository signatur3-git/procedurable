/**
 * BendCommand - Bend mesh around an axis
 *
 * Bends geometry along a specified axis for creating curved, arched,
 * or organic forms from straight geometry.
 *
 * YAML usage:
 *   - bend: curved_leg
 *     axis: y              # Axis along which bending occurs
 *     angle: 0.3           # Bend angle in radians (or expression)
 *     center:              # Optional center point
 *       x: 0
 *       y: 0
 *       z: 0
 *
 * Positive angles bend toward the positive perpendicular direction.
 * For Y axis bending, the mesh curves in the XZ plane.
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand } from '../YamlBuilderTypes';
import { MeshOperations } from '../../../platform/geometry/MeshOperations';
import { Vec3 } from '../../../platform/math/Vec3';

interface BendCommandDef {
  bend: string;                           // Trace name
  axis?: 'x' | 'y' | 'z';                 // Bend axis (default: 'y')
  angle?: number | string;                // Bend angle in radians (can be expression)
  center?: { x?: number | string; y?: number | string; z?: number | string };
}

export class BendCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'bend';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const bendCmd = cmd as unknown as BendCommandDef;
    const { builder, evaluateExpression } = context;

    // Evaluate parameters
    const axis = bendCmd.axis ?? 'y';
    const angle = evaluateExpression(bendCmd.angle ?? 0);

    // Evaluate optional center point
    let center: Vec3 | undefined;
    if (bendCmd.center) {
      center = new Vec3(
        evaluateExpression(bendCmd.center.x ?? 0),
        evaluateExpression(bendCmd.center.y ?? 0),
        evaluateExpression(bendCmd.center.z ?? 0)
      );
    }

    // Get current mesh and apply bend
    const currentMesh = builder.getMesh();
    const bent = MeshOperations.bend(currentMesh, axis, angle, center);

    // Replace mesh with bent version
    builder.replaceMesh(bent);

    // Trace the operation
    builder.trace(`bend:${bendCmd.bend}`, {
      axis,
      angle,
      center: center ? { x: center.x, y: center.y, z: center.z } : 'auto',
      vertexCount: bent.vertices.length
    });
  }
}
