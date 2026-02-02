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
