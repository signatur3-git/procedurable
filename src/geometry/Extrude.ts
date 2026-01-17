/**
 * Extrude - 2D to 3D Extrusion
 *
 * Extrude 2D shapes into 3D geometry with proper normals and caps.
 */

import { Shape2D } from './Shape2D';
import { Vec3 } from '../core/Vec3';
import earcut from 'earcut';

/**
 * Cap options for extrusion
 */
export type ExtrudeCap = 'none' | 'front' | 'back' | 'both';

/**
 * Bevel options for extrusion edges
 */
export interface BevelParams {
  /** Size of the bevel (distance from edge) */
  size: number;
  /** Number of segments in the bevel curve (1 = chamfer, 2+ = rounded) */
  segments: number;
}

/**
 * Extrusion parameters
 */
export interface ExtrudeParams {
  /** Depth of extrusion along Y axis */
  depth: number;
  /** Which caps to generate */
  caps?: ExtrudeCap;
  /** Y offset for extrusion start (default 0) */
  offset?: number;
  /** Bevel/chamfer options for edges */
  bevel?: BevelParams;
}

/**
 * Extruded geometry result
 */
export interface ExtrudedGeometry {
  vertices: Vec3[];
  faces: number[][];  // Indices into vertices array
  normals: Vec3[];    // Per-vertex normals
}

/**
 * Extrude a 2D shape into 3D geometry
 *
 * @param shape - The 2D shape to extrude
 * @param params - Extrusion parameters
 * @returns Extruded geometry with vertices, faces, and normals
 */
export function extrude2D(shape: Shape2D, params: ExtrudeParams): ExtrudedGeometry {
  const { depth, caps = 'both', offset = 0, bevel } = params;

  if (bevel) {
    return extrude2DWithBevel(shape, depth, offset, caps, bevel);
  }

  // Simple extrusion without bevel
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  const normals: Vec3[] = [];

  const pointCount = shape.points.length;

  // Generate vertices for front and back faces
  const yFront = offset;
  const yBack = offset + depth;

  // Front face vertices (at Y = offset)
  for (const p of shape.points) {
    vertices.push(new Vec3(p.x, yFront, p.z));
  }

  // Back face vertices (at Y = offset + depth)
  for (const p of shape.points) {
    vertices.push(new Vec3(p.x, yBack, p.z));
  }

  // Generate side faces (quads between front and back)
  for (let i = 0; i < pointCount; i++) {
    const i1 = i;
    const i2 = (i + 1) % pointCount;
    const i3 = i1 + pointCount;
    const i4 = i2 + pointCount;

    // Create quad as two triangles
    // Triangle 1: front-bottom-left, front-bottom-right, back-bottom-right
    faces.push([i1, i2, i4]);
    // Triangle 2: front-bottom-left, back-bottom-right, back-bottom-left
    faces.push([i1, i4, i3]);
  }

  // Generate caps
  if (caps === 'front' || caps === 'both') {
    const frontFace = triangulatePolygon(shape, true);
    faces.push(...frontFace);
  }

  if (caps === 'back' || caps === 'both') {
    const backFace = triangulatePolygon(shape, false).map(face =>
      face.map(idx => idx + pointCount)
    );
    faces.push(...backFace);
  }

  // Calculate normals for all vertices
  calculateNormals(vertices, faces, normals);

  return { vertices, faces, normals };
}

/**
 * Extrude with beveled edges
 */
function extrude2DWithBevel(
  shape: Shape2D,
  depth: number,
  offset: number,
  caps: ExtrudeCap,
  bevel: BevelParams
): ExtrudedGeometry {
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  const normals: Vec3[] = [];

  const pointCount = shape.points.length;
  const { size: bevelSize, segments: bevelSegments } = bevel;

  // Clamp bevel size to not exceed half the depth
  const maxBevel = depth / 2;
  const actualBevelSize = Math.min(bevelSize, maxBevel);

  // Y positions for each layer
  const yFront = offset;
  const yFrontBevel = offset + actualBevelSize;
  const yBackBevel = offset + depth - actualBevelSize;
  const yBack = offset + depth;

  // Inset amount for beveled vertices (0 for chamfer)
  const insetFactor = bevelSegments === 1 ? actualBevelSize : actualBevelSize * 0.7071; // cos(45°) for rounded

  // Layer 0: Front cap face
  for (const p of shape.points) {
    vertices.push(new Vec3(p.x, yFront, p.z));
  }

  // Layer 1: Front bevel inner edge (inset)
  for (const p of shape.points) {
    const inset = calculateInset(shape, p, insetFactor);
    vertices.push(new Vec3(p.x - inset.x, yFrontBevel, p.z - inset.z));
  }

  // Additional bevel segments if segments > 1 (rounded bevel)
  if (bevelSegments > 1) {
    for (let seg = 1; seg < bevelSegments; seg++) {
      const t = seg / bevelSegments;
      const angle = t * Math.PI / 2; // 0 to 90 degrees
      const y = yFrontBevel + (yBackBevel - yFrontBevel) * t;
      const insetAmount = actualBevelSize * (1 - Math.cos(angle));

      for (const p of shape.points) {
        const inset = calculateInset(shape, p, insetAmount);
        vertices.push(new Vec3(p.x - inset.x, y, p.z - inset.z));
      }
    }
  }

  // Layer N-2: Back bevel inner edge (inset)
  for (const p of shape.points) {
    const inset = calculateInset(shape, p, insetFactor);
    vertices.push(new Vec3(p.x - inset.x, yBackBevel, p.z - inset.z));
  }

  // Layer N-1: Back cap face
  for (const p of shape.points) {
    vertices.push(new Vec3(p.x, yBack, p.z));
  }

  // Generate side faces connecting all layers
  const layerCount = 2 + (bevelSegments > 1 ? bevelSegments - 1 : 0) + 2;
  for (let layer = 0; layer < layerCount - 1; layer++) {
    const baseIdx = layer * pointCount;
    const nextLayerIdx = (layer + 1) * pointCount;

    for (let i = 0; i < pointCount; i++) {
      const i1 = baseIdx + i;
      const i2 = baseIdx + ((i + 1) % pointCount);
      const i3 = nextLayerIdx + i;
      const i4 = nextLayerIdx + ((i + 1) % pointCount);

      // Create quad as two triangles
      faces.push([i1, i2, i4]);
      faces.push([i1, i4, i3]);
    }
  }

  // Generate caps
  if (caps === 'front' || caps === 'both') {
    const frontFace = triangulatePolygon(shape, true);
    faces.push(...frontFace);
  }

  if (caps === 'back' || caps === 'both') {
    const lastLayerOffset = (layerCount - 1) * pointCount;
    const backFace = triangulatePolygon(shape, false).map(face =>
      face.map(idx => idx + lastLayerOffset)
    );
    faces.push(...backFace);
  }

  // Calculate normals for all vertices
  calculateNormals(vertices, faces, normals);

  return { vertices, faces, normals };
}

/**
 * Calculate inset direction for a point on the shape boundary
 * (Simplified: moves toward center)
 */
function calculateInset(shape: Shape2D, point: { x: number; z: number }, amount: number): { x: number; z: number } {
  // Calculate shape center
  let centerX = 0, centerZ = 0;
  for (const p of shape.points) {
    centerX += p.x;
    centerZ += p.z;
  }
  centerX /= shape.points.length;
  centerZ /= shape.points.length;

  // Direction from point to center
  const dx = centerX - point.x;
  const dz = centerZ - point.z;
  const len = Math.sqrt(dx * dx + dz * dz);

  if (len < 0.0001) {
    return { x: 0, z: 0 };
  }

  // Normalize and scale by amount
  return {
    x: (dx / len) * amount,
    z: (dz / len) * amount
  };
}

/**
 * Contour definition for multi-contour extrusion
 */
export interface Contour {
  points: { x: number; z: number }[];
  isHole: boolean;
}

/**
 * Extrude a 2D shape with holes into 3D geometry
 *
 * This function properly handles shapes with inner holes (like the letter O)
 * by using earcut's hole support for correct triangulation.
 *
 * @param outerContour - The outer boundary of the shape
 * @param holes - Array of hole contours (inner cutouts)
 * @param params - Extrusion parameters
 * @returns Extruded geometry with vertices, faces, and normals
 */
export function extrude2DWithHoles(
  outerContour: { x: number; z: number }[],
  holes: { x: number; z: number }[][],
  params: ExtrudeParams
): ExtrudedGeometry {
  const { depth, caps = 'both', offset = 0 } = params;

  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  const normals: Vec3[] = [];

  const yFront = offset;
  const yBack = offset + depth;

  // Build combined point array: outer contour followed by hole contours
  const allPoints: { x: number; z: number }[] = [...outerContour];
  const holeIndices: number[] = [];

  for (const hole of holes) {
    holeIndices.push(allPoints.length);  // Start index of this hole
    allPoints.push(...hole);
  }

  const totalPoints = allPoints.length;
  const outerPointCount = outerContour.length;

  // Create front face vertices (at Y = offset)
  for (const p of allPoints) {
    vertices.push(new Vec3(p.x, yFront, p.z));
  }

  // Create back face vertices (at Y = offset + depth)
  for (const p of allPoints) {
    vertices.push(new Vec3(p.x, yBack, p.z));
  }

  // Generate side faces for outer contour
  for (let i = 0; i < outerPointCount; i++) {
    const i1 = i;
    const i2 = (i + 1) % outerPointCount;
    const i3 = i1 + totalPoints;
    const i4 = i2 + totalPoints;

    faces.push([i1, i2, i4]);
    faces.push([i1, i4, i3]);
  }

  // Generate side faces for each hole (wound in opposite direction)
  let holeStart = outerPointCount;
  for (const hole of holes) {
    const holeLen = hole.length;
    for (let i = 0; i < holeLen; i++) {
      const i1 = holeStart + i;
      const i2 = holeStart + ((i + 1) % holeLen);
      const i3 = i1 + totalPoints;
      const i4 = i2 + totalPoints;

      // Reverse winding for holes (inside faces outward)
      faces.push([i1, i4, i2]);
      faces.push([i1, i3, i4]);
    }
    holeStart += holeLen;
  }

  // Generate caps with holes using earcut
  if (caps === 'front' || caps === 'both') {
    const frontFaces = triangulateWithHoles(allPoints, holeIndices, true);
    faces.push(...frontFaces);
  }

  if (caps === 'back' || caps === 'both') {
    const backFaces = triangulateWithHoles(allPoints, holeIndices, false).map(face =>
      face.map(idx => idx + totalPoints)
    );
    faces.push(...backFaces);
  }

  // Calculate normals
  calculateNormals(vertices, faces, normals);

  return { vertices, faces, normals };
}

/**
 * Triangulate a polygon with holes using earcut
 */
function triangulateWithHoles(
  points: { x: number; z: number }[],
  holeIndices: number[],
  counterClockwise: boolean
): number[][] {
  const faces: number[][] = [];

  if (points.length < 3) {
    return faces;
  }

  // Flatten points for earcut: [x0, z0, x1, z1, ...]
  const flatPoints: number[] = [];
  for (const p of points) {
    flatPoints.push(p.x, p.z);
  }

  // Use earcut with hole indices
  const triangleIndices = earcut(flatPoints, holeIndices.length > 0 ? holeIndices : undefined);

  // Convert flat indices to face arrays
  for (let i = 0; i < triangleIndices.length; i += 3) {
    if (counterClockwise) {
      faces.push([triangleIndices[i], triangleIndices[i + 1], triangleIndices[i + 2]]);
    } else {
      faces.push([triangleIndices[i], triangleIndices[i + 2], triangleIndices[i + 1]]);
    }
  }

  return faces;
}

/**
 * Triangulate a 2D polygon for cap generation
 * Uses earcut algorithm for proper triangulation of concave polygons
 *
 * @param shape - The 2D shape to triangulate
 * @param counterClockwise - If true, generate CCW faces (front cap), else CW (back cap)
 * @returns Array of triangular faces (indices)
 */
function triangulatePolygon(shape: Shape2D, counterClockwise: boolean): number[][] {
  const faces: number[][] = [];
  const pointCount = shape.points.length;

  if (pointCount < 3) {
    return faces;
  }

  // Flatten points for earcut: [x0, z0, x1, z1, ...]
  const flatPoints: number[] = [];
  for (const p of shape.points) {
    flatPoints.push(p.x, p.z);
  }

  // Use earcut for proper triangulation of concave polygons
  const triangleIndices = earcut(flatPoints);

  // Convert flat indices to face arrays
  for (let i = 0; i < triangleIndices.length; i += 3) {
    if (counterClockwise) {
      // CCW winding for front face (looking down -Y axis)
      faces.push([triangleIndices[i], triangleIndices[i + 1], triangleIndices[i + 2]]);
    } else {
      // CW winding for back face (looking down +Y axis)
      faces.push([triangleIndices[i], triangleIndices[i + 2], triangleIndices[i + 1]]);
    }
  }

  return faces;
}

/**
 * Calculate per-vertex normals from face data
 *
 * @param vertices - Array of vertex positions
 * @param faces - Array of face indices
 * @param normals - Output array for normals (will be filled)
 */
function calculateNormals(vertices: Vec3[], faces: number[][], normals: Vec3[]): void {
  // Initialize normals to zero
  for (let i = 0; i < vertices.length; i++) {
    normals.push(new Vec3(0, 0, 0));
  }

  // Accumulate face normals
  for (const face of faces) {
    if (face.length < 3) continue;

    const v0 = vertices[face[0]];
    const v1 = vertices[face[1]];
    const v2 = vertices[face[2]];

    // Calculate face normal using cross product
    const edge1 = v1.sub(v0);
    const edge2 = v2.sub(v0);
    const faceNormal = edge1.cross(edge2);

    // Accumulate to vertex normals
    for (const idx of face) {
      normals[idx] = normals[idx].add(faceNormal);
    }
  }

  // Normalize all normals
  for (let i = 0; i < normals.length; i++) {
    const normalized = normals[i].normalize();
    if (normalized.length() > 0.0001) {
      normals[i] = normalized;
    } else {
      normals[i] = new Vec3(0, 1, 0); // Default normal if zero length
    }
  }
}

/**
 * Helper to create extruded mesh from Shape2D definition
 * Useful for YAML integration
 */
export function extrudeShape(
  type: 'rect' | 'circle' | 'ellipse' | 'polygon',
  shapeParams: any,
  extrudeParams: ExtrudeParams
): ExtrudedGeometry {
  let shape: Shape2D;

  switch (type) {
    case 'rect':
      shape = Shape2D.rect(
        shapeParams.width || 1,
        shapeParams.height || 1,
        shapeParams.center
      );
      break;
    case 'circle':
      shape = Shape2D.circle(
        shapeParams.radius || 1,
        shapeParams.segments || 32,
        shapeParams.center
      );
      break;
    case 'ellipse':
      shape = Shape2D.ellipse(
        shapeParams.radiusX || 1,
        shapeParams.radiusZ || 1,
        shapeParams.segments || 32,
        shapeParams.center
      );
      break;
    case 'polygon':
      shape = Shape2D.polygon(shapeParams.points || []);
      break;
    default:
      throw new Error(`Unknown shape type: ${type}`);
  }

  return extrude2D(shape, extrudeParams);
}
