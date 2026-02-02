import { Vertex } from './Vertex';
import { Face } from './Face';
import { Vec3 } from '../math/Vec3';
import { AABB } from '../math/AABB';

/**
 * Represents an edge in a mesh with adjacent face information.
 * vertexA and vertexB are indices into the mesh's vertex array.
 * faceLeft and faceRight are indices into the mesh's face array (-1 if boundary).
 */
export interface MeshEdge {
  vertexA: number;
  vertexB: number;
  faceLeft: number;   // -1 for boundary edge
  faceRight: number;  // -1 for boundary edge
  tag?: string;       // Optional tag for explicit selection
}

/**
 * Key for edge deduplication (order-independent)
 */
function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

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

  /**
   * Build edge map: edge key → { faces: number[], vertexA, vertexB }
   * Internal helper for edge operations.
   */
  private buildEdgeMap(): Map<string, { vertexA: number; vertexB: number; faces: number[] }> {
    const edgeMap = new Map<string, { vertexA: number; vertexB: number; faces: number[] }>();

    for (let faceIdx = 0; faceIdx < this.faces.length; faceIdx++) {
      const face = this.faces[faceIdx];
      const indices = face.indices;

      for (let i = 0; i < indices.length; i++) {
        const a = indices[i];
        const b = indices[(i + 1) % indices.length];
        const key = edgeKey(a, b);

        if (!edgeMap.has(key)) {
          edgeMap.set(key, { vertexA: Math.min(a, b), vertexB: Math.max(a, b), faces: [] });
        }
        edgeMap.get(key)!.faces.push(faceIdx);
      }
    }

    return edgeMap;
  }

  /**
   * Get all edges in the mesh with adjacent face information.
   */
  getEdges(): MeshEdge[] {
    const edgeMap = this.buildEdgeMap();
    const edges: MeshEdge[] = [];

    for (const { vertexA, vertexB, faces } of edgeMap.values()) {
      edges.push({
        vertexA,
        vertexB,
        faceLeft: faces[0] ?? -1,
        faceRight: faces[1] ?? -1
      });
    }

    return edges;
  }

  /**
   * Calculate the angle between two adjacent faces at an edge (in radians).
   * Returns PI for boundary edges (one face only).
   */
  private getEdgeAngle(edge: MeshEdge): number {
    if (edge.faceLeft === -1 || edge.faceRight === -1) {
      // Boundary edge - treat as sharp (180 degrees = PI radians)
      return Math.PI;
    }

    const normalA = this.getFaceNormal(this.faces[edge.faceLeft]);
    const normalB = this.getFaceNormal(this.faces[edge.faceRight]);

    // Dot product gives cos(angle between normals)
    // Edge angle = PI - angle between normals (for dihedral angle)
    const dot = normalA.dot(normalB);
    // Clamp to avoid floating point errors with acos
    const clampedDot = Math.max(-1, Math.min(1, dot));
    const normalAngle = Math.acos(clampedDot);

    // Dihedral angle = PI - normalAngle
    // Sharp edges have small dihedral angle (normals point in similar directions on flat surface)
    // But for edge detection, we want the external angle
    return normalAngle;
  }

  /**
   * Get edges sharper than a given angle threshold.
   * @param angleThreshold Angle in radians (e.g., Math.PI / 6 for 30 degrees)
   * @returns Edges where the angle between adjacent faces exceeds the threshold
   */
  getSharpEdges(angleThreshold: number): MeshEdge[] {
    const allEdges = this.getEdges();
    return allEdges.filter(edge => {
      const angle = this.getEdgeAngle(edge);
      return angle > angleThreshold;
    });
  }

  /**
   * Get boundary edges (edges with only one adjacent face).
   */
  getBoundaryEdges(): MeshEdge[] {
    return this.getEdges().filter(e => e.faceLeft === -1 || e.faceRight === -1);
  }

  /**
   * Tag specific edges for later selection.
   * @param edgeSelector Function that returns true for edges to tag
   * @param tag Tag name to apply
   * @returns Tagged edges
   */
  tagEdges(edgeSelector: (edge: MeshEdge, mesh: Mesh) => boolean, tag: string): MeshEdge[] {
    const edges = this.getEdges();
    const taggedEdges: MeshEdge[] = [];

    for (const edge of edges) {
      if (edgeSelector(edge, this)) {
        edge.tag = tag;
        taggedEdges.push(edge);
      }
    }

    // Store tagged edges for later retrieval
    if (!this._taggedEdges) {
      this._taggedEdges = new Map<string, MeshEdge[]>();
    }
    const existing = this._taggedEdges.get(tag) || [];
    this._taggedEdges.set(tag, [...existing, ...taggedEdges]);

    return taggedEdges;
  }

  /**
   * Internal storage for tagged edges
   */
  private _taggedEdges?: Map<string, MeshEdge[]>;

  /**
   * Get edges by their tag name.
   * @param tag Tag name to search for
   * @returns Edges with the specified tag
   */
  getEdgesByTag(tag: string): MeshEdge[] {
    if (!this._taggedEdges) {
      return [];
    }
    return this._taggedEdges.get(tag) || [];
  }

  /**
   * Get the world-space position of an edge's midpoint.
   */
  getEdgeMidpoint(edge: MeshEdge): Vec3 {
    const a = this.vertices[edge.vertexA].position;
    const b = this.vertices[edge.vertexB].position;
    return a.add(b).mul(0.5);
  }

  /**
   * Get the direction vector of an edge (normalized).
   */
  getEdgeDirection(edge: MeshEdge): Vec3 {
    const a = this.vertices[edge.vertexA].position;
    const b = this.vertices[edge.vertexB].position;
    return b.sub(a).normalize();
  }

  /**
   * Get the length of an edge.
   */
  getEdgeLength(edge: MeshEdge): number {
    const a = this.vertices[edge.vertexA].position;
    const b = this.vertices[edge.vertexB].position;
    return a.sub(b).length();
  }
}
