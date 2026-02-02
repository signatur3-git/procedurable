/**
 * MeshRadialArrayCommand - Duplicate existing mesh geometry around an axis
 *
 * Unlike radialArray (which executes sub-geometry multiple times), this command
 * takes the current mesh and duplicates it radially. Useful for gear teeth,
 * wheel spokes, etc. where you build one segment and array it.
 *
 * YAML usage:
 *   - mesh_radial_array: gear_teeth
 *     axis: y              # Axis to rotate around ('x', 'y', 'z')
 *     count: 24            # Number of copies (including original)
 *     angle: 6.28          # Total angle in radians (optional, default: 2π)
 *
 *   - mesh_radial_array: half_pattern
 *     axis:
 *       point: { x: 0, y: 0, z: 0 }
 *       direction: { x: 0, y: 1, z: 0 }
 *     count: 6
 *     angle: 3.14          # Half circle (π radians)
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand } from '../YamlBuilderTypes';
import { MeshOperations } from '../../../platform/geometry/MeshOperations';
import { Vec3 } from '../../../platform/math/Vec3';

interface MeshRadialArrayCommandDef {
  mesh_radial_array: string;               // Trace name
  axis?: 'x' | 'y' | 'z' | {
    point?: { x?: number | string; y?: number | string; z?: number | string };
    direction?: { x?: number | string; y?: number | string; z?: number | string };
  };
  count: number | string;                  // Number of copies
  angle?: number | string;                 // Total angle in radians (default: 2π)
  include_original?: boolean;              // Include original in output (default: true)
}

export class MeshRadialArrayCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'mesh_radial_array';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const arrayCmd = cmd as unknown as MeshRadialArrayCommandDef;
    const { builder, evaluateExpression } = context;

    // Parse axis definition
    let axis: 'x' | 'y' | 'z' | { point: Vec3; direction: Vec3 };

    if (!arrayCmd.axis || typeof arrayCmd.axis === 'string') {
      // Simple axis
      axis = arrayCmd.axis ?? 'y';
    } else {
      // Custom axis with point and direction
      const a = arrayCmd.axis;
      const point = new Vec3(
        evaluateExpression(a.point?.x ?? 0),
        evaluateExpression(a.point?.y ?? 0),
        evaluateExpression(a.point?.z ?? 0)
      );
      const direction = new Vec3(
        evaluateExpression(a.direction?.x ?? 0),
        evaluateExpression(a.direction?.y ?? 1),
        evaluateExpression(a.direction?.z ?? 0)
      );
      axis = { point, direction };
    }

    const count = Math.floor(evaluateExpression(arrayCmd.count));
    const angle = evaluateExpression(arrayCmd.angle ?? Math.PI * 2);
    const includeOriginal = arrayCmd.include_original ?? true;

    // Get current mesh and apply radial array
    const currentMesh = builder.getMesh();
    const arrayed = MeshOperations.radialArray(currentMesh, axis, count, angle, includeOriginal);

    // Replace mesh with arrayed version
    builder.replaceMesh(arrayed);

    // Trace the operation
    const axisDesc = typeof axis === 'string' ? axis : 'custom';
    builder.trace(`mesh_radial_array:${arrayCmd.mesh_radial_array}`, {
      axis: axisDesc,
      count,
      angle,
      includeOriginal,
      vertexCount: arrayed.vertices.length,
      faceCount: arrayed.faces.length
    });
  }
}
