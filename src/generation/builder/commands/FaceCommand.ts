/**
 * FaceCommand - Create a face from vertices
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand, YamlColor } from '../YamlBuilderTypes';
import { resolveGeometryColor } from '../MaterialResolver';

interface FaceCommandDef {
  face: string;
  vertices?: string[];
  loop?: string;
  flip?: boolean;
  color?: YamlColor | string;
}

export class FaceCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'face';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const faceCmd = cmd as FaceCommandDef;
    const { builder, materials, interpolateName } = context;

    const faceName = interpolateName(faceCmd.face);
    const color = resolveGeometryColor(faceCmd.color, materials);

    if (faceCmd.vertices && faceCmd.vertices.length >= 3) {
      // Interpolate vertex references
      const vertices = faceCmd.vertices.map(v => interpolateName(v));
      builder.createFace(faceName, vertices, color);
    } else if (faceCmd.loop) {
      // Create face from loop - need to get loop vertices
      console.warn(`Face from loop not yet implemented: ${faceName}`);
    } else if (faceCmd.vertices && faceCmd.vertices.length < 3) {
      throw new Error(`Face '${faceName}' has only ${faceCmd.vertices.length} vertices, needs at least 3`);
    } else {
      throw new Error(`Face '${faceName}' has no vertices array or loop reference`);
    }
  }
}
