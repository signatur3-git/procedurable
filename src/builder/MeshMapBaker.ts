/**
 * MeshMapBaker - Generates mesh-derived texture maps
 *
 * Computes maps from mesh geometry:
 * - AO (Ambient Occlusion) - approximated from vertex accessibility
 * - Curvature - from vertex normal differences
 * - Position/Height - world Y coordinate normalized
 *
 * These maps are per-vertex and can be used for:
 * - Smart material masks (wear on edges, dirt in crevices)
 * - Procedural texturing
 * - Layer blending
 */

import { Mesh } from '../geometry/Mesh';
import { Vertex } from '../geometry/Vertex';
import { Vec3 } from '../core/Vec3';

/**
 * Baked mesh maps - per-vertex float values (0-1 range)
 */
export interface BakedMeshMaps {
  /** Ambient occlusion - 0 = fully occluded, 1 = fully exposed */
  ao: Float32Array;

  /** Curvature - 0 = concave, 0.5 = flat, 1 = convex */
  curvature: Float32Array;

  /** Height/position - normalized Y coordinate (0 = bottom, 1 = top) */
  height: Float32Array;

  /** Vertex count */
  vertexCount: number;

  /** Mesh bounds used for normalization */
  bounds: {
    minY: number;
    maxY: number;
  };
}

/**
 * Options for mesh map baking
 */
export interface BakeOptions {
  /** Number of AO samples per vertex (more = better quality, slower) */
  aoSamples?: number;

  /** AO ray distance (how far to check for occlusion) */
  aoDistance?: number;

  /** Curvature radius (how many neighbors to consider) */
  curvatureRadius?: number;
}

const DEFAULT_OPTIONS: Required<BakeOptions> = {
  aoSamples: 16,
  aoDistance: 0.1,
  curvatureRadius: 0.05
};

/**
 * Bake mesh-derived maps from a mesh
 */
export function bakeMeshMaps(mesh: Mesh, options: BakeOptions = {}): BakedMeshMaps {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const vertices = mesh.vertices;
  const faces = mesh.faces;
  const vertexCount = vertices.length;

  if (vertexCount === 0) {
    return {
      ao: new Float32Array(0),
      curvature: new Float32Array(0),
      height: new Float32Array(0),
      vertexCount: 0,
      bounds: { minY: 0, maxY: 0 }
    };
  }

  // Extract vertex positions
  const positions: Vec3[] = vertices.map((v: Vertex) => v.position);

  // Compute bounds
  let minY = Infinity, maxY = -Infinity;
  for (const pos of positions) {
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
  }

  // Compute vertex normals (average of face normals)
  const vertexNormals = computeVertexNormals(positions, faces);

  // Bake each map
  const ao = bakeAO(positions, vertexNormals, faces, opts);
  const curvature = bakeCurvature(positions, vertexNormals, opts);
  const height = bakeHeight(positions, minY, maxY);

  return {
    ao,
    curvature,
    height,
    vertexCount,
    bounds: { minY, maxY }
  };
}

/**
 * Compute per-vertex normals by averaging face normals
 */
function computeVertexNormals(
  positions: Vec3[],
  faces: { indices: number[] }[]
): Vec3[] {
  const normals: Vec3[] = positions.map(() => new Vec3(0, 0, 0));

  for (const face of faces) {
    if (face.indices.length < 3) continue;

    // Compute face normal
    const p0 = positions[face.indices[0]];
    const p1 = positions[face.indices[1]];
    const p2 = positions[face.indices[2]];

    const edge1 = p1.sub(p0);
    const edge2 = p2.sub(p0);
    const faceNormal = edge1.cross(edge2).normalize();

    // Add to all vertices of this face
    for (const idx of face.indices) {
      normals[idx] = normals[idx].add(faceNormal);
    }
  }

  // Normalize
  return normals.map(n => {
    const len = n.length();
    return len > 0.0001 ? n.mul(1 / len) : new Vec3(0, 1, 0);
  });
}

/**
 * Bake ambient occlusion using hemisphere sampling
 * This is an approximation - not true ray-traced AO
 */
function bakeAO(
  positions: Vec3[],
  normals: Vec3[],
  faces: { indices: number[] }[],
  opts: Required<BakeOptions>
): Float32Array {
  const ao = new Float32Array(positions.length);

  // Build a simple spatial index for occlusion testing
  const faceData = faces.map(face => {
    if (face.indices.length < 3) return null;
    const p0 = positions[face.indices[0]];
    const p1 = positions[face.indices[1]];
    const p2 = positions[face.indices[2]];
    const center = p0.add(p1).add(p2).mul(1/3);
    const edge1 = p1.sub(p0);
    const edge2 = p2.sub(p0);
    const normal = edge1.cross(edge2).normalize();
    const area = edge1.cross(edge2).length() * 0.5;
    return { center, normal, area, indices: face.indices };
  }).filter(f => f !== null);

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const normal = normals[i];

    // Sample hemisphere above vertex
    let occluded = 0;
    let total = 0;

    for (let s = 0; s < opts.aoSamples; s++) {
      // Generate sample direction in hemisphere around normal
      const sampleDir = randomHemisphereDirection(normal, s, opts.aoSamples);

      // Check if any geometry occludes this direction
      let isOccluded = false;

      for (const face of faceData) {
        if (!face) continue;
        // Skip faces that contain this vertex
        if (face.indices.includes(i)) continue;

        // Simple occlusion check: is face center roughly in this direction and close?
        const toFace = face.center.sub(pos);
        const dist = toFace.length();

        if (dist > opts.aoDistance || dist < 0.001) continue;

        const dirToFace = toFace.mul(1 / dist);
        const dotSample = sampleDir.dot(dirToFace);

        // Face is roughly in sample direction
        if (dotSample > 0.5) {
          // Check if face is facing towards us (backface = no occlusion)
          const dotFaceNormal = face.normal.dot(dirToFace.mul(-1));
          if (dotFaceNormal > 0) {
            isOccluded = true;
            break;
          }
        }
      }

      if (isOccluded) occluded++;
      total++;
    }

    // AO = 1 - occlusion ratio (1 = fully exposed)
    ao[i] = total > 0 ? 1 - (occluded / total) : 1;
  }

  return ao;
}

/**
 * Generate a sample direction in hemisphere around normal
 * Uses stratified sampling for better distribution
 */
function randomHemisphereDirection(normal: Vec3, index: number, total: number): Vec3 {
  // Stratified sampling: divide hemisphere into regions
  const phi = (index / total) * Math.PI * 2;
  const cosTheta = Math.sqrt((index + 0.5) / total);
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);

  // Create local coordinate system
  const up = Math.abs(normal.y) < 0.999 ? new Vec3(0, 1, 0) : new Vec3(1, 0, 0);
  const tangent = normal.cross(up).normalize();
  const bitangent = normal.cross(tangent);

  // Sample in hemisphere
  const x = Math.cos(phi) * sinTheta;
  const y = cosTheta;
  const z = Math.sin(phi) * sinTheta;

  return tangent.mul(x).add(normal.mul(y)).add(bitangent.mul(z)).normalize();
}

/**
 * Bake curvature from vertex normal differences
 * Convex = positive curvature, concave = negative
 */
function bakeCurvature(
  positions: Vec3[],
  normals: Vec3[],
  opts: Required<BakeOptions>
): Float32Array {
  const curvature = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const normal = normals[i];

    // Find nearby vertices
    let curvatureSum = 0;
    let neighborCount = 0;

    for (let j = 0; j < positions.length; j++) {
      if (i === j) continue;

      const otherPos = positions[j];
      const dist = pos.sub(otherPos).length();

      if (dist > opts.curvatureRadius) continue;

      const otherNormal = normals[j];

      // Direction to neighbor
      const toNeighbor = otherPos.sub(pos).normalize();

      // Curvature = how much normal changes along edge
      // Positive = normals diverge (convex)
      // Negative = normals converge (concave)
      const normalDiff = otherNormal.sub(normal);
      const curvatureValue = normalDiff.dot(toNeighbor);

      curvatureSum += curvatureValue;
      neighborCount++;
    }

    // Average curvature, normalized to 0-1 range (0.5 = flat)
    const avgCurvature = neighborCount > 0 ? curvatureSum / neighborCount : 0;
    curvature[i] = Math.max(0, Math.min(1, 0.5 + avgCurvature * 2));
  }

  return curvature;
}

/**
 * Bake height map from Y position
 */
function bakeHeight(positions: Vec3[], minY: number, maxY: number): Float32Array {
  const height = new Float32Array(positions.length);
  const range = maxY - minY;

  if (range < 0.0001) {
    // Flat mesh - all vertices at 0.5
    height.fill(0.5);
    return height;
  }

  for (let i = 0; i < positions.length; i++) {
    height[i] = (positions[i].y - minY) / range;
  }

  return height;
}

/**
 * Serialize baked maps to a format suitable for transmission
 */
export function serializeBakedMaps(maps: BakedMeshMaps): {
  ao: number[];
  curvature: number[];
  height: number[];
  vertexCount: number;
  bounds: { minY: number; maxY: number };
} {
  return {
    ao: Array.from(maps.ao),
    curvature: Array.from(maps.curvature),
    height: Array.from(maps.height),
    vertexCount: maps.vertexCount,
    bounds: maps.bounds
  };
}

/**
 * Get statistics about baked maps (for debugging/inspection)
 */
export function getMapsStats(maps: BakedMeshMaps): {
  ao: { min: number; max: number; avg: number };
  curvature: { min: number; max: number; avg: number };
  height: { min: number; max: number; avg: number };
} {
  const stats = (arr: Float32Array) => {
    if (arr.length === 0) return { min: 0, max: 0, avg: 0 };
    let min = Infinity, max = -Infinity, sum = 0;
    for (const v of arr) {
      min = Math.min(min, v);
      max = Math.max(max, v);
      sum += v;
    }
    return { min, max, avg: sum / arr.length };
  };

  return {
    ao: stats(maps.ao),
    curvature: stats(maps.curvature),
    height: stats(maps.height)
  };
}

