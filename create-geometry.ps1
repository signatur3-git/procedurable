# Create all remaining source files for the procedural generation system

Write-Host "Creating EdgeLoop.ts..."
@'
import { Vec3 } from '../core/Vec3';
import { Vertex } from './Vertex';

export class EdgeLoop {
  public vertices: Vertex[];

  constructor(vertices: Vertex[] = []) {
    this.vertices = vertices;
  }

  get length(): number {
    return this.vertices.length;
  }

  addVertex(vertex: Vertex): void {
    this.vertices.push(vertex);
  }

  getVertex(index: number): Vertex {
    const i = ((index % this.vertices.length) + this.vertices.length) % this.vertices.length;
    return this.vertices[i];
  }

  clone(): EdgeLoop {
    return new EdgeLoop(this.vertices.map(v => v.clone()));
  }

  transform(fn: (vertex: Vertex, index: number) => Vertex): EdgeLoop {
    return new EdgeLoop(this.vertices.map(fn));
  }

  scale(factor: number): EdgeLoop {
    const center = this.getCenter();
    return this.transform(v => {
      const dir = v.position.sub(center);
      return new Vertex(center.add(dir.mul(factor)), v.attributes);
    });
  }

  translate(offset: Vec3): EdgeLoop {
    return this.transform(v => new Vertex(v.position.add(offset), v.attributes));
  }

  getCenter(): Vec3 {
    if (this.vertices.length === 0) return Vec3.zero();
    const sum = this.vertices.reduce((acc, v) => acc.add(v.position), Vec3.zero());
    return sum.div(this.vertices.length);
  }

  getNormal(): Vec3 {
    if (this.vertices.length < 3) return new Vec3(0, 1, 0);
    let normal = Vec3.zero();
    for (let i = 0; i < this.vertices.length; i++) {
      const v1 = this.getVertex(i).position;
      const v2 = this.getVertex(i + 1).position;
      normal.x += (v1.y - v2.y) * (v1.z + v2.z);
      normal.y += (v1.z - v2.z) * (v1.x + v2.x);
      normal.z += (v1.x - v2.x) * (v1.y + v2.y);
    }
    return normal.normalize();
  }

  static createCircle(center: Vec3, radius: number, segments: number, normal: Vec3 = new Vec3(0, 1, 0)): EdgeLoop {
    const vertices: Vertex[] = [];
    const up = Math.abs(normal.y) < 0.999 ? new Vec3(0, 1, 0) : new Vec3(1, 0, 0);
    const tangent1 = normal.cross(up).normalize();
    const tangent2 = normal.cross(tangent1).normalize();

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const pos = center.add(tangent1.mul(x)).add(tangent2.mul(z));
      vertices.push(new Vertex(pos, { normal: normal.clone() }));
    }
    return new EdgeLoop(vertices);
  }

  static createRectangle(center: Vec3, width: number, height: number, normal: Vec3 = new Vec3(0, 1, 0)): EdgeLoop {
    const up = Math.abs(normal.y) < 0.999 ? new Vec3(0, 1, 0) : new Vec3(1, 0, 0);
    const tangent1 = normal.cross(up).normalize();
    const tangent2 = normal.cross(tangent1).normalize();
    const hw = width / 2;
    const hh = height / 2;

    const vertices = [
      new Vertex(center.add(tangent1.mul(-hw)).add(tangent2.mul(-hh)), { normal: normal.clone() }),
      new Vertex(center.add(tangent1.mul(hw)).add(tangent2.mul(-hh)), { normal: normal.clone() }),
      new Vertex(center.add(tangent1.mul(hw)).add(tangent2.mul(hh)), { normal: normal.clone() }),
      new Vertex(center.add(tangent1.mul(-hw)).add(tangent2.mul(hh)), { normal: normal.clone() })
    ];
    return new EdgeLoop(vertices);
  }

  static lerp(loop1: EdgeLoop, loop2: EdgeLoop, t: number): EdgeLoop {
    if (loop1.length !== loop2.length) {
      throw new Error('Cannot interpolate edge loops with different vertex counts');
    }
    const vertices = loop1.vertices.map((v1, i) => {
      const v2 = loop2.vertices[i];
      return Vertex.lerp(v1, v2, t);
    });
    return new EdgeLoop(vertices);
  }
}
'@ | Out-File -FilePath src\geometry\EdgeLoop.ts -Encoding utf8

Write-Host "Creating Mesh.ts..."
@'
import { Vertex } from './Vertex';
import { Face } from './Face';
import { Vec3 } from '../core/Vec3';

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

  getBounds(): { min: Vec3; max: Vec3 } {
    if (this.vertices.length === 0) {
      return { min: Vec3.zero(), max: Vec3.zero() };
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
    return { min, max };
  }

  getCenter(): Vec3 {
    const bounds = this.getBounds();
    return bounds.min.add(bounds.max).div(2);
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
'@ | Out-File -FilePath src\geometry\Mesh.ts -Encoding utf8

Write-Host "All geometry files created successfully!"

