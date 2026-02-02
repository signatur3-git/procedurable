/**
 * CapCommand - Cap an edge loop with a face
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand, YamlColor } from '../YamlBuilderTypes';
import { resolveGeometryMaterial } from '../MaterialResolver';

interface CapCommandDef {
  cap: string;
  loop: string;
  flip?: boolean;
  color?: YamlColor | string;
}

export class CapCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'cap';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const capCmd = cmd as CapCommandDef;
    const { builder, materials, materialSlots, interpolateName } = context;

    const capName = interpolateName(capCmd.cap);
    const loopRef = interpolateName(capCmd.loop);
    const { color, materialSlotIndex } = resolveGeometryMaterial(capCmd.color, materials, materialSlots, builder.mesh);

    builder.capLoop(capName, loopRef, capCmd.flip ?? false, color, materialSlotIndex);
  }
}
