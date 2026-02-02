/**
 * SweepCommand - Sweep a profile along a spline path
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand, YamlColor, YamlProfile, YamlSpline } from '../YamlBuilderTypes';
import { resolveGeometryMaterial } from '../MaterialResolver';
import { resolveProfile, resolveSpline } from '../ProfileResolver';
import { sweep as sweepGeometry } from '../../../platform/geometry/Sweep';

interface SweepCommandDef {
  sweep: string;
  profile: string;
  path: string;
  segments?: number | string;
  twist?: number | string;
  scaleStart?: number | string;
  scaleEnd?: number | string;
  color?: YamlColor | string;
}

export class SweepCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'sweep';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const sweepCmd = cmd as SweepCommandDef;
    const { builder, materials, materialSlots, evaluateExpression } = context;

    const sweepName = sweepCmd.sweep;

    // Get profile and spline from builder's stored definitions
    const profileDef = (builder as any)._yamlProfiles?.get(sweepCmd.profile) as YamlProfile | undefined;
    const splineDef = (builder as any)._yamlSplines?.get(sweepCmd.path) as YamlSpline | undefined;

    if (!profileDef) {
      throw new Error(`Profile '${sweepCmd.profile}' not found for sweep '${sweepName}'`);
    }
    if (!splineDef) {
      throw new Error(`Spline '${sweepCmd.path}' not found for sweep '${sweepName}'`);
    }

    const profile = resolveProfile(profileDef, evaluateExpression);
    const spline = resolveSpline(splineDef, evaluateExpression);

    const segments = sweepCmd.segments !== undefined
      ? Math.round(evaluateExpression(sweepCmd.segments))
      : 16;

    const evalOpt = (v: number | string | undefined): number | undefined => {
      if (v === undefined) return undefined;
      return typeof v === 'number' ? v : evaluateExpression(v);
    };

    const sweepMesh = sweepGeometry(profile, spline, segments, {
      twist: evalOpt(sweepCmd.twist),
      scaleStart: evalOpt(sweepCmd.scaleStart),
      scaleEnd: evalOpt(sweepCmd.scaleEnd)
    });

    const { color, materialSlotIndex } = resolveGeometryMaterial(sweepCmd.color, materials, materialSlots, builder.mesh);
    builder.mergeMesh(sweepName, sweepMesh, color, materialSlotIndex);
  }
}
