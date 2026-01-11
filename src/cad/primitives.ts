/**
 * CAD Primitives - Low-level building blocks for procedural modeling
 *
 * These primitives are designed to be combined into higher-level parts.
 * Each primitive is a pure function that returns a mesh with predictable
 * dimensions and origin placement.
 */

import { Mesh } from '../geometry/Mesh';
import { EdgeLoop } from '../geometry/EdgeLoop';
import { Vec3 } from '../core/Vec3';
import { MeshOperations } from '../geometry/MeshOperations';
import { Vertex } from '../geometry/Vertex';

/**
 * Profile types for cross-sections
 */
export type ProfileType = 'circle' | 'square' | 'rounded-square' | 'octagon';

/**
 * Creates a profile (EdgeLoop) at the origin with the given shape
 */
export function createProfile(
  type: ProfileType,
  size: number,
  segments: number = 16
): EdgeLoop {
  switch (type) {
    case 'circle':
      return EdgeLoop.createCircle(Vec3.zero(), size / 2, segments);

    case 'square':
      return EdgeLoop.createRectangle(Vec3.zero(), size, size);

    case 'rounded-square': {
      const r = size / 2;
      const cornerRadius = r * 0.2;
      const vertices: Vertex[] = [];
      const corners = [
        { x: -r + cornerRadius, z: -r + cornerRadius, startAngle: Math.PI },
        { x: r - cornerRadius, z: -r + cornerRadius, startAngle: Math.PI * 1.5 },
        { x: r - cornerRadius, z: r - cornerRadius, startAngle: 0 },
        { x: -r + cornerRadius, z: r - cornerRadius, startAngle: Math.PI * 0.5 }
      ];

      const segsPerCorner = Math.max(2, Math.floor(segments / 4));

      for (const corner of corners) {
        for (let i = 0; i <= segsPerCorner; i++) {
          const angle = corner.startAngle + (i / segsPerCorner) * (Math.PI / 2);
          const x = corner.x + Math.cos(angle) * cornerRadius;
          const z = corner.z + Math.sin(angle) * cornerRadius;
          vertices.push(new Vertex(new Vec3(x, 0, z)));
        }
      }

      // Verify all vertices are at y=0
      const nonZeroY = vertices.filter(v => v.position.y !== 0);
      if (nonZeroY.length > 0) {
        console.error(`[createProfile:rounded-square] ERROR: ${nonZeroY.length} vertices have non-zero Y!`);
      }

      return new EdgeLoop(vertices);
    }

    case 'octagon': {
      const r = size / 2;
      const vertices: Vertex[] = [];
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
        vertices.push(new Vertex(new Vec3(
          Math.cos(angle) * r,
          0,
          Math.sin(angle) * r
        )));
      }
      return new EdgeLoop(vertices);
    }

    default:
      return EdgeLoop.createCircle(Vec3.zero(), size / 2, segments);
  }
}

/**
 * Creates a tapered cylinder/rod
 * Origin at bottom center, extends upward along Y axis
 */
export function createTaperedRod(
  bottomRadius: number,
  topRadius: number,
  height: number,
  segments: number = 12,
  profile: ProfileType = 'circle'
): Mesh {

  const bottomLoop = createProfile(profile, bottomRadius * 2, segments);
  const topLoop = createProfile(profile, topRadius * 2, segments)
    .translate(new Vec3(0, height, 0));

  // Debug: check loop Y values

  const mesh = MeshOperations.loft([bottomLoop, topLoop]);
  MeshOperations.cap(bottomLoop, mesh, true);
  MeshOperations.cap(topLoop, mesh, false);
  mesh.calculateNormals();
  return mesh;
}

/**
 * Creates a turned leg with multiple sections (like lathe-turned wood)
 * Each section defined by height and radius
 */
export function createTurnedRod(
  sections: Array<{ height: number; radius: number }>,
  segments: number = 12,
  profile: ProfileType = 'circle'
): Mesh {
  if (sections.length < 2) {
    throw new Error('Turned rod needs at least 2 sections');
  }

  const loops: EdgeLoop[] = [];
  let currentHeight = 0;

  for (const section of sections) {
    const loop = createProfile(profile, section.radius * 2, segments)
      .translate(new Vec3(0, currentHeight, 0));
    loops.push(loop);
    currentHeight += section.height;
  }

  // Add final point at top
  const lastSection = sections[sections.length - 1];
  const topLoop = createProfile(profile, lastSection.radius * 2, segments)
    .translate(new Vec3(0, currentHeight, 0));
  loops.push(topLoop);

  const mesh = MeshOperations.loft(loops);
  MeshOperations.cap(loops[0], mesh, true);
  MeshOperations.cap(loops[loops.length - 1], mesh, false);
  mesh.calculateNormals();
  return mesh;
}

/**
 * Creates a curved/bent rod (like a cabriole leg or armrest)
 * Uses bezier-like interpolation
 */
export function createCurvedRod(
  startRadius: number,
  endRadius: number,
  controlPoints: Vec3[],
  segments: number = 12,
  curveSegments: number = 8,
  profile: ProfileType = 'circle'
): Mesh {
  if (controlPoints.length < 2) {
    throw new Error('Curved rod needs at least 2 control points');
  }

  const loops: EdgeLoop[] = [];

  for (let i = 0; i <= curveSegments; i++) {
    const t = i / curveSegments;
    const radius = startRadius + (endRadius - startRadius) * t;
    const position = interpolatePath(controlPoints, t);

    // Get direction for orientation
    const nextT = Math.min(1, t + 0.01);
    const prevT = Math.max(0, t - 0.01);
    const direction = interpolatePath(controlPoints, nextT)
      .sub(interpolatePath(controlPoints, prevT))
      .normalize();

    const loop = createProfile(profile, radius * 2, segments);

    // Orient the loop perpendicular to the path direction
    const orientedLoop = orientLoopAlongDirection(loop, position, direction);
    loops.push(orientedLoop);
  }

  const mesh = MeshOperations.loft(loops);
  MeshOperations.cap(loops[0], mesh, true);
  MeshOperations.cap(loops[loops.length - 1], mesh, false);
  mesh.calculateNormals();
  return mesh;
}

/**
 * Creates a flat panel with optional edge profile
 */
export function createPanel(
  width: number,
  depth: number,
  thickness: number,
  edgeBevel: number = 0
): Mesh {

  if (edgeBevel <= 0) {
    const mesh = MeshOperations.createBox(width, thickness, depth);
    // Translate so bottom face is at y=0
    mesh.vertices.forEach((v: Vertex) => v.position.y += thickness / 2);
    return mesh;
  }

  // Create beveled panel using edge loops
  const hw = width / 2;
  const hd = depth / 2;
  const bevel = Math.min(edgeBevel, thickness / 2, Math.min(width, depth) / 4);

  // Vertices in counter-clockwise order when viewed from above (+Y)
  // This produces outward-facing normals on the sides

  // Bottom face (smaller)
  const bottomOuter: Vertex[] = [
    new Vertex(new Vec3(-hw + bevel, 0, -hd + bevel)),
    new Vertex(new Vec3(-hw + bevel, 0, hd - bevel)),
    new Vertex(new Vec3(hw - bevel, 0, hd - bevel)),
    new Vertex(new Vec3(hw - bevel, 0, -hd + bevel))
  ];

  // Middle (full size, at bevel height)
  const middle: Vertex[] = [
    new Vertex(new Vec3(-hw, bevel, -hd)),
    new Vertex(new Vec3(-hw, bevel, hd)),
    new Vertex(new Vec3(hw, bevel, hd)),
    new Vertex(new Vec3(hw, bevel, -hd))
  ];

  // Top middle (full size, below top bevel)
  const topMiddle: Vertex[] = [
    new Vertex(new Vec3(-hw, thickness - bevel, -hd)),
    new Vertex(new Vec3(-hw, thickness - bevel, hd)),
    new Vertex(new Vec3(hw, thickness - bevel, hd)),
    new Vertex(new Vec3(hw, thickness - bevel, -hd))
  ];

  // Top face (smaller)
  const topOuter: Vertex[] = [
    new Vertex(new Vec3(-hw + bevel, thickness, -hd + bevel)),
    new Vertex(new Vec3(-hw + bevel, thickness, hd - bevel)),
    new Vertex(new Vec3(hw - bevel, thickness, hd - bevel)),
    new Vertex(new Vec3(hw - bevel, thickness, -hd + bevel))
  ];

  const mesh = MeshOperations.loft([
    new EdgeLoop(bottomOuter),
    new EdgeLoop(middle),
    new EdgeLoop(topMiddle),
    new EdgeLoop(topOuter)
  ]);

  MeshOperations.cap(new EdgeLoop(bottomOuter), mesh, true);
  MeshOperations.cap(new EdgeLoop(topOuter), mesh, false);
  mesh.calculateNormals();
  return mesh;
}

/**
 * Creates a curved panel (like a curved chair back)
 */
export function createCurvedPanel(
  width: number,
  height: number,
  thickness: number,
  curvature: number,  // 0 = flat, positive = curves away
  segments: number = 8
): Mesh {
  const loops: EdgeLoop[] = [];
  const hw = width / 2;
  const ht = thickness / 2;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = t * height;

    // Apply curvature (parabolic curve)
    const curveOffset = curvature * t * t;

    const vertices: Vertex[] = [
      new Vertex(new Vec3(-hw, y, -ht + curveOffset)),
      new Vertex(new Vec3(hw, y, -ht + curveOffset)),
      new Vertex(new Vec3(hw, y, ht + curveOffset)),
      new Vertex(new Vec3(-hw, y, ht + curveOffset))
    ];
    loops.push(new EdgeLoop(vertices));
  }

  const mesh = MeshOperations.loft(loops);
  MeshOperations.cap(loops[0], mesh, true);
  MeshOperations.cap(loops[loops.length - 1], mesh, false);
  mesh.calculateNormals();
  return mesh;
}

/**
 * Creates spindles (multiple vertical rods)
 */
export function createSpindles(
  count: number,
  width: number,  // Total width to distribute across
  height: number,
  bottomRadius: number,
  middleRadius: number,
  topRadius: number,
  segments: number = 8
): Mesh {
  const mesh = new Mesh();
  const spacing = width / (count + 1);
  const startX = -width / 2 + spacing;

  for (let i = 0; i < count; i++) {
    const x = startX + i * spacing;

    // Create a turned spindle with bulge in middle
    const spindle = createTurnedRod([
      { height: 0, radius: bottomRadius },
      { height: height * 0.3, radius: middleRadius },
      { height: height * 0.4, radius: middleRadius * 0.9 },
      { height: height * 0.3, radius: topRadius }
    ], segments);

    spindle.vertices.forEach((v: Vertex) => v.position.x += x);
    mesh.merge(spindle);
  }

  mesh.calculateNormals();
  return mesh;
}

// Helper: Interpolate along a path of control points
function interpolatePath(points: Vec3[], t: number): Vec3 {
  if (points.length === 2) {
    return points[0].lerp(points[1], t);
  }

  // Catmull-Rom-like interpolation for smoother curves
  const n = points.length - 1;
  const segment = Math.min(Math.floor(t * n), n - 1);
  const localT = (t * n) - segment;

  return points[segment].lerp(points[segment + 1], localT);
}

// Helper: Orient an edge loop to face along a direction
function orientLoopAlongDirection(loop: EdgeLoop, position: Vec3, _direction: Vec3): EdgeLoop {
  // Simple implementation: assume direction is mostly vertical for furniture
  // A full implementation would use quaternions
  return loop.translate(position);
}

