import { Vertex } from './Vertex';
import { Face } from './Face';
import { Vec3 } from '../core/Vec3';
import { AABB } from '../core/AABB';

export class Mesh {
  public vertices: Vertex[];
  public faces: Face[];

  constructor(vertices: Vertex[] = [], faces: Face[] = []) {
    this.vertices = vertices;
    this.faces = faces;
  }

  addVertex(vertex: Vertex): number {
    this.vertices.push(vertex);
    return this.vertices.length - 1;
  }

  addFace(face: Face): void {
    this.faces.push(face);
  }

  clone(): Mesh {
    return new Mesh(
      this.vertices.map(v => v.clone()),
      this.faces.map(f => f.clone())
    );
  }

  merge(other: Mesh): Mesh {
    const offset = this.vertices.length;
    this.vertices.push(...other.vertices.map(v => v.clone()));
    this.faces.push(...other.faces.map(f => new Face(f.indices.map(i => i + offset))));
    return this;
  }

  triangulate(): Mesh {
    const triangulatedFaces: Face[] = [];
    for (const face of this.faces) {
      triangulatedFaces.push(...face.triangulate());
    }
    return new Mesh(this.vertices, triangulatedFaces);
  }

  /**
   * Get the axis-aligned bounding box of this mesh
   */
  getAABB(): AABB {
    return AABB.fromPoints(this.vertices.map(v => v.position));
  }

  calculateNormals(): void {
    const normals = this.vertices.map(() => Vec3.zero());
    for (const face of this.faces) {
      const faceNormal = this.getFaceNormal(face);
      for (const idx of face.indices) {
        normals[idx] = normals[idx].add(faceNormal);
      }
    }
    for (let i = 0; i < this.vertices.length; i++) {
      this.vertices[i].attributes.normal = normals[i].normalize();
    }
  }

  private getFaceNormal(face: Face): Vec3 {
    if (face.indices.length < 3) return new Vec3(0, 1, 0);
    const v0 = this.vertices[face.indices[0]].position;
    const v1 = this.vertices[face.indices[1]].position;
    const v2 = this.vertices[face.indices[2]].position;
    const edge1 = v1.sub(v0);
    const edge2 = v2.sub(v0);
    return edge1.cross(edge2).normalize();
  }

  getBounds(): { min: Vec3; max: Vec3; center: Vec3; size: Vec3 } {
    if (this.vertices.length === 0) {
      const zero = Vec3.zero();
      return { min: zero, max: zero, center: zero, size: zero };
    }
    const min = this.vertices[0].position.clone();
    const max = this.vertices[0].position.clone();
    for (const vertex of this.vertices) {
      const pos = vertex.position;
      min.x = Math.min(min.x, pos.x);
      min.y = Math.min(min.y, pos.y);
      min.z = Math.min(min.z, pos.z);
      max.x = Math.max(max.x, pos.x);
      max.y = Math.max(max.y, pos.y);
      max.z = Math.max(max.z, pos.z);
    }
    const center = new Vec3(
      (min.x + max.x) / 2,
      (min.y + max.y) / 2,
      (min.z + max.z) / 2
    );
    const size = new Vec3(
      max.x - min.x,
      max.y - min.y,
      max.z - min.z
    );
    return { min, max, center, size };
  }

  getCenter(): Vec3 {
    const bounds = this.getBounds();
    return bounds.center;
  }

  toIndexedGeometry(): {
    positions: Float32Array;
    normals?: Float32Array;
    uvs?: Float32Array;
    indices: Uint32Array;
  } {
    const triangulated = this.triangulate();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let hasNormals = false;
    let hasUVs = false;

    for (const vertex of triangulated.vertices) {
      positions.push(...vertex.position.toArray());
      if (vertex.attributes.normal) {
        normals.push(...vertex.attributes.normal.toArray());
        hasNormals = true;
      } else {
        normals.push(0, 1, 0);
      }
      if (vertex.attributes.uv) {
        uvs.push(...vertex.attributes.uv);
        hasUVs = true;
      } else {
        uvs.push(0, 0);
      }
    }

    for (const face of triangulated.faces) {
      indices.push(...face.indices);
    }

    return {
      positions: new Float32Array(positions),
      normals: hasNormals ? new Float32Array(normals) : undefined,
      uvs: hasUVs ? new Float32Array(uvs) : undefined,
      indices: new Uint32Array(indices)
    };
  }
}
