import { Mesh, MeshEdge } from './Mesh';
import { EdgeLoop } from './EdgeLoop';
import { Face } from './Face';
import { Vertex } from './Vertex';
import { Vec3 } from '../math/Vec3';
import { perlin3d } from '../math/MathService';

/**
 * Helper function to create edge key (order-independent)
 */
function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

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

  /**
   * Bevel edges of a mesh to create smooth or chamfered transitions.
   *
   * Algorithm:
   * 1. For each vertex on a beveled edge, create new vertices pulled back along each adjacent face
   * 2. Replace original faces with smaller versions using the pulled-back vertices
   * 3. Create chamfer faces along each beveled edge
   * 4. Create corner faces where multiple beveled edges meet
   *
   * @param mesh The input mesh
   * @param edges Array of edges to bevel
   * @param width The bevel width (distance from original edge)
   * @param segments Number of segments (1 = chamfer, 2+ = smooth bevel)
   * @returns New mesh with beveled edges
   */
  static bevel(mesh: Mesh, edges: MeshEdge[], width: number, segments: number = 1): Mesh {
    // Handle edge cases
    if (edges.length === 0 || width <= 0 || segments < 1) {
      return mesh.clone();
    }

    // Clamp width to prevent self-intersection
    const bounds = mesh.getBounds();
    const minDimension = Math.min(bounds.size.x, bounds.size.y, bounds.size.z);
    const maxWidth = minDimension * 0.25; // Max 25% of smallest dimension
    const clampedWidth = Math.min(width, maxWidth);

    if (clampedWidth <= 0) {
      return mesh.clone();
    }

    // Build edge set for quick lookup
    const edgeSet = new Set<string>();
    for (const edge of edges) {
      edgeSet.add(edgeKey(edge.vertexA, edge.vertexB));
    }

    // Build vertex → edges map
    const vertexEdges = new Map<number, MeshEdge[]>();
    for (const edge of edges) {
      if (!vertexEdges.has(edge.vertexA)) vertexEdges.set(edge.vertexA, []);
      if (!vertexEdges.has(edge.vertexB)) vertexEdges.set(edge.vertexB, []);
      vertexEdges.get(edge.vertexA)!.push(edge);
      vertexEdges.get(edge.vertexB)!.push(edge);
    }

    // Create output mesh
    const result = new Mesh();

    // Map: original vertex index → new vertex index (for non-beveled vertices)
    const vertexMap = new Map<number, number>();

    // Map: (original vertex, face index) → new vertex index (for beveled vertices)
    // Each face gets its own copy of vertices on beveled edges
    const faceVertexMap = new Map<string, number>();

    // First: copy all vertices, creating per-face copies for beveled vertices
    for (let i = 0; i < mesh.vertices.length; i++) {
      const vertex = mesh.vertices[i];
      const connectedEdges = vertexEdges.get(i) || [];

      if (connectedEdges.length === 0) {
        // Not on beveled edge - just copy
        vertexMap.set(i, result.vertices.length);
        result.addVertex(vertex.clone());
      }
      // Beveled vertices are created per-face in the next step
    }

    // Second: for each face, create new vertices pulled inward from beveled edges
    for (let faceIdx = 0; faceIdx < mesh.faces.length; faceIdx++) {
      const face = mesh.faces[faceIdx];

      for (let i = 0; i < face.indices.length; i++) {
        const vIdx = face.indices[i];
        const connectedEdges = vertexEdges.get(vIdx) || [];

        if (connectedEdges.length === 0) {
          // Not on beveled edge - already copied
          continue;
        }

        const key = `${vIdx}-${faceIdx}`;
        if (faceVertexMap.has(key)) continue;

        const vertex = mesh.vertices[vIdx];
        const prevIdx = face.indices[(i - 1 + face.indices.length) % face.indices.length];
        const nextIdx = face.indices[(i + 1) % face.indices.length];

        // Calculate pull-back direction (average of edge directions within this face)
        const prevPos = mesh.vertices[prevIdx].position;
        const nextPos = mesh.vertices[nextIdx].position;
        const currPos = vertex.position;

        const toPrev = prevPos.sub(currPos).normalize();
        const toNext = nextPos.sub(currPos).normalize();

        // Pull back along the bisector of the two edges
        const pullDir = toPrev.add(toNext).normalize();

        // If pullDir is zero (edges are opposite), use face normal
        let offset: Vec3;
        if (pullDir.length() < 0.001) {
          offset = new Vec3(0, 0, 0);
        } else {
          // Scale by width, adjusted for angle
          const angle = Math.acos(Math.max(-1, Math.min(1, toPrev.dot(toNext))));
          const scale = clampedWidth / Math.sin(angle / 2 + 0.001);
          offset = pullDir.mul(Math.min(scale, clampedWidth * 2));
        }

        const newVertex = vertex.clone();
        newVertex.position = currPos.add(offset);
        faceVertexMap.set(key, result.vertices.length);
        result.addVertex(newVertex);
      }
    }

    // Third: rebuild each face with new vertices
    for (let faceIdx = 0; faceIdx < mesh.faces.length; faceIdx++) {
      const face = mesh.faces[faceIdx];
      const newIndices: number[] = [];

      for (const vIdx of face.indices) {
        const connectedEdges = vertexEdges.get(vIdx) || [];
        if (connectedEdges.length === 0) {
          newIndices.push(vertexMap.get(vIdx)!);
        } else {
          const key = `${vIdx}-${faceIdx}`;
          newIndices.push(faceVertexMap.get(key)!);
        }
      }

      if (newIndices.length >= 3) {
        result.addFace(new Face(newIndices, face.color));
      }
    }

    // Fourth: create chamfer/bevel faces for each beveled edge
    // For multi-segment bevels, we interpolate intermediate vertices along a circular arc
    for (const edge of edges) {
      const faceLeft = edge.faceLeft;
      const faceRight = edge.faceRight;

      if (faceLeft < 0 || faceRight < 0) continue; // Boundary edge

      // Get the 4 corner vertices of the chamfer quad
      const keyAL = `${edge.vertexA}-${faceLeft}`;
      const keyAR = `${edge.vertexA}-${faceRight}`;
      const keyBL = `${edge.vertexB}-${faceLeft}`;
      const keyBR = `${edge.vertexB}-${faceRight}`;

      const vAL = faceVertexMap.get(keyAL);
      const vAR = faceVertexMap.get(keyAR);
      const vBL = faceVertexMap.get(keyBL);
      const vBR = faceVertexMap.get(keyBR);

      if (vAL !== undefined && vAR !== undefined && vBL !== undefined && vBR !== undefined) {
        // Determine correct winding direction
        const leftFace = mesh.faces[faceLeft];
        let leftGoesAtoB = false;
        for (let i = 0; i < leftFace.indices.length; i++) {
          if (leftFace.indices[i] === edge.vertexA &&
              leftFace.indices[(i + 1) % leftFace.indices.length] === edge.vertexB) {
            leftGoesAtoB = true;
            break;
          }
        }

        const chamferColor = mesh.faces[faceLeft].color || mesh.faces[faceRight].color;

        if (segments === 1) {
          // Single chamfer quad (original behavior)
          if (leftGoesAtoB) {
            result.addFace(new Face([vAL, vAR, vBR, vBL], chamferColor));
          } else {
            result.addFace(new Face([vBL, vBR, vAR, vAL], chamferColor));
          }
        } else {
          // Multi-segment smooth bevel: create intermediate vertex rows along a circular arc
          // For vertex A: arc from posAL to posAR, bulging toward original vertex A position
          // For vertex B: arc from posBL to posBR, bulging toward original vertex B position
          const posAL = result.vertices[vAL].position;
          const posAR = result.vertices[vAR].position;
          const posBL = result.vertices[vBL].position;
          const posBR = result.vertices[vBR].position;
          const origA = mesh.vertices[edge.vertexA].position;
          const origB = mesh.vertices[edge.vertexB].position;

          // Build rows of vertex indices: row 0 = left side, row N = right side
          const rows: [number, number][] = []; // [vertA_index, vertB_index] per row
          rows.push([vAL, vBL]); // row 0: left face side

          for (let s = 1; s < segments; s++) {
            const t = s / segments;
            // Circular arc interpolation: lerp + push outward toward original edge
            // Use sin-based profile for smooth circular arc
            // Interpolate along arc for vertex A
            const lerpA = posAL.mul(1 - t).add(posAR.mul(t));
            const bulgeA = origA.sub(posAL.mul(0.5).add(posAR.mul(0.5)));
            const arcOffsetA = Math.sin(t * Math.PI) * 0.5; // 0 at ends, peaks at middle
            const interpA = lerpA.add(bulgeA.mul(arcOffsetA));

            // Interpolate along arc for vertex B
            const lerpB = posBL.mul(1 - t).add(posBR.mul(t));
            const bulgeB = origB.sub(posBL.mul(0.5).add(posBR.mul(0.5)));
            const arcOffsetB = Math.sin(t * Math.PI) * 0.5;
            const interpB = lerpB.add(bulgeB.mul(arcOffsetB));

            const newVertA = result.vertices[vAL].clone();
            newVertA.position = interpA;
            const idxA = result.vertices.length;
            result.addVertex(newVertA);

            const newVertB = result.vertices[vBL].clone();
            newVertB.position = interpB;
            const idxB = result.vertices.length;
            result.addVertex(newVertB);

            rows.push([idxA, idxB]);
          }

          rows.push([vAR, vBR]); // row N: right face side

          // Create quad strip between consecutive rows
          for (let s = 0; s < rows.length - 1; s++) {
            const [a0, b0] = rows[s];
            const [a1, b1] = rows[s + 1];

            if (leftGoesAtoB) {
              result.addFace(new Face([a0, a1, b1, b0], chamferColor));
            } else {
              result.addFace(new Face([b0, b1, a1, a0], chamferColor));
            }
          }
        }
      }
    }

    // Fifth: create corner faces where multiple beveled edges meet at a vertex
    // For each original vertex that has beveled edges, collect all the per-face vertices
    // and create a polygon (or triangles) to close the corner
    for (let vIdx = 0; vIdx < mesh.vertices.length; vIdx++) {
      const connectedEdges = vertexEdges.get(vIdx) || [];
      if (connectedEdges.length < 2) continue; // Need at least 2 edges for a corner

      // Collect all faces that share this vertex
      const facesAtVertex = new Set<number>();
      for (const edge of connectedEdges) {
        if (edge.faceLeft >= 0) facesAtVertex.add(edge.faceLeft);
        if (edge.faceRight >= 0) facesAtVertex.add(edge.faceRight);
      }

      if (facesAtVertex.size < 3) continue; // Need at least 3 faces for a corner cap

      // Get the per-face vertices for this corner and find a color from adjacent faces
      const cornerVerts: number[] = [];
      let cornerColor: { r: number; g: number; b: number } | undefined;
      for (const faceIdx of facesAtVertex) {
        const key = `${vIdx}-${faceIdx}`;
        const vertIdx = faceVertexMap.get(key);
        if (vertIdx !== undefined) {
          cornerVerts.push(vertIdx);
          // Get color from first face that has one
          if (!cornerColor && mesh.faces[faceIdx].color) {
            cornerColor = mesh.faces[faceIdx].color;
          }
        }
      }

      if (cornerVerts.length < 3) continue;

      // Calculate the center of the corner polygon and the outward direction
      const origPos = mesh.vertices[vIdx].position;
      let centerPos = new Vec3(0, 0, 0);
      for (const vi of cornerVerts) {
        centerPos = centerPos.add(result.vertices[vi].position);
      }
      centerPos = centerPos.mul(1 / cornerVerts.length);

      // Outward direction is from mesh center toward original vertex
      const outwardDir = origPos.sub(new Vec3(0, 0, 0)).normalize();

      // Sort corner vertices by angle around the outward direction
      // Use a consistent reference direction perpendicular to outward
      let refDir = new Vec3(1, 0, 0);
      if (Math.abs(outwardDir.dot(refDir)) > 0.9) {
        refDir = new Vec3(0, 1, 0);
      }
      const tangent1 = outwardDir.cross(refDir).normalize();
      const tangent2 = outwardDir.cross(tangent1).normalize();

      const angles: { idx: number; angle: number }[] = [];
      for (const vi of cornerVerts) {
        const pos = result.vertices[vi].position;
        const toVert = pos.sub(centerPos);
        const x = toVert.dot(tangent1);
        const y = toVert.dot(tangent2);
        const angle = Math.atan2(y, x);
        angles.push({ idx: vi, angle });
      }

      // Sort by angle (CCW when looking along outward direction)
      angles.sort((a, b) => a.angle - b.angle);
      const sortedVerts = angles.map(a => a.idx);

      // The corner face normal should point outward (away from mesh center)
      // Check if our winding produces outward normal, reverse if not
      if (sortedVerts.length >= 3) {
        const v0 = result.vertices[sortedVerts[0]].position;
        const v1 = result.vertices[sortedVerts[1]].position;
        const v2 = result.vertices[sortedVerts[2]].position;
        const edge1 = v1.sub(v0);
        const edge2 = v2.sub(v0);
        const faceNormal = edge1.cross(edge2);

        // If face normal points inward (opposite to outward), reverse the winding
        if (faceNormal.dot(outwardDir) < 0) {
          sortedVerts.reverse();
        }
      }

      // Create corner polygon (may need to be triangulated for >3 vertices)
      if (sortedVerts.length === 3) {
        // Simple triangle
        result.addFace(new Face(sortedVerts, cornerColor));
      } else {
        // Fan triangulation from first vertex
        for (let i = 1; i < sortedVerts.length - 1; i++) {
          result.addFace(new Face([sortedVerts[0], sortedVerts[i], sortedVerts[i + 1]], cornerColor));
        }
      }
    }

    // Recalculate normals
    result.calculateNormals();

    return result;
  }

  /**
   * Displace mesh vertices along their normals using 3D noise.
   *
   * Creates organic, hand-shaped, or weathered surface variation.
   * Uses 3D Perlin noise to ensure consistent displacement across the mesh.
   *
   * @param mesh The input mesh (must have calculated normals)
   * @param amplitude Maximum displacement distance (positive = outward, noise range is [-amplitude, +amplitude])
   * @param frequency Noise frequency (higher = more detail, typically 1-10)
   * @param seed Random seed for reproducible results
   * @returns New mesh with displaced vertices and recalculated normals
   */
  static displaceByNoise(mesh: Mesh, amplitude: number, frequency: number, seed: number): Mesh {

    // Clone mesh to avoid modifying original
    const result = mesh.clone();

    // Ensure we have normals to displace along
    if (!result.vertices.some(v => v.attributes.normal)) {
      result.calculateNormals();
    }

    // Displace each vertex along its normal
    for (const vertex of result.vertices) {
      const pos = vertex.position;
      const normal = vertex.attributes.normal ?? new Vec3(0, 1, 0);

      // Sample 3D noise at vertex position
      // Frequency scales the sampling coordinates
      const noiseValue = perlin3d(
        pos.x * frequency,
        pos.y * frequency,
        pos.z * frequency,
        seed
      );

      // Displace along normal by noise * amplitude
      // perlin3d returns [-1, 1], so displacement is [-amplitude, +amplitude]
      const displacement = normal.mul(noiseValue * amplitude);
      vertex.position = pos.add(displacement);
    }

    // Recalculate normals after displacement
    result.calculateNormals();

    return result;
  }
}



