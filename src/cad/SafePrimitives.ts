/**
 * Safe Primitive Factory
 *
 * This module provides SAFE primitives that guarantee:
 * 1. Correct vertex winding (counter-clockwise when viewed from outside)
 * 2. Correct normals (pointing outward)
 * 3. Validated bounds
 *
 * ALWAYS use these functions instead of directly calling MeshOperations.
 * The raw operations are error-prone; these are foolproof.
 */

import { Mesh } from '../geometry/Mesh';
import { Vec3 } from '../core/Vec3';
import { Vertex } from '../geometry/Vertex';
import { EdgeLoop } from '../geometry/EdgeLoop';
import { MeshOperations } from '../geometry/MeshOperations';
import { validateMeshDimensions } from '../validation/MeshValidation';

/**
 * Standard winding order for edge loops.
 * All loops should be COUNTER-CLOCKWISE when viewed from the OUTSIDE.
 *
 * For horizontal loops (normal pointing up +Y):
 *   Start at (-x, -z), go to (-x, +z), then (+x, +z), then (+x, -z)
 *
 * For vertical loops, the "outside" depends on context.
 */

/**
 * Creates a validated rod/cylinder.
 * - Origin at bottom center
 * - Extends along +Y axis
 * - Guaranteed Y bounds: [0, height]
 */
export function createRod(
  radius: number,
  height: number,
  segments: number = 12
): Mesh {
  const bottomLoop = EdgeLoop.createCircle(Vec3.zero(), radius, segments);
  const topLoop = EdgeLoop.createCircle(new Vec3(0, height, 0), radius, segments);

  const mesh = MeshOperations.loft([bottomLoop, topLoop]);
  MeshOperations.cap(bottomLoop, mesh, true);  // Bottom cap, reversed
  MeshOperations.cap(topLoop, mesh, false);    // Top cap, normal
  mesh.calculateNormals();

  // Validate
  if (!validateMeshDimensions(mesh, { y: height }, 0.001, 'createRod')) {
    console.warn('[createRod] Bounds validation failed!');
  }

  return mesh;
}

/**
 * Creates a horizontal rod (cylinder lying on its side).
 * - Centered at origin
 * - Extends along specified axis
 * - Guaranteed bounds: axis=[-length/2, length/2], other axes=[-radius, radius]
 */
export function createHorizontalRod(
  radius: number,
  length: number,
  axis: 'x' | 'z',
  segments: number = 12
): Mesh {
  // Create circles perpendicular to the axis
  const halfLen = length / 2;

  let loop1: EdgeLoop;
  let loop2: EdgeLoop;

  if (axis === 'x') {
    // Rod along X axis: circles in YZ plane
    loop1 = EdgeLoop.createCircle(new Vec3(-halfLen, 0, 0), radius, segments, new Vec3(1, 0, 0));
    loop2 = EdgeLoop.createCircle(new Vec3(halfLen, 0, 0), radius, segments, new Vec3(1, 0, 0));
  } else {
    // Rod along Z axis: circles in XY plane
    loop1 = EdgeLoop.createCircle(new Vec3(0, 0, -halfLen), radius, segments, new Vec3(0, 0, 1));
    loop2 = EdgeLoop.createCircle(new Vec3(0, 0, halfLen), radius, segments, new Vec3(0, 0, 1));
  }

  const mesh = MeshOperations.loft([loop1, loop2]);
  MeshOperations.cap(loop1, mesh, true);
  MeshOperations.cap(loop2, mesh, false);
  mesh.calculateNormals();

  return mesh;
}

/**
 * Creates a validated box/panel.
 * - Origin at bottom center (Y=0 is bottom face)
 * - Centered on X and Z axes
 * - Guaranteed Y bounds: [0, height]
 */
export function createBox(
  width: number,
  height: number,
  depth: number
): Mesh {
  const mesh = MeshOperations.createBox(width, height, depth);

  // MeshOperations.createBox is centered at origin, shift up so Y starts at 0
  mesh.vertices.forEach(v => {
    v.position.y += height / 2;
  });

  mesh.calculateNormals();

  // Validate
  if (!validateMeshDimensions(mesh, { y: height }, 0.001, 'createBox')) {
    console.warn('[createBox] Bounds validation failed!');
  }

  return mesh;
}

/**
 * Creates a horizontal loop at a given Y height.
 * Vertices are in COUNTER-CLOCKWISE order when viewed from above (+Y).
 *
 * This is the SAFE way to create loops for lofting panels.
 */
export function createRectLoop(
  width: number,
  depth: number,
  y: number = 0
): EdgeLoop {
  const hw = width / 2;
  const hd = depth / 2;

  // Counter-clockwise when viewed from above
  const vertices = [
    new Vertex(new Vec3(-hw, y, -hd)),  // back-left
    new Vertex(new Vec3(-hw, y, hd)),   // front-left
    new Vertex(new Vec3(hw, y, hd)),    // front-right
    new Vertex(new Vec3(hw, y, -hd))    // back-right
  ];

  return new EdgeLoop(vertices);
}

/**
 * Rectangular loop with 8 vertices (bevel=0 case).
 * Useful when lofting together with beveled loops (which have 8 vertices).
 */
export function createRectLoop8(
  width: number,
  depth: number,
  y: number = 0
): EdgeLoop {
  const hw = width / 2;
  const hd = depth / 2;

  // CCW from above, with midpoints on edges
  const vertices = [
    new Vertex(new Vec3(-hw, y, -hd)), // back-left corner
    new Vertex(new Vec3(-hw, y, 0)),   // left edge midpoint
    new Vertex(new Vec3(-hw, y, hd)),  // front-left corner
    new Vertex(new Vec3(0, y, hd)),    // front edge midpoint
    new Vertex(new Vec3(hw, y, hd)),   // front-right corner
    new Vertex(new Vec3(hw, y, 0)),    // right edge midpoint
    new Vertex(new Vec3(hw, y, -hd)),  // back-right corner
    new Vertex(new Vec3(0, y, -hd))    // back edge midpoint
  ];

  return new EdgeLoop(vertices);
}

/**
 * Creates a beveled rectangular loop at a given Y height.
 * Vertices are in COUNTER-CLOCKWISE order when viewed from above (+Y).
 */
export function createBeveledRectLoop(
  width: number,
  depth: number,
  bevel: number,
  y: number = 0
): EdgeLoop {
  const hw = width / 2;
  const hd = depth / 2;
  const b = Math.min(bevel, hw / 2, hd / 2);

  // Counter-clockwise when viewed from above, with beveled corners
  const vertices = [
    new Vertex(new Vec3(-hw + b, y, -hd)),
    new Vertex(new Vec3(-hw, y, -hd + b)),
    new Vertex(new Vec3(-hw, y, hd - b)),
    new Vertex(new Vec3(-hw + b, y, hd)),
    new Vertex(new Vec3(hw - b, y, hd)),
    new Vertex(new Vec3(hw, y, hd - b)),
    new Vertex(new Vec3(hw, y, -hd + b)),
    new Vertex(new Vec3(hw - b, y, -hd))
  ];

  return new EdgeLoop(vertices);
}

/**
 * Lofts between loops and caps the ends.
 * This is the SAFE way to create extruded shapes.
 *
 * IMPORTANT: All loops must have the same vertex count and winding order.
 */
export function loftAndCap(loops: EdgeLoop[]): Mesh {
  if (loops.length < 2) {
    throw new Error('loftAndCap requires at least 2 loops');
  }

  const mesh = MeshOperations.loft(loops);
  MeshOperations.cap(loops[0], mesh, true);                    // Bottom cap, reversed
  MeshOperations.cap(loops[loops.length - 1], mesh, false);    // Top cap, normal
  mesh.calculateNormals();

  return mesh;
}

/**
 * Creates a validated panel (flat box).
 * - Origin at bottom center (Y=0 is bottom face)
 * - Guaranteed Y bounds: [0, thickness]
 */
export function createPanel(
  width: number,
  depth: number,
  thickness: number,
  bevel: number = 0
): Mesh {
  if (bevel <= 0) {
    return createBox(width, thickness, depth);
  }

  // Beveled panel using consistent-vertex-count loops
  const b = Math.min(bevel, thickness / 2);

  const loops = [
    // Bottom (smaller) – uses beveled loop (8 verts)
    createBeveledRectLoop(width, depth, b, 0),

    // Lower middle (full size) – use 8-vertex rect loop
    createRectLoop8(width, depth, b),

    // Upper middle (full size)
    createRectLoop8(width, depth, thickness - b),

    // Top (smaller)
    createBeveledRectLoop(width, depth, b, thickness)
  ];

  const mesh = loftAndCap(loops);

  // Validate
  if (!validateMeshDimensions(mesh, { y: thickness }, 0.001, 'createPanel')) {
    console.warn('[createPanel] Bounds validation failed!');
  }

  return mesh;
}

// ============================================
// DOCUMENTATION
// ============================================

/**
 * # Safe Primitive Usage Guide
 *
 * ## The Golden Rules
 *
 * 1. **NEVER manually create EdgeLoop vertices** unless you understand winding order.
 *    Use `createRectLoop()` or `createBeveledRectLoop()` instead.
 *
 * 2. **ALWAYS use `loftAndCap()`** instead of calling loft/cap separately.
 *    This ensures correct cap orientation.
 *
 * 3. **ALWAYS validate bounds** after creating complex geometry.
 *    Use `validateMeshDimensions()` to catch errors early.
 *
 * 4. **Winding Order Convention**:
 *    - Horizontal loops: Counter-clockwise when viewed from above (+Y)
 *    - This produces outward-facing normals on extruded sides
 *
 * ## Creating New Primitives
 *
 * 1. Build from existing safe primitives when possible
 * 2. If creating new loop-based geometry:
 *    a. Define vertices in counter-clockwise order (viewed from outside)
 *    b. Use loftAndCap() for extrusions
 *    c. Add validation at the end
 * 3. Add a test in primitiveTests.ts
 *
 * ## Common Mistakes
 *
 * ❌ Clockwise vertex order → inverted normals
 * ❌ Inconsistent vertex count between loops → loft fails
 * ❌ Wrong cap orientation → dark caps
 * ❌ No validation → bugs discovered at render time
 */
