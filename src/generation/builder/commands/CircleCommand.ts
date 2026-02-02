/**
 * CircleCommand - Create a circle loop
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand, YamlPosition } from '../YamlBuilderTypes';
import { Vec3 } from '../../../platform/math/Vec3';

interface CircleCommandDef {
  circle: string;
  center: YamlPosition;
  radius: string | number;
  segments: number | string;
  purpose?: string;
  normal?: number[];
  tags?: string[];
}

export class CircleCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'circle';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const circleCmd = cmd as CircleCommandDef;
    const { builder, interpolateName, evaluateExpression } = context;

    // Interpolate name for repeat blocks
    const circleName = interpolateName(circleCmd.circle);
    const radiusExpr = typeof circleCmd.radius === 'number' ? String(circleCmd.radius) : circleCmd.radius;

    // Default normal is [0, 1, 0] (pointing up)
    const normalArr = circleCmd.normal ?? [0, 1, 0];
    const normal = new Vec3(normalArr[0], normalArr[1], normalArr[2]);

    // Segments can be a number or a reference to a measurement
    let segments: number;
    if (typeof circleCmd.segments === 'number') {
      segments = circleCmd.segments;
    } else {
      segments = Math.round(evaluateExpression(circleCmd.segments));
    }

    builder.createCircleLoop(
      circleName,
      {
        x: String(circleCmd.center.x),
        y: String(circleCmd.center.y),
        z: String(circleCmd.center.z)
      },
      radiusExpr,
      segments,
      (circleCmd.purpose ?? 'structural') as any,
      normal
    );
  }
}
