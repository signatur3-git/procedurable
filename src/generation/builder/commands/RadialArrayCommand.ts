/**
 * RadialArrayCommand - Duplicate geometry around a center point
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand, YamlPosition } from '../YamlBuilderTypes';
import { Vec3 } from '../../../platform/math/Vec3';
import { Mesh } from '../../../platform/geometry/Mesh';
import * as MeshTransform from '../../../platform/geometry/MeshTransform';
import { evaluate as mathEvaluate } from '../../../platform/math/MathService';

interface RadialArrayCommandDef {
  radialArray: string;
  count: number | string;
  radius?: number | string;
  center?: YamlPosition;
  axis?: 'x' | 'y' | 'z';
  geometry: YamlGeometryCommand[];
}

export class RadialArrayCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'radialArray';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const arrayCmd = cmd as RadialArrayCommandDef;
    const { builder, decisionValues, processGeometry, evaluateExpression } = context;

    // Get count
    let count: number;
    if (typeof arrayCmd.count === 'number') {
      count = arrayCmd.count;
    } else {
      if (decisionValues.has(arrayCmd.count)) {
        count = decisionValues.get(arrayCmd.count);
      } else {
        const vars = builder.context.toObject();
        const result = mathEvaluate(arrayCmd.count, vars);
        count = Math.round(result.value);
      }
    }

    // Get radius (default 0 = no offset, just rotation)
    let radius = 0;
    if (arrayCmd.radius !== undefined) {
      radius = evaluateExpression(arrayCmd.radius);
    }

    // Get center (default 0,0,0)
    const centerX = arrayCmd.center?.x !== undefined ? evaluateExpression(arrayCmd.center.x) : 0;
    const centerY = arrayCmd.center?.y !== undefined ? evaluateExpression(arrayCmd.center.y) : 0;
    const centerZ = arrayCmd.center?.z !== undefined ? evaluateExpression(arrayCmd.center.z) : 0;

    // Get axis (default 'y')
    const axis = arrayCmd.axis || 'y';

    // Store current mesh state
    const baseMesh = builder.getMesh().clone();

    // Execute geometry for each radial position
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2; // Radians

      // Calculate offset based on axis and radius
      let offsetX = 0, offsetY = 0, offsetZ = 0;
      if (axis === 'y') {
        offsetX = Math.cos(angle) * radius;
        offsetZ = Math.sin(angle) * radius;
      } else if (axis === 'x') {
        offsetY = Math.cos(angle) * radius;
        offsetZ = Math.sin(angle) * radius;
      } else if (axis === 'z') {
        offsetX = Math.cos(angle) * radius;
        offsetY = Math.sin(angle) * radius;
      }

      // Add index to context
      builder.context.setMeasurement('__radial_index', i);
      builder.context.setMeasurement('__radial_angle', angle);
      builder.context.setMeasurement('__radial_angle_deg', angle * 180 / Math.PI);
      decisionValues.set('__radial_index', i);

      // Clear current mesh to build from scratch
      builder.replaceMesh(new Mesh());

      // Process geometry
      await processGeometry(arrayCmd.geometry);

      // Get the generated mesh
      const instanceMesh = builder.getMesh();

      // First rotate around the axis
      let axisVector: Vec3;
      if (axis === 'y') {
        axisVector = new Vec3(0, 1, 0);
      } else if (axis === 'x') {
        axisVector = new Vec3(1, 0, 0);
      } else {
        axisVector = new Vec3(0, 0, 1);
      }

      const rotated = MeshTransform.rotate(instanceMesh, axisVector, angle);

      // Then translate to position
      const transformed = MeshTransform.translate(
        rotated,
        new Vec3(centerX + offsetX, centerY + offsetY, centerZ + offsetZ)
      );

      // Merge with base
      baseMesh.merge(transformed);
    }

    // Restore the accumulated mesh
    builder.replaceMesh(baseMesh);
  }
}
