/**
 * VertexCommand - Place a vertex at a position
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand, YamlPosition } from '../YamlBuilderTypes';

interface VertexCommandDef {
  vertex: string;
  position: YamlPosition;
  tags?: string[];
}

export class VertexCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'vertex';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const vertexCmd = cmd as VertexCommandDef;
    const { builder, interpolateName } = context;

    // Interpolate name for repeat blocks: vertex_${i} -> vertex_0
    const vertexName = interpolateName(vertexCmd.vertex);

    builder.placeVertex(vertexName, {
      x: String(vertexCmd.position.x),
      y: String(vertexCmd.position.y),
      z: String(vertexCmd.position.z)
    });
  }
}
