/**
 * Sweep Operations - Create surfaces by sweeping profiles along paths
 *
 * Essential for organic modeling:
 * - Lathe/Revolve: Spin a profile around an axis (vases, bottles, torsos)
 * - Sweep: Extrude a profile along a curve (arms, tentacles, pipes)
 * - Loft: Skin multiple profile curves (complex organic transitions)
 */

import { Vec3 } from '../math/Vec3';
import { Spline } from '../math/Spline';
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

  // Calculate height range for UV mapping
  const minY = Math.min(...profile.map(p => p.y));
  const maxY = Math.max(...profile.map(p => p.y));
  const heightRange = maxY - minY || 1; // Avoid division by zero

  // Create vertices
  // For each segment, rotate the profile around Y axis
  const actualSegments = closed ? segments : segments + 1;

  for (let s = 0; s < actualSegments; s++) {
    const angle = (s / segments) * arcAngle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // UV: u = angle / (2π), normalized to [0,1]
    const u = angle / (Math.PI * 2);

    for (let p = 0; p < profile.length; p++) {
      const pt = profile[p];
      // Rotate point around Y axis
      const x = pt.x * cos;
      const y = pt.y;
      const z = pt.x * sin;

      // UV: v = height_t (normalized position along profile)
      const v = (pt.y - minY) / heightRange;

      mesh.addVertex(new Vertex(new Vec3(x, y, z), { uv: [u, v], smoothGroup: 1 }));
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

      mesh.addFace(new Face([v0, v1, v2, v3]));
    }
  }

  // Cap generation for closed lathe (when profile ends are on axis)
  // Caps need NEW vertices with planar UVs (not the body vertices with cylindrical UVs)
  const firstOnAxis = Math.abs(profile[0].x) < 0.0001;
  const lastOnAxis = Math.abs(profile[profile.length - 1].x) < 0.0001;

  // Find max radius for UV normalization
  const maxRadius = Math.max(...profile.map(p => Math.abs(p.x))) || 1;

  // Bottom cap (at first profile point) - if first point is on axis
  if (firstOnAxis && closed) {
    const capY = profile[0].y;
    const capStartIdx = mesh.vertices.length;

    // Create center vertex with UV at center (0.5, 0.5)
    mesh.addVertex(new Vertex(new Vec3(0, capY, 0), { uv: [0.5, 0.5], smoothGroup: 2 }));

    // Create edge vertices with planar UVs
    // Use the second profile point (first non-axis point) for the cap edge
    const edgeRadius = profile.length > 1 ? profile[1].x : 0;
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * arcAngle;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const x = edgeRadius * cos;
      const z = edgeRadius * sin;

      // Planar UV: map XZ position to [0,1] based on radius
      // Center at (0.5, 0.5), radius maps to 0.5
      const uvU = 0.5 + (x / maxRadius) * 0.5;
      const uvV = 0.5 + (z / maxRadius) * 0.5;

      mesh.addVertex(new Vertex(new Vec3(x, capY, z), { uv: [uvU, uvV], smoothGroup: 2 }));
    }

    // Create fan triangles from center to edge
    // [center, edge1, edge2] → normal pointing -Y (downward, away from the body)
    const centerIdx = capStartIdx;
    for (let s = 0; s < segments; s++) {
      const edgeIdx1 = capStartIdx + 1 + s;
      const edgeIdx2 = capStartIdx + 1 + ((s + 1) % segments);
      // Bottom cap: normal pointing -Y (downward)
      mesh.addFace(new Face([centerIdx, edgeIdx1, edgeIdx2]));
    }
  }

  // Top cap (at last profile point) - if last point is on axis
  if (lastOnAxis && closed) {
    const capY = profile[profile.length - 1].y;
    const capStartIdx = mesh.vertices.length;

    // Create center vertex with UV at center (0.5, 0.5)
    mesh.addVertex(new Vertex(new Vec3(0, capY, 0), { uv: [0.5, 0.5], smoothGroup: 3 }));

    // Create edge vertices with planar UVs
    // Use the second-to-last profile point for the cap edge
    const edgeRadius = profile.length > 1 ? profile[profile.length - 2].x : 0;
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * arcAngle;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const x = edgeRadius * cos;
      const z = edgeRadius * sin;

      // Planar UV: map XZ position to [0,1] based on radius
      const uvU = 0.5 + (x / maxRadius) * 0.5;
      const uvV = 0.5 + (z / maxRadius) * 0.5;

      mesh.addVertex(new Vertex(new Vec3(x, capY, z), { uv: [uvU, uvV], smoothGroup: 3 }));
    }

    // Create fan triangles from center to edge
    // [center, edge2, edge1] → normal pointing +Y (upward, away from the body)
    const centerIdx = capStartIdx;
    for (let s = 0; s < segments; s++) {
      const edgeIdx1 = capStartIdx + 1 + s;
      const edgeIdx2 = capStartIdx + 1 + ((s + 1) % segments);
      // Top cap: normal pointing +Y (upward)
      mesh.addFace(new Face([centerIdx, edgeIdx2, edgeIdx1]));
    }
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

  // Create vertices along the path with UVs
  for (let s = 0; s <= segments; s++) {
    const t = s / segments;  // path_t: [0, 1] along path
    const frame = path.getFrame(t);

    // Calculate scale and twist at this point
    const scale = scaleStart + (scaleEnd - scaleStart) * t;
    const twistAngle = twist * t;
    const twistCos = Math.cos(twistAngle);
    const twistSin = Math.sin(twistAngle);

    for (let pIdx = 0; pIdx < profile.points.length; pIdx++) {
      const p = profile.points[pIdx];
      // profile_t: position around profile [0, 1]
      const profileT = profile.closed ? pIdx / profileLen : pIdx / (profileLen - 1 || 1);

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

      // UV: (profile_t, path_t)
      mesh.addVertex(new Vertex(worldPos, { uv: [profileT, t], smoothGroup: 1 }));
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

      mesh.addFace(new Face([v0, v1, v2, v3]));
    }
  }

  // Cap ends
  if (profile.closed) {
    if (capStart) {
      const startIndices = [];
      for (let p = 0; p < profileLen; p++) {
        startIndices.push(p);
      }
      mesh.addFace(new Face(startIndices));
    }

    if (capEnd) {
      const endIndices = [];
      const endOffset = segments * profileLen;
      for (let p = profileLen - 1; p >= 0; p--) {
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

  const numProfiles = profiles.length;

  // Create vertices for each profile with UVs
  for (let profileIdx = 0; profileIdx < numProfiles; profileIdx++) {
    const profileDef = profiles[profileIdx];
    const { position, normal, profile, scale = 1 } = profileDef;

    // V coordinate: position along loft (0 to 1)
    const vCoord = profileIdx / (numProfiles - 1);

    // Create frame from normal
    const up = Math.abs(normal.y) < 0.99 ? new Vec3(0, 1, 0) : new Vec3(1, 0, 0);
    const right = normal.cross(up).normalize();
    const realUp = right.cross(normal).normalize();

    for (let pointIdx = 0; pointIdx < profile.points.length; pointIdx++) {
      const p = profile.points[pointIdx];
      const worldPos = position
        .add(right.mul(p.x * scale))
        .add(realUp.mul(p.y * scale));

      // U coordinate: position around profile (0 to 1)
      const uCoord = profile.closed
        ? pointIdx / profileLen
        : pointIdx / (profileLen - 1 || 1);

      mesh.addVertex(new Vertex(worldPos, { uv: [uCoord, vCoord], smoothGroup: 1 }));
    }
  }

  // Create faces between adjacent profiles
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

      mesh.addFace(new Face([v0, v1, v2, v3]));
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

