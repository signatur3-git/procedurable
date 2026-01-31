import { Mesh } from '../../platform/geometry/Mesh';

export interface MeshCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
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

