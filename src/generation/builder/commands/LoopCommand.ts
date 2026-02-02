/**
 * LoopCommand - Create a rectangular/custom loop from vertices
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand } from '../YamlBuilderTypes';

interface LoopCommandDef {
  loop: string;
  type: string;
  vertices: string[];
  purpose: string;
  tags?: string[];
}

export class LoopCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'loop';

  handles(cmd: YamlGeometryCommand): boolean {
    // Loop command requires 'loop', 'vertices', and 'type' properties
    return 'loop' in cmd && 'vertices' in cmd && 'type' in cmd;
  }

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const loopCmd = cmd as LoopCommandDef;
    const { builder, interpolateName } = context;

    const loopName = interpolateName(loopCmd.loop);
    const vertices = loopCmd.vertices.map(v => interpolateName(v));

    if (vertices.length !== 4) {
      console.warn(`Loop '${loopName}' requires exactly 4 vertices, got ${vertices.length}`);
      return;
    }

    builder.createRectLoop(
      loopName,
      vertices as [string, string, string, string],
      loopCmd.purpose as any
    );
  }
}
