/**
 * ProfileResolver - Resolve YAML profile and spline definitions
 *
 * Handles profile resolution for lathe/sweep operations.
 */

import { Vec3 } from '../../platform/math/Vec3';
import { Profile, Profiles } from '../../platform/geometry/Sweep';
import { Spline } from '../../platform/math/Spline';
import type { YamlProfile, YamlSpline } from './YamlBuilderTypes';

/**
 * Expression evaluator function type
 */
export type ExpressionEvaluator = (expr: string | number) => number;

/**
 * Resolve a profile definition to a Profile object
 */
export function resolveProfile(
  profileDef: YamlProfile,
  evaluateExpression: ExpressionEvaluator
): Profile {
  const evalNum = (v: string | number): number => {
    if (typeof v === 'number') return v;
    return evaluateExpression(v);
  };

  switch (profileDef.type) {
    case 'circle': {
      const radius = evalNum(profileDef.radius ?? 0.1);
      const segments = profileDef.segments ?? 8;
      return Profiles.circle(radius, segments);
    }

    case 'ellipse': {
      const rx = evalNum(profileDef.radiusX ?? 0.1);
      const ry = evalNum(profileDef.radiusY ?? 0.1);
      const segments = profileDef.segments ?? 8;
      return Profiles.ellipse(rx, ry, segments);
    }

    case 'rect': {
      const w = evalNum(profileDef.width ?? 0.1);
      const h = evalNum(profileDef.height ?? 0.1);
      return Profiles.rectangle(w, h);
    }

    case 'polygon':
    case 'spline': {
      if (!profileDef.points || profileDef.points.length < 2) {
        throw new Error('Polygon/spline profile requires at least 2 points');
      }
      const points = profileDef.points.map(p => ({
        x: evalNum(p.x),
        y: evalNum(p.y)
      }));
      return {
        points,
        closed: profileDef.closed ?? true
      };
    }

    default:
      throw new Error(`Unknown profile type: ${(profileDef as any).type}`);
  }
}

/**
 * Resolve a spline definition to a Spline object
 */
export function resolveSpline(
  splineDef: YamlSpline,
  evaluateExpression: ExpressionEvaluator
): Spline {
  const evalNum = (v: string | number): number => {
    if (typeof v === 'number') return v;
    return evaluateExpression(v);
  };

  const points = splineDef.points.map(p => new Vec3(
    evalNum(p.x),
    evalNum(p.y),
    evalNum(p.z)
  ));

  const tension = splineDef.tension ?? 0.5;

  // Use the unified Spline factory method
  return Spline.catmullRom(points, tension);
}
