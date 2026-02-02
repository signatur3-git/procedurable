/**
 * SubdivideCommand - Apply Catmull-Clark subdivision to mesh
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand } from '../YamlBuilderTypes';
import { subdivideCatmullClark } from '../../../platform/geometry/Subdivision';

interface SubdivideCommandDef {
  subdivide: string;
  mesh?: string;
  iterations?: number;
}

export class SubdivideCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'subdivide';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const subCmd = cmd as SubdivideCommandDef;
    const { builder } = context;

    const iterations = subCmd.iterations ?? 1;

    // Subdivide the current mesh
    for (let i = 0; i < iterations; i++) {
      const currentMesh = builder.getMesh();
      const subdivided = subdivideCatmullClark(currentMesh);
      builder.replaceMesh(subdivided);
    }

    builder.trace(`subdivide:${subCmd.subdivide}`, { iterations });
  }
}
