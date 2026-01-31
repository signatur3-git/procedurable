import { Vec3 } from '../math/Vec3';
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
