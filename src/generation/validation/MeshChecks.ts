import { Mesh } from '../../platform/geometry/Mesh';

export interface MeshCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface TopologyCheckResult {
  ok: boolean;
  nonManifoldEdges: Array<{ v1: number; v2: number; faceCount: number }>;
  inconsistentWindingPairs: Array<{ face1: number; face2: number; edge: [number, number] }>;
  isolatedVertices: number[];
  boundaryEdges: Array<{ v1: number; v2: number }>;
}

/**
 * Check mesh topology for common issues
 */
export function checkMeshTopology(mesh: Mesh): TopologyCheckResult {
  const nonManifoldEdges: TopologyCheckResult['nonManifoldEdges'] = [];
  const inconsistentWindingPairs: TopologyCheckResult['inconsistentWindingPairs'] = [];
  const boundaryEdges: TopologyCheckResult['boundaryEdges'] = [];

  // Track which vertices are used
  const usedVertices = new Set<number>();

  // Build edge-to-face map with winding direction
  // Key: "min_max" for undirected edge lookup
  // Value: array of { faceIndex, v1, v2 } where v1->v2 is the edge direction in that face
  const edgeMap = new Map<string, Array<{ faceIndex: number; v1: number; v2: number }>>();

  for (let f = 0; f < mesh.faces.length; f++) {
    const face = mesh.faces[f];
    const indices = face.indices;

    for (let i = 0; i < indices.length; i++) {
      const v1 = indices[i];
      const v2 = indices[(i + 1) % indices.length];

      usedVertices.add(v1);

      // Create undirected edge key (always min first)
      const edgeKey = v1 < v2 ? `${v1}_${v2}` : `${v2}_${v1}`;

      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, []);
      }
      edgeMap.get(edgeKey)!.push({ faceIndex: f, v1, v2 });
    }
  }

  // Analyze edges
  for (const [edgeKey, edgeRefs] of edgeMap.entries()) {
    const [v1Str, v2Str] = edgeKey.split('_');
    const v1 = parseInt(v1Str);
    const v2 = parseInt(v2Str);

    if (edgeRefs.length > 2) {
      // Non-manifold: more than 2 faces share this edge
      nonManifoldEdges.push({ v1, v2, faceCount: edgeRefs.length });
    } else if (edgeRefs.length === 2) {
      // Two faces share this edge - check winding consistency
      // For consistent winding, the two faces should traverse the edge in OPPOSITE directions
      // (one goes v1->v2, other goes v2->v1)
      const dir1 = edgeRefs[0].v1 < edgeRefs[0].v2;  // true if v1->v2
      const dir2 = edgeRefs[1].v1 < edgeRefs[1].v2;

      // If both traverse in same direction relative to the sorted key, winding is inconsistent
      if (dir1 === dir2) {
        inconsistentWindingPairs.push({
          face1: edgeRefs[0].faceIndex,
          face2: edgeRefs[1].faceIndex,
          edge: [v1, v2]
        });
      }
    } else if (edgeRefs.length === 1) {
      // Boundary edge (only one face uses it)
      boundaryEdges.push({ v1, v2 });
    }
  }

  // Find isolated vertices
  const isolatedVertices: number[] = [];
  for (let i = 0; i < mesh.vertices.length; i++) {
    if (!usedVertices.has(i)) {
      isolatedVertices.push(i);
    }
  }

  const ok = nonManifoldEdges.length === 0 &&
             inconsistentWindingPairs.length === 0 &&
             isolatedVertices.length === 0;

  return {
    ok,
    nonManifoldEdges,
    inconsistentWindingPairs,
    isolatedVertices,
    boundaryEdges
  };
}

/**
 * Format topology check result as human-readable strings
 */
export function formatTopologyIssues(result: TopologyCheckResult): string[] {
  const issues: string[] = [];

  for (const edge of result.nonManifoldEdges) {
    issues.push(`Non-manifold edge (${edge.v1}, ${edge.v2}): shared by ${edge.faceCount} faces`);
  }

  for (const pair of result.inconsistentWindingPairs) {
    issues.push(`Inconsistent winding: faces ${pair.face1} and ${pair.face2} share edge (${pair.edge[0]}, ${pair.edge[1]}) with same direction`);
  }

  if (result.isolatedVertices.length > 0) {
    if (result.isolatedVertices.length <= 5) {
      issues.push(`Isolated vertices: ${result.isolatedVertices.join(', ')}`);
    } else {
      issues.push(`Isolated vertices: ${result.isolatedVertices.slice(0, 5).join(', ')}... (${result.isolatedVertices.length} total)`);
    }
  }

  return issues;
}

export function checkMeshValidity(mesh: Mesh): MeshCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!mesh) {
    return { ok: false, errors: ['Mesh is null/undefined'], warnings };
  }

  // Vertex sanity
  for (let i = 0; i < mesh.vertices.length; i++) {
    const p = mesh.vertices[i].position;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      errors.push(`Vertex[${i}] has non-finite position: (${p.x}, ${p.y}, ${p.z})`);
      break;
    }
  }

  // Face sanity
  for (let f = 0; f < mesh.faces.length; f++) {
    const face = mesh.faces[f];
    if (!face.indices || face.indices.length < 3) {
      errors.push(`Face[${f}] has <3 indices`);
      continue;
    }
    for (const idx of face.indices) {
      if (!Number.isInteger(idx)) {
        errors.push(`Face[${f}] contains non-integer index: ${idx}`);
        break;
      }
      if (idx < 0 || idx >= mesh.vertices.length) {
        errors.push(`Face[${f}] index out of range: ${idx} (verts=${mesh.vertices.length})`);
        break;
      }
    }
  }

  // Degenerate triangle heuristic after triangulation
  try {
    const tri = mesh.triangulate();
    for (let f = 0; f < tri.faces.length; f++) {
      const face = tri.faces[f];
      if (face.indices.length !== 3) continue;
      const a = tri.vertices[face.indices[0]].position;
      const b = tri.vertices[face.indices[1]].position;
      const c = tri.vertices[face.indices[2]].position;

      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
      const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;

      // cross magnitude squared (proportional to area^2)
      const cxp = aby * acz - abz * acy;
      const cyp = abz * acx - abx * acz;
      const czp = abx * acy - aby * acx;
      const area2 = cxp * cxp + cyp * cyp + czp * czp;

      if (area2 < 1e-12) {
        warnings.push(`Degenerate triangle at triFace[${f}] (area^2=${area2})`);
        if (warnings.length >= 10) {
          warnings.push('More degenerate triangles exist (truncated)');
          break;
        }
      }
    }
  } catch (e) {
    warnings.push(`Triangulation failed: ${String(e)}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Comprehensive mesh check including topology validation
 */
export function checkMeshComprehensive(mesh: Mesh): MeshCheckResult {
  // Start with basic validity checks
  const basicResult = checkMeshValidity(mesh);

  // Add topology checks
  const topoResult = checkMeshTopology(mesh);
  const topoIssues = formatTopologyIssues(topoResult);

  // Topology issues are warnings (mesh can still render, just may look wrong)
  const warnings = [...basicResult.warnings, ...topoIssues];

  // Boundary edges are informational, not errors (open meshes are sometimes intentional)
  if (topoResult.boundaryEdges.length > 0) {
    warnings.push(`Mesh has ${topoResult.boundaryEdges.length} boundary edges (not watertight)`);
  }

  return {
    ok: basicResult.ok && topoResult.ok,
    errors: basicResult.errors,
    warnings
  };
}

/**
 * UV validation result with detailed diagnostics
 */
export interface UVCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    verticesWithUV: number;
    verticesWithoutUV: number;
    facesWithCompleteUV: number;
    facesWithMixedUV: number;
    facesWithNoUV: number;
    uvRangeU: { min: number; max: number };
    uvRangeV: { min: number; max: number };
    distortedFaces: number;
    degenerateFaces: number;
  };
}

/**
 * Check UV coordinates for common issues that cause visual artifacts.
 * Detects:
 * - Missing UVs
 * - Invalid (NaN/Infinity) UV values
 * - Extreme UV distortion (skewing/stretching)
 * - Degenerate UV triangles (collapsed to line/point)
 * - UV coordinates outside 0-1 range (warning only, may be intentional for tiling)
 */
export function checkMeshUVs(mesh: Mesh): UVCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let verticesWithUV = 0;
  let verticesWithoutUV = 0;
  let uvMinU = Infinity, uvMaxU = -Infinity;
  let uvMinV = Infinity, uvMaxV = -Infinity;
  let facesWithCompleteUV = 0;
  let facesWithMixedUV = 0;
  let facesWithNoUV = 0;
  let distortedFaces = 0;
  let degenerateFaces = 0;

  // Check vertices for UV presence and validity
  for (let i = 0; i < mesh.vertices.length; i++) {
    const uv = mesh.vertices[i].attributes.uv;
    if (uv && Array.isArray(uv) && uv.length >= 2) {
      const [u, v] = uv;
      if (!Number.isFinite(u) || !Number.isFinite(v)) {
        errors.push(`Vertex[${i}] has invalid UV: (${u}, ${v})`);
        continue;
      }
      verticesWithUV++;
      uvMinU = Math.min(uvMinU, u);
      uvMaxU = Math.max(uvMaxU, u);
      uvMinV = Math.min(uvMinV, v);
      uvMaxV = Math.max(uvMaxV, v);
    } else {
      verticesWithoutUV++;
    }
  }

  // Check faces for UV completeness and distortion
  for (let f = 0; f < mesh.faces.length; f++) {
    const face = mesh.faces[f];
    const indices = face.indices;

    let hasUV = 0;
    let noUV = 0;
    const uvs: [number, number][] = [];

    for (const idx of indices) {
      const vertex = mesh.vertices[idx];
      const uv = vertex?.attributes?.uv;
      if (uv && Array.isArray(uv) && uv.length >= 2 &&
          Number.isFinite(uv[0]) && Number.isFinite(uv[1])) {
        hasUV++;
        uvs.push([uv[0], uv[1]]);
      } else {
        noUV++;
        uvs.push([0, 0]); // Placeholder
      }
    }

    if (noUV === indices.length) {
      facesWithNoUV++;
    } else if (hasUV === indices.length) {
      facesWithCompleteUV++;

      // Check for UV distortion on quads and triangles
      if (uvs.length >= 3) {
        // Check for degenerate UV (all points nearly collinear)
        const uvArea = computeUVPolygonArea(uvs);
        if (Math.abs(uvArea) < 1e-10) {
          degenerateFaces++;
        } else if (uvs.length === 4) {
          // For quads, check aspect ratio distortion
          // Compare UV edge ratios to detect severe skewing
          const uvEdge1 = Math.hypot(uvs[1][0] - uvs[0][0], uvs[1][1] - uvs[0][1]);
          const uvEdge2 = Math.hypot(uvs[2][0] - uvs[1][0], uvs[2][1] - uvs[1][1]);
          const uvEdge3 = Math.hypot(uvs[3][0] - uvs[2][0], uvs[3][1] - uvs[2][1]);
          const uvEdge4 = Math.hypot(uvs[0][0] - uvs[3][0], uvs[0][1] - uvs[3][1]);

          // Get 3D edge lengths for comparison
          const v0 = mesh.vertices[indices[0]].position;
          const v1 = mesh.vertices[indices[1]].position;
          const v2 = mesh.vertices[indices[2]].position;
          const v3 = mesh.vertices[indices[3]].position;

          const edge3d1 = Math.hypot(v1.x - v0.x, v1.y - v0.y, v1.z - v0.z);
          const edge3d2 = Math.hypot(v2.x - v1.x, v2.y - v1.y, v2.z - v1.z);
          const edge3d3 = Math.hypot(v3.x - v2.x, v3.y - v2.y, v3.z - v2.z);
          const edge3d4 = Math.hypot(v0.x - v3.x, v0.y - v3.y, v0.z - v3.z);

          // Calculate scale ratios (UV edge / 3D edge)
          const ratios = [
            uvEdge1 / Math.max(edge3d1, 1e-6),
            uvEdge2 / Math.max(edge3d2, 1e-6),
            uvEdge3 / Math.max(edge3d3, 1e-6),
            uvEdge4 / Math.max(edge3d4, 1e-6)
          ];

          const minRatio = Math.min(...ratios);
          const maxRatio = Math.max(...ratios);

          // Severe distortion if one edge is 10x+ more stretched than another
          if (maxRatio > minRatio * 10 && minRatio > 0) {
            distortedFaces++;
          }
        }
      }
    } else {
      facesWithMixedUV++;
      warnings.push(`Face[${f}] has mixed UV coverage (${hasUV}/${indices.length} vertices)`);
      if (warnings.length > 10) {
        warnings.push('(more mixed UV faces exist, truncated)');
        break;
      }
    }
  }

  // Generate summary warnings
  if (verticesWithoutUV > 0 && verticesWithUV > 0) {
    warnings.push(`Mixed UV coverage: ${verticesWithUV} vertices with UV, ${verticesWithoutUV} without`);
  }

  if (degenerateFaces > 0) {
    warnings.push(`${degenerateFaces} faces have degenerate UVs (collapsed to line/point)`);
  }

  if (distortedFaces > 0) {
    warnings.push(`${distortedFaces} faces have severely distorted UVs (10x+ stretch ratio)`);
  }

  // UV range outside 0-1 is a warning (could be intentional tiling)
  if (verticesWithUV > 0) {
    if (uvMinU < -0.01 || uvMaxU > 1.01 || uvMinV < -0.01 || uvMaxV > 1.01) {
      // Only warn if really far out
      if (uvMinU < -1 || uvMaxU > 2 || uvMinV < -1 || uvMaxV > 2) {
        warnings.push(`UV range extends significantly outside 0-1: U=[${uvMinU.toFixed(2)}, ${uvMaxU.toFixed(2)}], V=[${uvMinV.toFixed(2)}, ${uvMaxV.toFixed(2)}]`);
      }
    }
  }

  const ok = errors.length === 0 && degenerateFaces === 0;

  return {
    ok,
    errors,
    warnings,
    stats: {
      verticesWithUV,
      verticesWithoutUV,
      facesWithCompleteUV,
      facesWithMixedUV,
      facesWithNoUV,
      uvRangeU: { min: uvMinU === Infinity ? 0 : uvMinU, max: uvMaxU === -Infinity ? 0 : uvMaxU },
      uvRangeV: { min: uvMinV === Infinity ? 0 : uvMinV, max: uvMaxV === -Infinity ? 0 : uvMaxV },
      distortedFaces,
      degenerateFaces
    }
  };
}

/**
 * Compute signed area of UV polygon using shoelace formula
 */
function computeUVPolygonArea(uvs: [number, number][]): number {
  let area = 0;
  const n = uvs.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += uvs[i][0] * uvs[j][1];
    area -= uvs[j][0] * uvs[i][1];
  }
  return area / 2;
}

/**
 * Format UV check result for display
 */
export function formatUVIssues(result: UVCheckResult): string[] {
  const lines: string[] = [];

  lines.push(`UV Coverage: ${result.stats.verticesWithUV}/${result.stats.verticesWithUV + result.stats.verticesWithoutUV} vertices have UVs`);
  lines.push(`Faces: ${result.stats.facesWithCompleteUV} complete, ${result.stats.facesWithMixedUV} mixed, ${result.stats.facesWithNoUV} none`);

  if (result.stats.verticesWithUV > 0) {
    lines.push(`UV Range: U=[${result.stats.uvRangeU.min.toFixed(3)}, ${result.stats.uvRangeU.max.toFixed(3)}], V=[${result.stats.uvRangeV.min.toFixed(3)}, ${result.stats.uvRangeV.max.toFixed(3)}]`);
  }

  if (result.stats.degenerateFaces > 0) {
    lines.push(`⚠ ${result.stats.degenerateFaces} degenerate UV faces (will cause texture artifacts)`);
  }

  if (result.stats.distortedFaces > 0) {
    lines.push(`⚠ ${result.stats.distortedFaces} severely distorted UV faces`);
  }

  for (const err of result.errors) {
    lines.push(`✗ ${err}`);
  }

  for (const warn of result.warnings) {
    lines.push(`⚠ ${warn}`);
  }

  return lines;
}

