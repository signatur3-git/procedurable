/**
 * LoftCommand - Loft between two edge loops
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand, YamlColor } from '../YamlBuilderTypes';
import { resolveGeometryColor } from '../MaterialResolver';

interface LoftCommandDef {
  loft: string;
  from: string;
  to: string;
  color?: YamlColor | string;
}

export class LoftCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'loft';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const loftCmd = cmd as LoftCommandDef;
    const { builder, materials, interpolateName } = context;

    const loftName = interpolateName(loftCmd.loft);
    const fromLoop = interpolateName(loftCmd.from);
    const toLoop = interpolateName(loftCmd.to);
    const color = resolveGeometryColor(loftCmd.color, materials);

    builder.loftLoops(loftName, fromLoop, toLoop, color);
  }
}
