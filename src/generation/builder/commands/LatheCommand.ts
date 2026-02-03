/**
 * LatheCommand - Create geometry by rotating a profile around an axis
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand, YamlColor, YamlProfile } from '../YamlBuilderTypes';
import { resolveGeometryMaterial } from '../MaterialResolver';
import { resolveProfile } from '../ProfileResolver';
import { lathe as latheGeometry } from '../../../platform/geometry/Sweep';

interface LatheCommandDef {
  lathe: string;
  profile: string | YamlProfile;  // Can be profile name or inline definition
  segments?: number | string;
  angle?: number | string;
  axis?: 'y' | 'x' | 'z';
  color?: YamlColor | string;
}

export class LatheCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'lathe';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const latheCmd = cmd as LatheCommandDef;
    const { builder, materials, materialSlots, evaluateExpression } = context;

    const latheName = latheCmd.lathe;

    // Support both inline profile and profile reference
    let profileDef: YamlProfile | undefined;
    if (typeof latheCmd.profile === 'string') {
      // Profile reference - look up by name
      profileDef = (builder as any)._yamlProfiles?.get(latheCmd.profile) as YamlProfile | undefined;
      if (!profileDef) {
        throw new Error(`Profile '${latheCmd.profile}' not found for lathe '${latheName}'`);
      }
    } else if (Array.isArray(latheCmd.profile)) {
      // Inline profile - use directly
      profileDef = latheCmd.profile;
    } else {
      throw new Error(`Invalid profile for lathe '${latheName}': expected string or array`);
    }

    const profile = resolveProfile(profileDef, evaluateExpression);

    const segments = latheCmd.segments !== undefined
      ? Math.round(evaluateExpression(latheCmd.segments))
      : 16;

    const angle = latheCmd.angle !== undefined
      ? evaluateExpression(latheCmd.angle)
      : Math.PI * 2;

    // Generate mesh using lathe function
    const latheMesh = latheGeometry(profile.points, segments, angle);

    // Resolve color and material slot
    const { color, materialSlotIndex } = resolveGeometryMaterial(latheCmd.color, materials, materialSlots, builder.mesh);

    // Merge the lathe mesh into builder's mesh
    builder.mergeMesh(latheName, latheMesh, color, materialSlotIndex);
  }
}
