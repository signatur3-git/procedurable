/**
 * TwistCommand - Twist mesh around an axis
 *
 * Twists geometry along a specified axis for creating spiral,
 * helical, or stylized forms.
 *
 * YAML usage:
 *   - twist: spiral_column
 *     axis: y              # Axis to twist around
 *     angle: 1.57          # Total twist angle in radians (or expression)
 *     center:              # Optional center point
 *       x: 0
 *       y: 0
 *       z: 0
 *
 * The twist is applied progressively along the axis:
 * - Center of mesh = no rotation
 * - Ends of mesh = ±angle/2 rotation
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand } from '../YamlBuilderTypes';
import { MeshOperations } from '../../../platform/geometry/MeshOperations';
import { Vec3 } from '../../../platform/math/Vec3';

interface TwistCommandDef {
  twist: string;                           // Trace name
  axis?: 'x' | 'y' | 'z';                  // Twist axis (default: 'y')
  angle?: number | string;                 // Total twist angle in radians (can be expression)
  center?: { x?: number | string; y?: number | string; z?: number | string };
}

export class TwistCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'twist';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const twistCmd = cmd as unknown as TwistCommandDef;
    const { builder, evaluateExpression } = context;

    // Evaluate parameters
    const axis = twistCmd.axis ?? 'y';
    const angle = evaluateExpression(twistCmd.angle ?? 0);

    // Evaluate optional center point
    let center: Vec3 | undefined;
    if (twistCmd.center) {
      center = new Vec3(
        evaluateExpression(twistCmd.center.x ?? 0),
        evaluateExpression(twistCmd.center.y ?? 0),
        evaluateExpression(twistCmd.center.z ?? 0)
      );
    }

    // Get current mesh and apply twist
    const currentMesh = builder.getMesh();
    const twisted = MeshOperations.twist(currentMesh, axis, angle, center);

    // Replace mesh with twisted version
    builder.replaceMesh(twisted);

    // Trace the operation
    builder.trace(`twist:${twistCmd.twist}`, {
      axis,
      angle,
      center: center ? { x: center.x, y: center.y, z: center.z } : 'auto',
      vertexCount: twisted.vertices.length
    });
  }
}
