import { Mesh } from './Mesh';
import { EdgeLoop } from './EdgeLoop';
import { Face } from './Face';
import { Vertex } from './Vertex';
import { Vec3 } from '../core/Vec3';
export class MeshOperations {
  static extrude(loop: EdgeLoop, direction: Vec3, segments: number = 1): Mesh {
    const mesh = new Mesh();
    const loops: EdgeLoop[] = [loop];
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const offset = direction.mul(t);
      loops.push(loop.translate(offset));
    }
    const vertexOffsets: number[] = [];
    for (const currentLoop of loops) {
      const offset = mesh.vertices.length;
      vertexOffsets.push(offset);
      for (const vertex of currentLoop.vertices) {
        mesh.addVertex(vertex);
      }
    }
    for (let i = 0; i < loops.length - 1; i++) {
      const currentOffset = vertexOffsets[i];
      const nextOffset = vertexOffsets[i + 1];
      const vertexCount = loops[i].length;
      for (let j = 0; j < vertexCount; j++) {
        const nextJ = (j + 1) % vertexCount;
        // Winding order: counter-clockwise when viewed from outside
        const face = new Face([
          currentOffset + j,
          currentOffset + nextJ,
          nextOffset + nextJ,
          nextOffset + j
        ]);
        mesh.addFace(face);
      }
    }
    return mesh;
  }
  static loft(loops: EdgeLoop[]): Mesh {
    if (loops.length < 2) throw new Error('Loft requires at least 2 edge loops');
    const vertexCount = loops[0].length;
    for (const loop of loops) {
      if (loop.length !== vertexCount) {
        throw new Error('All edge loops must have the same vertex count for lofting');
      }
    }
    const mesh = new Mesh();
    const vertexOffsets: number[] = [];
    for (const loop of loops) {
      const offset = mesh.vertices.length;
      vertexOffsets.push(offset);
      for (const vertex of loop.vertices) {
        mesh.addVertex(vertex);
      }
    }
    for (let i = 0; i < loops.length - 1; i++) {
      const currentOffset = vertexOffsets[i];
      const nextOffset = vertexOffsets[i + 1];
      for (let j = 0; j < vertexCount; j++) {
        const nextJ = (j + 1) % vertexCount;
        // Winding order: counter-clockwise when viewed from outside
        // For a cylinder viewed from outside, we need:
        // bottom-left → bottom-right → top-right → top-left
        const face = new Face([
          currentOffset + j,
          currentOffset + nextJ,
          nextOffset + nextJ,
          nextOffset + j
        ]);
        mesh.addFace(face);
      }
    }
    return mesh;
  }
  static cap(loop: EdgeLoop, mesh: Mesh, reverse: boolean = false): void {
    // Add NEW vertices for the cap (don't reuse loft vertices - we need separate normals)
    const offset = mesh.vertices.length;
    for (const vertex of loop.vertices) {
      // Clone the vertex so cap has its own normals
      mesh.addVertex(vertex.clone());
    }
    const indices = [];
    for (let i = 0; i < loop.length; i++) {
      indices.push(offset + i);
    }
    if (reverse) indices.reverse();
    mesh.addFace(new Face(indices));
  }
  static createBox(width: number, height: number, depth: number): Mesh {
    const mesh = new Mesh();
    const hw = width / 2, hh = height / 2, hd = depth / 2;
    // Vertices:
    // 0: -x, -y, -z (back-bottom-left)
    // 1: +x, -y, -z (back-bottom-right)
    // 2: +x, +y, -z (back-top-right)
    // 3: -x, +y, -z (back-top-left)
    // 4: -x, -y, +z (front-bottom-left)
    // 5: +x, -y, +z (front-bottom-right)
    // 6: +x, +y, +z (front-top-right)
    // 7: -x, +y, +z (front-top-left)
    const vertices = [
      new Vertex(new Vec3(-hw, -hh, -hd)), new Vertex(new Vec3(hw, -hh, -hd)),
      new Vertex(new Vec3(hw, hh, -hd)), new Vertex(new Vec3(-hw, hh, -hd)),
      new Vertex(new Vec3(-hw, -hh, hd)), new Vertex(new Vec3(hw, -hh, hd)),
      new Vertex(new Vec3(hw, hh, hd)), new Vertex(new Vec3(-hw, hh, hd))
    ];
    vertices.forEach(v => mesh.addVertex(v));
    // Face winding: counter-clockwise when viewed from outside
    const faceIndices = [
      [3, 2, 1, 0], // back face (-Z)
      [4, 5, 6, 7], // front face (+Z)
      [0, 4, 7, 3], // left face (-X)
      [2, 6, 5, 1], // right face (+X)
      [7, 6, 2, 3], // top face (+Y)
      [0, 1, 5, 4]  // bottom face (-Y)
    ];
    faceIndices.forEach(indices => mesh.addFace(new Face(indices)));
    mesh.calculateNormals();
    return mesh;
  }
  static createSphere(radius: number, segments: number, rings: number): Mesh {
    const mesh = new Mesh();
    for (let ring = 0; ring <= rings; ring++) {
      const v = ring / rings;
      const phi = v * Math.PI;
      for (let seg = 0; seg <= segments; seg++) {
        const u = seg / segments;
        const theta = u * Math.PI * 2;
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        const pos = new Vec3(x, y, z);
        const normal = pos.normalize();
        mesh.addVertex(new Vertex(pos, { normal, uv: [u, v] }));
      }
    }
    for (let ring = 0; ring < rings; ring++) {
      for (let seg = 0; seg < segments; seg++) {
        const current = ring * (segments + 1) + seg;
        const next = current + segments + 1;
        mesh.addFace(new Face([current, next, next + 1, current + 1]));
      }
    }
    return mesh;
  }
}
