/**
 * Sweep Operations - Create surfaces by sweeping profiles along paths
 *
 * Essential for organic modeling:
 * - Lathe/Revolve: Spin a profile around an axis (vases, bottles, torsos)
 * - Sweep: Extrude a profile along a curve (arms, tentacles, pipes)
 * - Loft: Skin multiple profile curves (complex organic transitions)
 */

import { Vec3 } from '../core/Vec3';
import { Spline } from '../core/Spline';
import { Mesh } from './Mesh';
import { Vertex } from './Vertex';
import { Face } from './Face';

/**
 * Profile definition - a 2D curve to be swept
 */
export interface Profile {
  /** Points in 2D (x, y) - will be mapped to the sweep frame */
  points: Array<{ x: number; y: number }>;
  /** Whether the profile is closed (circle) or open (arc) */
  closed: boolean;
}

/**
 * Create common profile shapes
 */
export const Profiles = {
  /** Circle profile */
  circle(radius: number, segments: number = 8): Profile {
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      });
    }
    return { points, closed: true };
  },

  /** Ellipse profile */
  ellipse(radiusX: number, radiusY: number, segments: number = 8): Profile {
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: Math.cos(angle) * radiusX,
        y: Math.sin(angle) * radiusY
      });
    }
    return { points, closed: true };
  },

  /** Rectangle profile */
  rectangle(width: number, height: number): Profile {
    const hw = width / 2;
    const hh = height / 2;
    return {
      points: [
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh }
      ],
      closed: true
    };
  },

  /** Rounded rectangle */
  roundedRect(width: number, height: number, cornerRadius: number, cornerSegments: number = 4): Profile {
    const hw = width / 2;
    const hh = height / 2;
    const r = Math.min(cornerRadius, hw, hh);
    const points: Array<{ x: number; y: number }> = [];

    // Four corners with arcs
    const corners = [
      { cx: hw - r, cy: hh - r, startAngle: 0 },
      { cx: -hw + r, cy: hh - r, startAngle: Math.PI / 2 },
      { cx: -hw + r, cy: -hh + r, startAngle: Math.PI },
      { cx: hw - r, cy: -hh + r, startAngle: Math.PI * 1.5 }
    ];

    for (const corner of corners) {
      for (let i = 0; i <= cornerSegments; i++) {
        const angle = corner.startAngle + (i / cornerSegments) * (Math.PI / 2);
        points.push({
          x: corner.cx + Math.cos(angle) * r,
          y: corner.cy + Math.sin(angle) * r
        });
      }
    }

    return { points, closed: true };
  }
};

/**
 * Lathe/Revolve - Spin a 2D profile around the Y axis
 *
 * @param profile 2D points to revolve (in XY plane, Y is "up")
 * @param segments Number of segments around the revolution
 * @param arcAngle Total angle to revolve (default 2π for full revolution)
 */
export function lathe(
  profile: Array<{ x: number; y: number }>,
  segments: number = 16,
  arcAngle: number = Math.PI * 2
): Mesh {
  const mesh = new Mesh();
  const closed = Math.abs(arcAngle - Math.PI * 2) < 0.001;

  // Create vertices
  // For each segment, rotate the profile around Y axis
  const actualSegments = closed ? segments : segments + 1;

  for (let s = 0; s < actualSegments; s++) {
    const angle = (s / segments) * arcAngle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (const p of profile) {
      // Rotate point around Y axis
      const x = p.x * cos;
      const y = p.y;
      const z = p.x * sin;

      mesh.addVertex(new Vertex(new Vec3(x, y, z)));
    }
  }

  // Create faces
  const profileLen = profile.length;

  for (let s = 0; s < segments; s++) {
    const nextS = (s + 1) % actualSegments;

    for (let p = 0; p < profileLen - 1; p++) {
      const v0 = s * profileLen + p;
      const v1 = s * profileLen + p + 1;
      const v2 = nextS * profileLen + p + 1;
      const v3 = nextS * profileLen + p;

      mesh.addFace(new Face([v0, v3, v2, v1]));
    }
  }

  // Cap ends if profile starts/ends on axis (x = 0)
  if (Math.abs(profile[0].x) < 0.0001) {
    // Top cap - all segments connect to first point
    // (simplified - works for convex shapes)
  }

  return mesh;
}

/**
 * Sweep a profile along a spline path
 *
 * @param profile The 2D profile to sweep
 * @param path The path spline
 * @param segments Number of segments along the path
 * @param options Additional options
 */
export function sweep(
  profile: Profile,
  path: Spline,
  segments: number = 16,
  options: {
    /** Scale profile at start and end (for tapering) */
    scaleStart?: number;
    scaleEnd?: number;
    /** Twist angle over the length (radians) */
    twist?: number;
    /** Cap the ends */
    capStart?: boolean;
    capEnd?: boolean;
  } = {}
): Mesh {
  const mesh = new Mesh();

  const scaleStart = options.scaleStart ?? 1;
  const scaleEnd = options.scaleEnd ?? 1;
  const twist = options.twist ?? 0;
  const capStart = options.capStart ?? true;
  const capEnd = options.capEnd ?? true;

  const profileLen = profile.points.length;

  // Create vertices along the path
  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    const frame = path.getFrame(t);

    // Calculate scale and twist at this point
    const scale = scaleStart + (scaleEnd - scaleStart) * t;
    const twistAngle = twist * t;
    const twistCos = Math.cos(twistAngle);
    const twistSin = Math.sin(twistAngle);

    for (const p of profile.points) {
      // Apply twist to profile point
      const px = p.x * twistCos - p.y * twistSin;
      const py = p.x * twistSin + p.y * twistCos;

      // Scale
      const spx = px * scale;
      const spy = py * scale;

      // Transform to world space using frame
      const worldPos = frame.position
        .add(frame.normal.mul(spx))
        .add(frame.binormal.mul(spy));

      mesh.addVertex(new Vertex(worldPos));
    }
  }

  // Create faces
  for (let s = 0; s < segments; s++) {
    for (let p = 0; p < profileLen; p++) {
      const nextP = profile.closed ? (p + 1) % profileLen : p + 1;
      if (!profile.closed && nextP >= profileLen) continue;

      const v0 = s * profileLen + p;
      const v1 = s * profileLen + nextP;
      const v2 = (s + 1) * profileLen + nextP;
      const v3 = (s + 1) * profileLen + p;

      mesh.addFace(new Face([v0, v3, v2, v1]));
    }
  }

  // Cap ends
  if (profile.closed) {
    if (capStart) {
      const startIndices = [];
      for (let p = profileLen - 1; p >= 0; p--) {
        startIndices.push(p);
      }
      mesh.addFace(new Face(startIndices));
    }

    if (capEnd) {
      const endIndices = [];
      const endOffset = segments * profileLen;
      for (let p = 0; p < profileLen; p++) {
        endIndices.push(endOffset + p);
      }
      mesh.addFace(new Face(endIndices));
    }
  }

  return mesh;
}

/**
 * Loft between multiple profile curves
 * Creates a smooth surface spanning all profiles
 *
 * @param profiles Array of profiles at different positions
 * @param closed Whether to connect last profile back to first
 */
export function loftProfiles(
  profiles: Array<{
    position: Vec3;
    normal: Vec3;  // Direction the profile faces
    profile: Profile;
    scale?: number;
  }>,
  closed: boolean = false
): Mesh {
  const mesh = new Mesh();

  if (profiles.length < 2) {
    throw new Error('Loft requires at least 2 profiles');
  }

  // All profiles must have same point count
  const profileLen = profiles[0].profile.points.length;
  for (const p of profiles) {
    if (p.profile.points.length !== profileLen) {
      throw new Error('All profiles must have same number of points');
    }
  }

  // Create vertices for each profile
  for (const profileDef of profiles) {
    const { position, normal, profile, scale = 1 } = profileDef;

    // Create frame from normal
    const up = Math.abs(normal.y) < 0.99 ? new Vec3(0, 1, 0) : new Vec3(1, 0, 0);
    const right = normal.cross(up).normalize();
    const realUp = right.cross(normal).normalize();

    for (const p of profile.points) {
      const worldPos = position
        .add(right.mul(p.x * scale))
        .add(realUp.mul(p.y * scale));

      mesh.addVertex(new Vertex(worldPos));
    }
  }

  // Create faces between adjacent profiles
  const numProfiles = profiles.length;
  const connections = closed ? numProfiles : numProfiles - 1;

  for (let pi = 0; pi < connections; pi++) {
    const nextPi = (pi + 1) % numProfiles;
    const isClosed = profiles[pi].profile.closed;

    for (let p = 0; p < profileLen; p++) {
      const nextP = isClosed ? (p + 1) % profileLen : p + 1;
      if (!isClosed && nextP >= profileLen) continue;

      const v0 = pi * profileLen + p;
      const v1 = pi * profileLen + nextP;
      const v2 = nextPi * profileLen + nextP;
      const v3 = nextPi * profileLen + p;

      mesh.addFace(new Face([v0, v3, v2, v1]));
    }
  }

  return mesh;
}

/**
 * Create a tapered cylinder (useful for limbs)
 */
export function taperedCylinder(
  radiusBottom: number,
  radiusTop: number,
  height: number,
  segments: number = 8,
  heightSegments: number = 1
): Mesh {
  const profile: Array<{ x: number; y: number }> = [];

  // Profile from bottom to top
  for (let h = 0; h <= heightSegments; h++) {
    const t = h / heightSegments;
    const radius = radiusBottom + (radiusTop - radiusBottom) * t;
    const y = t * height;

    profile.push({ x: radius, y });
  }

  // Add center points for caps
  profile.unshift({ x: 0, y: 0 });  // Bottom center
  profile.push({ x: 0, y: height }); // Top center

  return lathe(profile, segments);
}

/**
 * Create a limb segment with organic tapering
 */
export function createLimbSegment(
  length: number,
  startRadius: number,
  endRadius: number,
  bulgePosition: number = 0.3, // Where the muscle bulge is (0-1)
  bulgeAmount: number = 1.2,   // How much to bulge (multiplier)
  segments: number = 8,
  lengthSegments: number = 4
): Mesh {
  const profile: Array<{ x: number; y: number }> = [];

  for (let h = 0; h <= lengthSegments; h++) {
    const t = h / lengthSegments;

    // Base radius interpolation
    const baseRadius = startRadius + (endRadius - startRadius) * t;

    // Add muscle bulge (gaussian-like)
    const bulgeFactor = Math.exp(-Math.pow((t - bulgePosition) / 0.2, 2));
    const radius = baseRadius * (1 + (bulgeAmount - 1) * bulgeFactor);

    const y = t * length;
    profile.push({ x: radius, y });
  }

  return lathe(profile, segments);
}

