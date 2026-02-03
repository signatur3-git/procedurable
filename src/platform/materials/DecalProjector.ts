/**
 * Decal Projector (G5-001)
 *
 * Projects decals (images or procedural textures) onto mesh surfaces.
 * Supports planar, cylindrical, and spherical projection modes.
 */

import { Vec3 } from '../math/Vec3';
import {
  TextureResult,
  EvaluationContext,
  Color,
  defaultResult,
  blendColors,
  clamp01,
  getGenerator
} from './TextureGenerator';

/**
 * Decal projection types
 */
export type ProjectionType = 'planar' | 'cylindrical' | 'spherical';

/**
 * Planar projection parameters
 */
export interface PlanarProjection {
  type: 'planar';
  /** Center point of projection */
  origin: Vec3;
  /** Normal direction (projection axis) */
  normal: Vec3;
  /** Up vector for orientation */
  up: Vec3;
  /** Width of projected area */
  width: number;
  /** Height of projected area */
  height: number;
}

/**
 * Cylindrical projection parameters
 */
export interface CylindricalProjection {
  type: 'cylindrical';
  /** Center of cylinder axis */
  origin: Vec3;
  /** Axis direction */
  axis: Vec3;
  /** Cylinder radius */
  radius: number;
  /** Height along axis */
  height: number;
  /** Start angle (radians) */
  startAngle?: number;
  /** End angle (radians) */
  endAngle?: number;
}

/**
 * Spherical projection parameters
 */
export interface SphericalProjection {
  type: 'spherical';
  /** Center of sphere */
  origin: Vec3;
  /** Sphere radius */
  radius: number;
}

export type DecalProjection = PlanarProjection | CylindricalProjection | SphericalProjection;

/**
 * Decal source - can be a generator or image reference
 */
export interface DecalSource {
  /** Generator name (for procedural decals) */
  generator?: string;
  /** Generator parameters */
  params?: Record<string, any>;
  /** Image path (for image decals) - future feature */
  imagePath?: string;
  /** Solid color */
  color?: Color;
}

/**
 * Decal definition
 */
export interface Decal {
  /** Unique name for this decal */
  name: string;
  /** Source texture/color */
  source: DecalSource;
  /** Projection parameters */
  projection: DecalProjection;
  /** Blend mode for compositing */
  blendMode?: 'normal' | 'multiply' | 'add' | 'screen';
  /** Opacity (0-1) */
  opacity?: number;
}

/**
 * Result of projecting a world position to decal UV space
 */
export interface DecalUV {
  /** U coordinate in decal space (0-1, or outside if not in decal) */
  u: number;
  /** V coordinate in decal space (0-1) */
  v: number;
  /** Whether the point is within the decal bounds */
  inBounds: boolean;
  /** Distance from projection surface (for depth testing) */
  depth: number;
}

/**
 * Project a world position to planar decal UV space
 */
function projectPlanar(worldPos: Vec3, proj: PlanarProjection): DecalUV {
  // Vector from origin to point
  const toPoint = worldPos.sub(proj.origin);

  // Distance along normal (depth)
  const depth = toPoint.dot(proj.normal);

  // Project onto plane
  const onPlane = toPoint.sub(proj.normal.mul(depth));

  // Calculate right vector
  const right = proj.up.cross(proj.normal).normalize();
  const up = proj.normal.cross(right).normalize();

  // UV coordinates
  const u = onPlane.dot(right) / proj.width + 0.5;
  const v = onPlane.dot(up) / proj.height + 0.5;

  const inBounds = u >= 0 && u <= 1 && v >= 0 && v <= 1 && Math.abs(depth) < proj.width * 0.5;

  return { u, v, inBounds, depth: Math.abs(depth) };
}

/**
 * Project a world position to cylindrical decal UV space
 */
function projectCylindrical(worldPos: Vec3, proj: CylindricalProjection): DecalUV {
  // Vector from origin to point
  const toPoint = worldPos.sub(proj.origin);

  // Project onto axis
  const axisNorm = proj.axis.normalize();
  const heightOnAxis = toPoint.dot(axisNorm);

  // Radial component
  const radial = toPoint.sub(axisNorm.mul(heightOnAxis));
  const dist = radial.length();

  // Angle around axis
  const angle = Math.atan2(radial.z, radial.x);
  const startAngle = proj.startAngle ?? 0;
  const endAngle = proj.endAngle ?? Math.PI * 2;
  const angleRange = endAngle - startAngle;

  // UV coordinates
  const u = (angle - startAngle) / angleRange;
  const v = (heightOnAxis / proj.height) + 0.5;

  const depth = Math.abs(dist - proj.radius);
  const inBounds = u >= 0 && u <= 1 && v >= 0 && v <= 1 && depth < proj.radius * 0.1;

  return { u, v, inBounds, depth };
}

/**
 * Project a world position to spherical decal UV space
 */
function projectSpherical(worldPos: Vec3, proj: SphericalProjection): DecalUV {
  // Vector from origin to point
  const toPoint = worldPos.sub(proj.origin);
  const dist = toPoint.length();

  if (dist < 0.0001) {
    return { u: 0.5, v: 0.5, inBounds: false, depth: proj.radius };
  }

  const dir = toPoint.mul(1 / dist);

  // Spherical coordinates
  const theta = Math.atan2(dir.z, dir.x); // Longitude
  const phi = Math.acos(clamp01(dir.y)); // Latitude from top

  const u = (theta + Math.PI) / (Math.PI * 2);
  const v = phi / Math.PI;

  const depth = Math.abs(dist - proj.radius);
  const inBounds = depth < proj.radius * 0.1;

  return { u, v, inBounds, depth };
}

/**
 * Project a world position to decal UV space
 */
export function projectToDecalUV(worldPos: Vec3, projection: DecalProjection): DecalUV {
  switch (projection.type) {
    case 'planar':
      return projectPlanar(worldPos, projection);
    case 'cylindrical':
      return projectCylindrical(worldPos, projection);
    case 'spherical':
      return projectSpherical(worldPos, projection);
    default:
      return { u: 0, v: 0, inBounds: false, depth: Infinity };
  }
}

/**
 * Evaluate a decal at a world position
 */
export function evaluateDecal(
  decal: Decal,
  worldPos: Vec3,
  seed: number
): { result: TextureResult; coverage: number } {
  // Project to decal UV space
  const decalUV = projectToDecalUV(worldPos, decal.projection);

  if (!decalUV.inBounds) {
    return { result: defaultResult(), coverage: 0 };
  }

  // Evaluate source
  let result: TextureResult;

  if (decal.source.generator) {
    const gen = getGenerator(decal.source.generator);
    if (gen) {
      const ctx: EvaluationContext = { u: decalUV.u, v: decalUV.v };
      result = gen.evaluate(ctx, decal.source.params ?? {}, seed);
    } else {
      result = defaultResult();
    }
  } else if (decal.source.color) {
    result = defaultResult();
    result.albedo = decal.source.color;
  } else {
    result = defaultResult();
  }

  // Apply opacity
  const opacity = decal.opacity ?? 1;

  // Soft edge falloff near boundaries
  const edgeFalloff = Math.min(
    smoothEdge(decalUV.u),
    smoothEdge(decalUV.v),
    smoothEdge(1 - decalUV.u),
    smoothEdge(1 - decalUV.v)
  );

  const coverage = opacity * edgeFalloff;

  return { result, coverage };
}

/**
 * Smooth edge falloff function
 */
function smoothEdge(t: number, width: number = 0.05): number {
  if (t < 0) return 0;
  if (t > width) return 1;
  return t / width;
}

/**
 * Decal projector class for managing multiple decals
 */
export class DecalProjector {
  private decals: Decal[] = [];

  /**
   * Add a decal
   */
  addDecal(decal: Decal): void {
    this.decals.push(decal);
  }

  /**
   * Remove a decal by name
   */
  removeDecal(name: string): boolean {
    const idx = this.decals.findIndex(d => d.name === name);
    if (idx >= 0) {
      this.decals.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all decals
   */
  getDecals(): Decal[] {
    return [...this.decals];
  }

  /**
   * Evaluate all decals at a world position and composite
   */
  evaluate(worldPos: Vec3, baseResult: TextureResult, seed: number): TextureResult {
    let result = { ...baseResult };

    for (let i = 0; i < this.decals.length; i++) {
      const decal = this.decals[i];
      const { result: decalResult, coverage } = evaluateDecal(decal, worldPos, seed + i * 1000);

      if (coverage > 0) {
        // Blend decal onto base
        result = blendDecalResult(result, decalResult, decal.blendMode ?? 'normal', coverage);
      }
    }

    return result;
  }

  /**
   * Get decal count
   */
  get count(): number {
    return this.decals.length;
  }
}

/**
 * Blend a decal result onto a base result
 */
function blendDecalResult(
  base: TextureResult,
  decal: TextureResult,
  mode: 'normal' | 'multiply' | 'add' | 'screen',
  coverage: number
): TextureResult {
  let blendedAlbedo: Color;

  switch (mode) {
    case 'multiply':
      blendedAlbedo = {
        r: base.albedo.r * decal.albedo.r,
        g: base.albedo.g * decal.albedo.g,
        b: base.albedo.b * decal.albedo.b
      };
      break;
    case 'add':
      blendedAlbedo = {
        r: Math.min(1, base.albedo.r + decal.albedo.r),
        g: Math.min(1, base.albedo.g + decal.albedo.g),
        b: Math.min(1, base.albedo.b + decal.albedo.b)
      };
      break;
    case 'screen':
      blendedAlbedo = {
        r: 1 - (1 - base.albedo.r) * (1 - decal.albedo.r),
        g: 1 - (1 - base.albedo.g) * (1 - decal.albedo.g),
        b: 1 - (1 - base.albedo.b) * (1 - decal.albedo.b)
      };
      break;
    case 'normal':
    default:
      blendedAlbedo = decal.albedo;
  }

  return {
    albedo: blendColors(base.albedo, blendedAlbedo, coverage),
    normal: base.normal, // Keep base normal for now
    roughness: base.roughness + (decal.roughness - base.roughness) * coverage,
    metallic: base.metallic + (decal.metallic - base.metallic) * coverage,
    height: base.height + (decal.height - base.height) * coverage
  };
}

/**
 * Create a simple planar decal
 */
export function createPlanarDecal(
  name: string,
  origin: Vec3,
  normal: Vec3,
  size: number,
  color: Color
): Decal {
  return {
    name,
    source: { color },
    projection: {
      type: 'planar',
      origin,
      normal: normal.normalize(),
      up: new Vec3(0, 1, 0),
      width: size,
      height: size
    }
  };
}
