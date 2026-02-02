/**
 * LoftCommand - Loft between two edge loops
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand, YamlColor } from '../YamlBuilderTypes';
import { resolveGeometryMaterial } from '../MaterialResolver';

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
    const { builder, materials, materialSlots, interpolateName } = context;

    const loftName = interpolateName(loftCmd.loft);
    const fromLoop = interpolateName(loftCmd.from);
    const toLoop = interpolateName(loftCmd.to);
    const { color, materialSlotIndex } = resolveGeometryMaterial(loftCmd.color, materials, materialSlots, builder.mesh);

    builder.loftLoops(loftName, fromLoop, toLoop, color, materialSlotIndex);
  }
}
