/**
 * Mesh Analysis Pipeline (G4-001)
 *
 * Analyzes mesh geometry to extract per-vertex attributes needed for
 * procedural texturing: curvature, ambient occlusion, world position.
 *
 * All analysis is deterministic - same mesh produces same results.
 */

import { Mesh } from '../geometry/Mesh';
import { Vec3 } from '../math/Vec3';
import { Face } from '../geometry/Face';

/**
 * Per-vertex analysis data
 */
export interface VertexAnalysis {
  /** Vertex index */
  index: number;
  /** World position */
  position: Vec3;
  /** Vertex normal (averaged from adjacent faces) */
  normal: Vec3;
  /** Curvature: -1 (concave/valley) to +1 (convex/ridge), 0 = flat */
  curvature: number;
  /** Ambient occlusion: 0 (fully occluded) to 1 (fully exposed) */
  ambientOcclusion: number;
}

/**
 * Complete mesh analysis result
 */
export interface MeshAnalysis {
  /** Per-vertex analysis data */
  vertices: VertexAnalysis[];
  /** Global statistics */
  stats: {
    minCurvature: number;
    maxCurvature: number;
    meanCurvature: number;
    minAO: number;
    maxAO: number;
    meanAO: number;
  };
}

/**
 * Options for mesh analysis
 */
export interface MeshAnalysisOptions {
  /** Number of rays for AO sampling (default: 32) */
  aoRays?: number;
  /** Maximum distance for AO rays (default: auto from mesh size) */
  aoMaxDistance?: number;
  /** Random seed for AO sampling (default: 42) */
  aoSeed?: number;
  /** Whether to compute curvature (default: true) */
  computeCurvature?: boolean;
  /** Whether to compute AO (default: true) */
  computeAO?: boolean;
  /** When true, write computed normals back to vertex.attributes.normal.
   *  This makes normals available to the GLTFExporter and other downstream
   *  consumers without requiring separate normal computation. (default: false) */
  writeNormalsToMesh?: boolean;
}

/**
 * Calculate face normal from vertex positions
 */
function calculateFaceNormal(mesh: Mesh, face: Face): Vec3 {
  if (face.indices.length < 3) {
    return new Vec3(0, 1, 0);
  }

  const p0 = mesh.vertices[face.indices[0]].position;
  const p1 = mesh.vertices[face.indices[1]].position;
  const p2 = mesh.vertices[face.indices[2]].position;

  const v1 = p1.sub(p0);
  const v2 = p2.sub(p0);
  const normal = v1.cross(v2);

  const len = normal.length();
  if (len < 0.0001) {
    return new Vec3(0, 1, 0);
  }
  return normal.mul(1 / len);
}

/**
 * Calculate per-vertex normals by averaging adjacent face normals.
 *
 * When smoothGroup metadata is present, vertices with the same smoothGroup
 * AND same position share accumulated normals — even if they have different
 * indices (e.g. after UV unwrapping splits vertices at seams).
 *
 * When no smoothGroup metadata exists, falls back to index-based averaging:
 * - Shared vertices (same index) → smooth shading
 * - Duplicated vertices (same position, different index) → hard edges
 */
function calculateVertexNormals(mesh: Mesh): Vec3[] {
  const normals: Vec3[] = new Array(mesh.vertices.length);
  for (let i = 0; i < mesh.vertices.length; i++) {
    normals[i] = new Vec3(0, 0, 0);
  }

  // Accumulate face normals to vertices
  for (const face of mesh.faces) {
    const faceNormal = calculateFaceNormal(mesh, face);
    for (const idx of face.indices) {
      normals[idx] = normals[idx].add(faceNormal);
    }
  }

  // If smoothGroup metadata is present, share normals across vertices
  // that have the same smoothGroup and same position (UV-split siblings)
  const hasSmoothGroups = mesh.vertices.some(v => v.attributes.smoothGroup !== undefined);

  if (hasSmoothGroups) {
    // Group vertices by (smoothGroup, position) — these should share normals
    const groupMap = new Map<string, number[]>();
    for (let i = 0; i < mesh.vertices.length; i++) {
      const v = mesh.vertices[i];
      const sg = v.attributes.smoothGroup;
      if (sg !== undefined) {
        const p = v.position;
        const key = `${sg}-${p.x.toFixed(6)}-${p.y.toFixed(6)}-${p.z.toFixed(6)}`;
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key)!.push(i);
      }
    }

    // Merge accumulated normals for vertices in the same smooth group at the same position
    for (const indices of groupMap.values()) {
      if (indices.length <= 1) continue;
      let shared = new Vec3(0, 0, 0);
      for (const idx of indices) {
        shared = shared.add(normals[idx]);
      }
      for (const idx of indices) {
        normals[idx] = shared;
      }
    }
  }

  // Normalize
  for (let i = 0; i < normals.length; i++) {
    const len = normals[i].length();
    if (len > 0.0001) {
      normals[i] = normals[i].mul(1 / len);
    } else {
      normals[i] = new Vec3(0, 1, 0);
    }
  }

  return normals;
}

/**
 * Build adjacency map: vertex index -> list of adjacent vertex indices
 */
function buildAdjacencyMap(mesh: Mesh): Map<number, Set<number>> {
  const adjacency = new Map<number, Set<number>>();

  for (let i = 0; i < mesh.vertices.length; i++) {
    adjacency.set(i, new Set());
  }

  for (const face of mesh.faces) {
    const n = face.indices.length;
    for (let i = 0; i < n; i++) {
      const v0 = face.indices[i];
      const v1 = face.indices[(i + 1) % n];
      adjacency.get(v0)!.add(v1);
      adjacency.get(v1)!.add(v0);
    }
  }

  return adjacency;
}

/**
 * Calculate curvature at a vertex based on angle between vertex normal
 * and normals of adjacent vertices.
 *
 * Positive = convex (ridge/edge)
 * Negative = concave (valley/crease)
 * Zero = flat
 */
function calculateVertexCurvature(
  vertexIdx: number,
  vertexNormals: Vec3[],
  adjacency: Map<number, Set<number>>,
  mesh: Mesh
): number {
  const neighbors = adjacency.get(vertexIdx);
  if (!neighbors || neighbors.size === 0) {
    return 0;
  }

  const myNormal = vertexNormals[vertexIdx];
  const myPos = mesh.vertices[vertexIdx].position;

  let totalCurvature = 0;
  let count = 0;

  for (const neighborIdx of neighbors) {
    const neighborNormal = vertexNormals[neighborIdx];
    const neighborPos = mesh.vertices[neighborIdx].position;

    // Direction from this vertex to neighbor
    const toNeighbor = neighborPos.sub(myPos);
    const dist = toNeighbor.length();
    if (dist < 0.0001) continue;

    const toNeighborNorm = toNeighbor.mul(1 / dist);

    // Curvature is based on how much the normal changes along the edge
    // If normals point away from each other (convex), dot product of
    // (neighborNormal - myNormal) with edge direction is positive
    const normalDiff = neighborNormal.sub(myNormal);
    const curvatureContrib = normalDiff.dot(toNeighborNorm);

    totalCurvature += curvatureContrib;
    count++;
  }

  if (count === 0) return 0;

  // Normalize to roughly [-1, 1] range
  // The factor depends on mesh scale, so we use a heuristic
  const avgCurvature = totalCurvature / count;
  return Math.max(-1, Math.min(1, avgCurvature * 2));
}

/**
 * Simple seeded random number generator for deterministic AO
 */
class SeededRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  // Generate point on hemisphere oriented along normal
  hemispherePoint(normal: Vec3): Vec3 {
    // Generate random point on sphere using spherical coordinates
    const theta = this.next() * Math.PI * 2;
    const phi = Math.acos(1 - 2 * this.next());

    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.sin(phi) * Math.sin(theta);
    const z = Math.cos(phi);

    const randomDir = new Vec3(x, y, z);

    // Flip to hemisphere if pointing away from normal
    if (randomDir.dot(normal) < 0) {
      return randomDir.mul(-1);
    }
    return randomDir;
  }
}

/**
 * Simple ray-triangle intersection test
 */
function rayTriangleIntersect(
  rayOrigin: Vec3,
  rayDir: Vec3,
  v0: Vec3,
  v1: Vec3,
  v2: Vec3,
  maxDist: number
): boolean {
  const EPSILON = 0.0001;

  const edge1 = v1.sub(v0);
  const edge2 = v2.sub(v0);
  const h = rayDir.cross(edge2);
  const a = edge1.dot(h);

  if (a > -EPSILON && a < EPSILON) {
    return false; // Ray parallel to triangle
  }

  const f = 1 / a;
  const s = rayOrigin.sub(v0);
  const u = f * s.dot(h);

  if (u < 0 || u > 1) {
    return false;
  }

  const q = s.cross(edge1);
  const v = f * rayDir.dot(q);

  if (v < 0 || u + v > 1) {
    return false;
  }

  const t = f * edge2.dot(q);

  return t > EPSILON && t < maxDist;
}

/**
 * Calculate ambient occlusion at a vertex by casting rays
 */
function calculateVertexAO(
  vertexIdx: number,
  mesh: Mesh,
  vertexNormals: Vec3[],
  numRays: number,
  maxDistance: number,
  rng: SeededRNG
): number {
  const position = mesh.vertices[vertexIdx].position;
  const normal = vertexNormals[vertexIdx];

  // Offset slightly along normal to avoid self-intersection
  const rayOrigin = position.add(normal.mul(0.001));

  let occluded = 0;

  // Precompute triangles for intersection testing
  const triangles: Array<[Vec3, Vec3, Vec3]> = [];
  for (const face of mesh.faces) {
    const tris = face.triangulate();
    for (const tri of tris) {
      triangles.push([
        mesh.vertices[tri.indices[0]].position,
        mesh.vertices[tri.indices[1]].position,
        mesh.vertices[tri.indices[2]].position
      ]);
    }
  }

  for (let i = 0; i < numRays; i++) {
    const rayDir = rng.hemispherePoint(normal);

    // Check intersection with all triangles
    for (const [v0, v1, v2] of triangles) {
      if (rayTriangleIntersect(rayOrigin, rayDir, v0, v1, v2, maxDistance)) {
        occluded++;
        break; // One hit is enough
      }
    }
  }

  // AO = 1 - occlusion ratio
  return 1 - (occluded / numRays);
}

/**
 * Analyze mesh to extract per-vertex curvature, AO, and position data.
 *
 * @param mesh The mesh to analyze
 * @param options Analysis options
 * @returns MeshAnalysis with per-vertex data and statistics
 */
export function analyzeMesh(mesh: Mesh, options: MeshAnalysisOptions = {}): MeshAnalysis {
  const {
    aoRays = 32,
    aoSeed = 42,
    computeCurvature = true,
    computeAO = true,
    writeNormalsToMesh = false
  } = options;

  // Calculate mesh bounds for auto AO distance
  const bounds = mesh.getBounds();
  const meshSize = Math.max(
    bounds.max.x - bounds.min.x,
    bounds.max.y - bounds.min.y,
    bounds.max.z - bounds.min.z
  );
  const aoMaxDistance = options.aoMaxDistance ?? meshSize * 0.5;

  // Calculate vertex normals (smoothGroup-aware when available)
  const vertexNormals = calculateVertexNormals(mesh);

  // Optionally write computed normals back to the mesh vertices
  // so downstream consumers (GLTFExporter, dashboard) can use them directly
  if (writeNormalsToMesh) {
    for (let i = 0; i < mesh.vertices.length; i++) {
      mesh.vertices[i].attributes.normal = vertexNormals[i];
    }
  }

  // Build adjacency for curvature calculation
  const adjacency = computeCurvature ? buildAdjacencyMap(mesh) : null;

  // RNG for AO
  const rng = new SeededRNG(aoSeed);

  // Analyze each vertex
  const vertices: VertexAnalysis[] = [];
  let minCurvature = Infinity;
  let maxCurvature = -Infinity;
  let sumCurvature = 0;
  let minAO = Infinity;
  let maxAO = -Infinity;
  let sumAO = 0;

  for (let i = 0; i < mesh.vertices.length; i++) {
    const position = mesh.vertices[i].position;
    const normal = vertexNormals[i];

    // Calculate curvature
    let curvature = 0;
    if (computeCurvature && adjacency) {
      curvature = calculateVertexCurvature(i, vertexNormals, adjacency, mesh);
    }
    minCurvature = Math.min(minCurvature, curvature);
    maxCurvature = Math.max(maxCurvature, curvature);
    sumCurvature += curvature;

    // Calculate AO
    let ao = 1;
    if (computeAO) {
      ao = calculateVertexAO(i, mesh, vertexNormals, aoRays, aoMaxDistance, rng);
    }
    minAO = Math.min(minAO, ao);
    maxAO = Math.max(maxAO, ao);
    sumAO += ao;

    vertices.push({
      index: i,
      position,
      normal,
      curvature,
      ambientOcclusion: ao
    });
  }

  const n = mesh.vertices.length || 1;

  return {
    vertices,
    stats: {
      minCurvature: minCurvature === Infinity ? 0 : minCurvature,
      maxCurvature: maxCurvature === -Infinity ? 0 : maxCurvature,
      meanCurvature: sumCurvature / n,
      minAO: minAO === Infinity ? 1 : minAO,
      maxAO: maxAO === -Infinity ? 1 : maxAO,
      meanAO: sumAO / n
    }
  };
}

/**
 * Get curvature value for a vertex, with optional normalization
 */
export function getCurvature(analysis: MeshAnalysis, vertexIndex: number, normalize = false): number {
  if (vertexIndex < 0 || vertexIndex >= analysis.vertices.length) {
    return 0;
  }

  const curvature = analysis.vertices[vertexIndex].curvature;

  if (!normalize) {
    return curvature;
  }

  // Normalize to [0, 1] range
  const range = analysis.stats.maxCurvature - analysis.stats.minCurvature;
  if (range < 0.0001) {
    return 0.5;
  }
  return (curvature - analysis.stats.minCurvature) / range;
}

/**
 * Get ambient occlusion value for a vertex
 */
export function getAO(analysis: MeshAnalysis, vertexIndex: number): number {
  if (vertexIndex < 0 || vertexIndex >= analysis.vertices.length) {
    return 1;
  }
  return analysis.vertices[vertexIndex].ambientOcclusion;
}

/**
 * Sample analysis at a UV coordinate using barycentric interpolation
 * (Requires face UV data and is more complex - simplified version here)
 */
export function sampleAtUV(
  _analysis: MeshAnalysis,
  _mesh: Mesh,
  _u: number,
  _v: number
): { curvature: number; ao: number; position: Vec3; normal: Vec3 } | null {
  // Full implementation would:
  // 1. Find which face contains the UV coordinate
  // 2. Calculate barycentric coordinates
  // 3. Interpolate vertex analysis values

  // For now, return null - full UV sampling requires baking to texture
  return null;
}

/**
 * Bake analysis to a UV-space texture (simplified - returns vertex data array)
 *
 * Full texture baking would rasterize to a 2D image, but that requires
 * image processing infrastructure. This returns the per-vertex data
 * which can be used for per-vertex shading.
 */
export function bakeToVertexBuffer(analysis: MeshAnalysis): {
  positions: Float32Array;
  normals: Float32Array;
  curvatures: Float32Array;
  ambientOcclusion: Float32Array;
} {
  const n = analysis.vertices.length;

  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  const curvatures = new Float32Array(n);
  const ambientOcclusion = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const v = analysis.vertices[i];

    positions[i * 3] = v.position.x;
    positions[i * 3 + 1] = v.position.y;
    positions[i * 3 + 2] = v.position.z;

    normals[i * 3] = v.normal.x;
    normals[i * 3 + 1] = v.normal.y;
    normals[i * 3 + 2] = v.normal.z;

    curvatures[i] = v.curvature;
    ambientOcclusion[i] = v.ambientOcclusion;
  }

  return { positions, normals, curvatures, ambientOcclusion };
}

/**
 * Remap a full-mesh MeshAnalysis to a sub-mesh using a vertex index mapping.
 *
 * This allows running analyzeMesh() once on the full mesh, then extracting
 * analysis subsets for per-material sub-meshes without re-analyzing.
 * AO computed on the full mesh is more correct than per-sub-mesh AO because
 * it accounts for occlusion from geometry in other material groups.
 *
 * @param fullAnalysis - Analysis from the full mesh
 * @param vertexMap - Map from original (full mesh) vertex index to sub-mesh vertex index
 * @param subMeshVertexCount - Number of vertices in the sub-mesh
 */
export function remapAnalysis(
  fullAnalysis: MeshAnalysis,
  vertexMap: Map<number, number>,
  subMeshVertexCount: number
): MeshAnalysis {
  const vertices: VertexAnalysis[] = new Array(subMeshVertexCount);

  // Initialize with defaults
  for (let i = 0; i < subMeshVertexCount; i++) {
    vertices[i] = {
      index: i,
      position: new Vec3(0, 0, 0),
      normal: new Vec3(0, 1, 0),
      curvature: 0,
      ambientOcclusion: 1
    };
  }

  // Copy analysis data using the vertex mapping
  let minCurvature = Infinity;
  let maxCurvature = -Infinity;
  let sumCurvature = 0;
  let minAO = Infinity;
  let maxAO = -Infinity;
  let sumAO = 0;

  for (const [originalIdx, subMeshIdx] of vertexMap) {
    if (originalIdx < fullAnalysis.vertices.length && subMeshIdx < subMeshVertexCount) {
      const src = fullAnalysis.vertices[originalIdx];
      vertices[subMeshIdx] = {
        index: subMeshIdx,
        position: src.position,
        normal: src.normal,
        curvature: src.curvature,
        ambientOcclusion: src.ambientOcclusion
      };

      minCurvature = Math.min(minCurvature, src.curvature);
      maxCurvature = Math.max(maxCurvature, src.curvature);
      sumCurvature += src.curvature;
      minAO = Math.min(minAO, src.ambientOcclusion);
      maxAO = Math.max(maxAO, src.ambientOcclusion);
      sumAO += src.ambientOcclusion;
    }
  }

  const n = subMeshVertexCount || 1;

  return {
    vertices,
    stats: {
      minCurvature: minCurvature === Infinity ? 0 : minCurvature,
      maxCurvature: maxCurvature === -Infinity ? 0 : maxCurvature,
      meanCurvature: sumCurvature / n,
      minAO: minAO === Infinity ? 1 : minAO,
      maxAO: maxAO === -Infinity ? 1 : maxAO,
      meanAO: sumAO / n
    }
  };
}
