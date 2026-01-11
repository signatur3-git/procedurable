# Script to create all source files

# Create Vertex.ts
@'
import { Vec3 } from '../core/Vec3';

export interface VertexAttributes {
  normal?: Vec3;
  uv?: [number, number];
  color?: [number, number, number];
}

export class Vertex {
  public position: Vec3;
  public attributes: VertexAttributes;

  constructor(position: Vec3, attributes: VertexAttributes = {}) {
    this.position = position;
    this.attributes = attributes;
  }

  clone(): Vertex {
    return new Vertex(
      this.position.clone(),
      {
        normal: this.attributes.normal?.clone(),
        uv: this.attributes.uv ? [...this.attributes.uv] as [number, number] : undefined,
        color: this.attributes.color ? [...this.attributes.color] as [number, number, number] : undefined
      }
    );
  }

  static lerp(v1: Vertex, v2: Vertex, t: number): Vertex {
    const position = v1.position.lerp(v2.position, t);
    const attributes: VertexAttributes = {};

    if (v1.attributes.normal && v2.attributes.normal) {
      attributes.normal = v1.attributes.normal.lerp(v2.attributes.normal, t).normalize();
    }

    if (v1.attributes.uv && v2.attributes.uv) {
      attributes.uv = [
        v1.attributes.uv[0] + (v2.attributes.uv[0] - v1.attributes.uv[0]) * t,
        v1.attributes.uv[1] + (v2.attributes.uv[1] - v1.attributes.uv[1]) * t
      ];
    }

    if (v1.attributes.color && v2.attributes.color) {
      attributes.color = [
        v1.attributes.color[0] + (v2.attributes.color[0] - v1.attributes.color[0]) * t,
        v1.attributes.color[1] + (v2.attributes.color[1] - v1.attributes.color[1]) * t,
        v1.attributes.color[2] + (v2.attributes.color[2] - v1.attributes.color[2]) * t
      ];
    }

    return new Vertex(position, attributes);
  }
}
'@ | Out-File -FilePath src\geometry\Vertex.ts -Encoding utf8

Write-Host "Created Vertex.ts"

# Create Face.ts
@'
export class Face {
  public indices: number[];

  constructor(indices: number[]) {
    if (indices.length < 3) {
      throw new Error('Face must have at least 3 vertices');
    }
    this.indices = indices;
  }

  isTriangle(): boolean {
    return this.indices.length === 3;
  }

  isQuad(): boolean {
    return this.indices.length === 4;
  }

  triangulate(): Face[] {
    if (this.isTriangle()) {
      return [this];
    }

    const triangles: Face[] = [];
    for (let i = 1; i < this.indices.length - 1; i++) {
      triangles.push(new Face([
        this.indices[0],
        this.indices[i],
        this.indices[i + 1]
      ]));
    }
    return triangles;
  }

  clone(): Face {
    return new Face([...this.indices]);
  }
}
'@ | Out-File -FilePath src\geometry\Face.ts -Encoding utf8

Write-Host "Created Face.ts"

Write-Host "All geometry files created successfully!"

