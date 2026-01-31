/**
 * Subdivision Surfaces - Catmull-Clark algorithm
 *
 * Transforms a low-poly control cage into a smooth organic surface.
 * Essential for character modeling where we define rough shape and
 * subdivide to get smooth skin.
 *
 * Algorithm:
 * 1. Create face points (average of face vertices)
 * 2. Create edge points (average of edge endpoints + adjacent face points)
 * 3. Move original vertices (weighted by face points and edge midpoints)
 * 4. Create new faces (one quad per original face corner)
 */

import { Vec3 } from '../math/Vec3';
import { Mesh } from './Mesh';
import { Vertex } from './Vertex';
import { Face } from './Face';

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * Perform one level of Catmull-Clark subdivision
 */
export function subdivideCatmullClark(mesh: Mesh): Mesh {
  const newMesh = new Mesh();

  // Maps for tracking new vertices
  const facePoints: Map<number, number> = new Map(); // faceIndex → new vertex index
  const edgePoints: Map<string, number> = new Map(); // edgeKey → new vertex index
  const vertexPoints: Map<number, number> = new Map(); // old vertex → new vertex index

  // Build adjacency data
  const vertexFaces: Map<number, number[]> = new Map(); // vertex → adjacent face indices
  const vertexEdges: Map<number, string[]> = new Map(); // vertex → adjacent edge keys
  const edgeFaces: Map<string, number[]> = new Map(); // edge → adjacent face indices

  // Initialize vertex maps
  for (let i = 0; i < mesh.vertices.length; i++) {
    vertexFaces.set(i, []);
    vertexEdges.set(i, []);
  }

  // Build adjacency from faces
  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];
    const n = face.indices.length;

    for (let i = 0; i < n; i++) {
      const v1 = face.indices[i];
      const v2 = face.indices[(i + 1) % n];

      // Track face adjacency for vertices
      vertexFaces.get(v1)!.push(fi);

      // Track edges
      const ek = edgeKey(v1, v2);
      if (!vertexEdges.get(v1)!.includes(ek)) {
        vertexEdges.get(v1)!.push(ek);
      }
      if (!vertexEdges.get(v2)!.includes(ek)) {
        vertexEdges.get(v2)!.push(ek);
      }

      // Track edge-face adjacency
      if (!edgeFaces.has(ek)) {
        edgeFaces.set(ek, []);
      }
      edgeFaces.get(ek)!.push(fi);
    }
  }

  // =========================================================================
  // Step 1: Create face points
  // =========================================================================
  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];

    // Face point = average of all vertices in face
    let sum = new Vec3(0, 0, 0);
    for (const vi of face.indices) {
      sum = sum.add(mesh.vertices[vi].position);
    }
    const facePoint = sum.mul(1 / face.indices.length);

    const newIndex = newMesh.addVertex(new Vertex(facePoint));
    facePoints.set(fi, newIndex);
  }

  // =========================================================================
  // Step 2: Create edge points
  // =========================================================================
  for (const [ek, adjacentFaces] of edgeFaces) {
    const [v1Str, v2Str] = ek.split('-');
    const v1 = parseInt(v1Str);
    const v2 = parseInt(v2Str);

    const p1 = mesh.vertices[v1].position;
    const p2 = mesh.vertices[v2].position;

    let edgePoint: Vec3;

    if (adjacentFaces.length === 2) {
      // Interior edge: average of endpoints and adjacent face points
      const fp1Idx = facePoints.get(adjacentFaces[0])!;
      const fp2Idx = facePoints.get(adjacentFaces[1])!;
      const fp1 = newMesh.vertices[fp1Idx].position;
      const fp2 = newMesh.vertices[fp2Idx].position;

      edgePoint = p1.add(p2).add(fp1).add(fp2).mul(0.25);
    } else {
      // Boundary edge: just average of endpoints
      edgePoint = p1.add(p2).mul(0.5);
    }

    const newIndex = newMesh.addVertex(new Vertex(edgePoint));
    edgePoints.set(ek, newIndex);
  }

  // =========================================================================
  // Step 3: Move original vertices
  // =========================================================================
  for (let vi = 0; vi < mesh.vertices.length; vi++) {
    const P = mesh.vertices[vi].position;
    const adjacentFaceIndices = vertexFaces.get(vi)!;
    const adjacentEdgeKeys = vertexEdges.get(vi)!;
    const n = adjacentFaceIndices.length;

    // Check if boundary vertex (any adjacent edge has only 1 face)
    const isBoundary = adjacentEdgeKeys.some(ek => edgeFaces.get(ek)!.length === 1);

    let newPos: Vec3;

    if (isBoundary) {
      // Boundary vertex: average of vertex and adjacent boundary edge midpoints
      let sum = P;
      let count = 1;

      for (const ek of adjacentEdgeKeys) {
        if (edgeFaces.get(ek)!.length === 1) {
          const [v1Str, v2Str] = ek.split('-');
          const v1 = parseInt(v1Str);
          const v2 = parseInt(v2Str);
          const midpoint = mesh.vertices[v1].position.add(mesh.vertices[v2].position).mul(0.5);
          sum = sum.add(midpoint);
          count++;
        }
      }

      newPos = sum.mul(1 / count);
    } else {
      // Interior vertex: Catmull-Clark formula
      // newP = (F + 2R + (n-3)P) / n
      // where F = average of adjacent face points
      //       R = average of adjacent edge midpoints
      //       n = valence (number of adjacent edges)

      // Average of face points
      let F = new Vec3(0, 0, 0);
      for (const fi of adjacentFaceIndices) {
        const fpIdx = facePoints.get(fi)!;
        F = F.add(newMesh.vertices[fpIdx].position);
      }
      F = F.mul(1 / adjacentFaceIndices.length);

      // Average of edge midpoints (original edge midpoints, not new edge points)
      let R = new Vec3(0, 0, 0);
      for (const ek of adjacentEdgeKeys) {
        const [v1Str, v2Str] = ek.split('-');
        const v1 = parseInt(v1Str);
        const v2 = parseInt(v2Str);
        const midpoint = mesh.vertices[v1].position.add(mesh.vertices[v2].position).mul(0.5);
        R = R.add(midpoint);
      }
      R = R.mul(1 / adjacentEdgeKeys.length);

      // Apply formula
      newPos = F.add(R.mul(2)).add(P.mul(n - 3)).mul(1 / n);
    }

    const newIndex = newMesh.addVertex(new Vertex(newPos));
    vertexPoints.set(vi, newIndex);
  }

  // =========================================================================
  // Step 4: Create new faces
  // =========================================================================
  // For each original face, create n new quads (one per corner)
  // Each quad connects: facePoint, edgePoint1, originalVertex, edgePoint2

  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];
    const n = face.indices.length;
    const fpIdx = facePoints.get(fi)!;

    for (let i = 0; i < n; i++) {
      const v0 = face.indices[i];
      const v1 = face.indices[(i + 1) % n];
      const vPrev = face.indices[(i + n - 1) % n];

      const ek1 = edgeKey(vPrev, v0);
      const ek2 = edgeKey(v0, v1);

      const ep1Idx = edgePoints.get(ek1)!;
      const vNewIdx = vertexPoints.get(v0)!;
      const ep2Idx = edgePoints.get(ek2)!;

      // Create quad: facePoint → edgePoint1 → movedVertex → edgePoint2
      // Winding order preserved from original face
      newMesh.addFace(new Face([fpIdx, ep1Idx, vNewIdx, ep2Idx]));
    }
  }

  return newMesh;
}

/**
 * Apply multiple levels of subdivision
 */
export function subdivide(mesh: Mesh, levels: number): Mesh {
  let result = mesh;
  for (let i = 0; i < levels; i++) {
    result = subdivideCatmullClark(result);
  }
  return result;
}

/**
 * Create an icosphere - better for subdivision than UV sphere
 * Starts with icosahedron and subdivides
 */
export function createIcosphere(radius: number, subdivisions: number): Mesh {
  const mesh = new Mesh();

  // Golden ratio
  const phi = (1 + Math.sqrt(5)) / 2;

  // Icosahedron vertices (normalized then scaled)
  const verts = [
    new Vec3(-1, phi, 0),
    new Vec3(1, phi, 0),
    new Vec3(-1, -phi, 0),
    new Vec3(1, -phi, 0),
    new Vec3(0, -1, phi),
    new Vec3(0, 1, phi),
    new Vec3(0, -1, -phi),
    new Vec3(0, 1, -phi),
    new Vec3(phi, 0, -1),
    new Vec3(phi, 0, 1),
    new Vec3(-phi, 0, -1),
    new Vec3(-phi, 0, 1),
  ];

  // Normalize and scale
  for (const v of verts) {
    const normalized = v.normalize().mul(radius);
    mesh.addVertex(new Vertex(normalized));
  }

  // Icosahedron faces (triangles)
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  for (const [a, b, c] of faces) {
    mesh.addFace(new Face([a, b, c]));
  }

  // Subdivide (but project back to sphere after each level)
  let result = mesh;
  for (let i = 0; i < subdivisions; i++) {
    result = subdivideAndProject(result, radius);
  }

  return result;
}

/**
 * Subdivide and project vertices back to sphere surface
 * (For icosphere, not general Catmull-Clark)
 */
function subdivideAndProject(mesh: Mesh, radius: number): Mesh {
  const newMesh = new Mesh();
  const edgeMidpoints: Map<string, number> = new Map();

  // Copy original vertices
  for (const v of mesh.vertices) {
    newMesh.addVertex(new Vertex(v.position.clone()));
  }

  // Create midpoint vertices for each edge
  function getMidpoint(v1: number, v2: number): number {
    const ek = edgeKey(v1, v2);
    if (edgeMidpoints.has(ek)) {
      return edgeMidpoints.get(ek)!;
    }

    const p1 = mesh.vertices[v1].position;
    const p2 = mesh.vertices[v2].position;
    const mid = p1.add(p2).mul(0.5).normalize().mul(radius);

    const idx = newMesh.addVertex(new Vertex(mid));
    edgeMidpoints.set(ek, idx);
    return idx;
  }

  // Subdivide each triangle into 4
  for (const face of mesh.faces) {
    const [a, b, c] = face.indices;

    const ab = getMidpoint(a, b);
    const bc = getMidpoint(b, c);
    const ca = getMidpoint(c, a);

    // 4 new triangles
    newMesh.addFace(new Face([a, ab, ca]));
    newMesh.addFace(new Face([b, bc, ab]));
    newMesh.addFace(new Face([c, ca, bc]));
    newMesh.addFace(new Face([ab, bc, ca]));
  }

  return newMesh;
}

/**
 * Create a subdivided box - good starting point for many shapes
 */
export function createSubdividedBox(
  width: number,
  height: number,
  depth: number,
  subdivisions: number
): Mesh {
  const mesh = new Mesh();

  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;

  // 8 vertices of a box
  mesh.addVertex(new Vertex(new Vec3(-hw, -hh, -hd))); // 0
  mesh.addVertex(new Vertex(new Vec3(hw, -hh, -hd)));  // 1
  mesh.addVertex(new Vertex(new Vec3(hw, hh, -hd)));   // 2
  mesh.addVertex(new Vertex(new Vec3(-hw, hh, -hd)));  // 3
  mesh.addVertex(new Vertex(new Vec3(-hw, -hh, hd)));  // 4
  mesh.addVertex(new Vertex(new Vec3(hw, -hh, hd)));   // 5
  mesh.addVertex(new Vertex(new Vec3(hw, hh, hd)));    // 6
  mesh.addVertex(new Vertex(new Vec3(-hw, hh, hd)));   // 7

  // 6 faces (quads)
  mesh.addFace(new Face([3, 2, 1, 0])); // front
  mesh.addFace(new Face([4, 5, 6, 7])); // back
  mesh.addFace(new Face([0, 1, 5, 4])); // bottom
  mesh.addFace(new Face([7, 6, 2, 3])); // top
  mesh.addFace(new Face([0, 4, 7, 3])); // left
  mesh.addFace(new Face([1, 2, 6, 5])); // right

  return subdivide(mesh, subdivisions);
}

