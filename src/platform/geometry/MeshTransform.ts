/**
 * Mesh Transform Operations
 *
 * Operations for transforming, mirroring, and manipulating meshes.
 */

import { Vec3 } from '../math/Vec3';
import { Mesh } from './Mesh';
import { Vertex } from './Vertex';
import { Face } from './Face';

/**
 * Mirror a mesh across an axis plane
 *
 * @param mesh The mesh to mirror
 * @param axis The axis to mirror across ('x', 'y', or 'z')
 * @param merge If true, merge vertices on the mirror plane
 * @param threshold Distance threshold for merging vertices
 */
export function mirror(
  mesh: Mesh,
  axis: 'x' | 'y' | 'z',
  merge: boolean = true,
  threshold: number = 0.001
): Mesh {
  const newMesh = new Mesh();
  const originalVertexCount = mesh.vertices.length;

  // Copy original vertices (preserving attributes)
  for (const v of mesh.vertices) {
    newMesh.addVertex(v.clone());
  }

  // Add mirrored vertices
  const mirroredIndices: Map<number, number> = new Map();

  for (let i = 0; i < originalVertexCount; i++) {
    const v = mesh.vertices[i];
    const pos = v.position;

    // Check if vertex is on the mirror plane
    const axisValue = axis === 'x' ? pos.x : axis === 'y' ? pos.y : pos.z;

    if (merge && Math.abs(axisValue) < threshold) {
      // On mirror plane - reuse same vertex
      mirroredIndices.set(i, i);
    } else {
      // Create mirrored vertex (preserving attributes)
      let mirroredPos: Vec3;
      if (axis === 'x') {
        mirroredPos = new Vec3(-pos.x, pos.y, pos.z);
      } else if (axis === 'y') {
        mirroredPos = new Vec3(pos.x, -pos.y, pos.z);
      } else {
        mirroredPos = new Vec3(pos.x, pos.y, -pos.z);
      }

      const newVertex = v.clone();
      newVertex.position = mirroredPos;
      const newIndex = newMesh.addVertex(newVertex);
      mirroredIndices.set(i, newIndex);
    }
  }

  // Copy original faces (preserving color and material slot)
  for (const face of mesh.faces) {
    newMesh.addFace(new Face([...face.indices], face.color, face.materialSlotIndex));
  }

  // Add mirrored faces (reversed winding, preserving color and material slot)
  for (const face of mesh.faces) {
    const mirroredFaceIndices = face.indices.map(i => mirroredIndices.get(i)!).reverse();
    newMesh.addFace(new Face(mirroredFaceIndices, face.color, face.materialSlotIndex));
  }

  return newMesh;
}

/**
 * Scale a mesh uniformly or non-uniformly
 */
export function scale(mesh: Mesh, scaleVec: Vec3 | number): Mesh {
  const s = typeof scaleVec === 'number'
    ? new Vec3(scaleVec, scaleVec, scaleVec)
    : scaleVec;

  const newMesh = new Mesh();

  for (const v of mesh.vertices) {
    const pos = v.position;
    // Preserve all vertex attributes (including UVs)
    const newVertex = v.clone();
    newVertex.position = new Vec3(pos.x * s.x, pos.y * s.y, pos.z * s.z);
    newMesh.addVertex(newVertex);
  }

  for (const face of mesh.faces) {
    newMesh.addFace(new Face([...face.indices], face.color, face.materialSlotIndex));
  }

  return newMesh;
}

/**
 * Translate a mesh
 */
export function translate(mesh: Mesh, offset: Vec3): Mesh {
  const newMesh = new Mesh();

  for (const v of mesh.vertices) {
    // Preserve all vertex attributes (including UVs)
    const newVertex = v.clone();
    newVertex.position = v.position.add(offset);
    newMesh.addVertex(newVertex);
  }

  for (const face of mesh.faces) {
    const newFace = new Face([...face.indices], face.color, face.materialSlotIndex);
    newMesh.addFace(newFace);
  }

  return newMesh;
}

/**
 * Rotate mesh around an axis
 */
export function rotate(mesh: Mesh, axis: Vec3, angle: number): Mesh {
  const newMesh = new Mesh();

  // Rodrigues' rotation formula
  const k = axis.normalize();
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (const v of mesh.vertices) {
    const p = v.position;
    // v_rot = v*cos(θ) + (k×v)*sin(θ) + k*(k·v)*(1-cos(θ))
    const rotated = p.mul(cos)
      .add(k.cross(p).mul(sin))
      .add(k.mul(k.dot(p) * (1 - cos)));

    // Preserve all vertex attributes (including UVs)
    const newVertex = v.clone();
    newVertex.position = rotated;
    newMesh.addVertex(newVertex);
  }

  for (const face of mesh.faces) {
    const newFace = new Face([...face.indices], face.color, face.materialSlotIndex);
    newMesh.addFace(newFace);
  }

  return newMesh;
}

/**
 * Merge two meshes into one
 */
export function merge(mesh1: Mesh, mesh2: Mesh): Mesh {
  const newMesh = new Mesh();

  // Add vertices from mesh1 (preserving attributes)
  for (const v of mesh1.vertices) {
    newMesh.addVertex(v.clone());
  }

  // Add vertices from mesh2 (preserving attributes)
  const offset = mesh1.vertices.length;
  for (const v of mesh2.vertices) {
    newMesh.addVertex(v.clone());
  }

  // Add faces from mesh1 (preserving color and material slot)
  for (const face of mesh1.faces) {
    newMesh.addFace(new Face([...face.indices], face.color, face.materialSlotIndex));
  }

  // Add faces from mesh2 (with index offset, preserving color and material slot)
  for (const face of mesh2.faces) {
    newMesh.addFace(new Face(face.indices.map(i => i + offset), face.color, face.materialSlotIndex));
  }

  return newMesh;
}

/**
 * Weld/merge vertices that are within threshold distance
 */
export function weldVertices(mesh: Mesh, threshold: number = 0.001): Mesh {
  const newMesh = new Mesh();
  const vertexMap: Map<number, number> = new Map();

  for (let i = 0; i < mesh.vertices.length; i++) {
    const pos = mesh.vertices[i].position;
    let merged = false;

    // Check if this vertex should merge with an existing one
    for (let j = 0; j < newMesh.vertices.length; j++) {
      const existingPos = newMesh.vertices[j].position;
      if (pos.sub(existingPos).length() < threshold) {
        vertexMap.set(i, j);
        merged = true;
        break;
      }
    }

    if (!merged) {
      const newIndex = newMesh.addVertex(new Vertex(pos.clone()));
      vertexMap.set(i, newIndex);
    }
  }

  // Remap faces
  for (const face of mesh.faces) {
    const newIndices = face.indices.map(i => vertexMap.get(i)!);

    // Skip degenerate faces (where vertices collapsed to same point)
    const uniqueIndices = [...new Set(newIndices)];
    if (uniqueIndices.length >= 3) {
      newMesh.addFace(new Face(newIndices));
    }
  }

  return newMesh;
}

/**
 * Smooth mesh using Laplacian smoothing
 * Moves each vertex toward the average of its neighbors
 */
export function smooth(mesh: Mesh, iterations: number = 1, factor: number = 0.5): Mesh {
  let current = mesh;

  for (let iter = 0; iter < iterations; iter++) {
    const newMesh = new Mesh();

    // Build adjacency: vertex → neighboring vertices
    const neighbors: Map<number, Set<number>> = new Map();
    for (let i = 0; i < current.vertices.length; i++) {
      neighbors.set(i, new Set());
    }

    for (const face of current.faces) {
      const n = face.indices.length;
      for (let i = 0; i < n; i++) {
        const v1 = face.indices[i];
        const v2 = face.indices[(i + 1) % n];
        neighbors.get(v1)!.add(v2);
        neighbors.get(v2)!.add(v1);
      }
    }

    // Move vertices toward neighbor average
    for (let i = 0; i < current.vertices.length; i++) {
      const pos = current.vertices[i].position;
      const neighborSet = neighbors.get(i)!;

      if (neighborSet.size > 0) {
        let avg = new Vec3(0, 0, 0);
        for (const ni of neighborSet) {
          avg = avg.add(current.vertices[ni].position);
        }
        avg = avg.mul(1 / neighborSet.size);

        // Blend between original and average
        const smoothed = pos.mul(1 - factor).add(avg.mul(factor));
        newMesh.addVertex(new Vertex(smoothed));
      } else {
        newMesh.addVertex(new Vertex(pos.clone()));
      }
    }

    // Copy faces
    for (const face of current.faces) {
      newMesh.addFace(new Face([...face.indices]));
    }

    current = newMesh;
  }

  return current;
}

/**
 * Flip all face normals (reverse winding order)
 */
export function flipNormals(mesh: Mesh): Mesh {
  const newMesh = new Mesh();

  for (const v of mesh.vertices) {
    newMesh.addVertex(new Vertex(v.position.clone()));
  }

  for (const face of mesh.faces) {
    newMesh.addFace(new Face([...face.indices].reverse()));
  }

  return newMesh;
}

/**
 * Calculate mesh center (centroid of all vertices)
 */
export function getCenter(mesh: Mesh): Vec3 {
  if (mesh.vertices.length === 0) {
    return new Vec3(0, 0, 0);
  }

  let sum = new Vec3(0, 0, 0);
  for (const v of mesh.vertices) {
    sum = sum.add(v.position);
  }

  return sum.mul(1 / mesh.vertices.length);
}

/**
 * Center mesh at origin
 */
export function centerAtOrigin(mesh: Mesh): Mesh {
  const center = getCenter(mesh);
  return translate(mesh, center.mul(-1));
}

