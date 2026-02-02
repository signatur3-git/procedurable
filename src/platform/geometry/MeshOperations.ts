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

    // Create vertices per-face for proper UVs (24 vertices for 6 faces)
    // Each face has 4 vertices with UV coordinates [0,0], [1,0], [1,1], [0,1]

    // Back face (-Z) - looking from behind
    const backStart = mesh.vertices.length;
    mesh.addVertex(new Vertex(new Vec3(-hw, -hh, -hd), { uv: [0, 0] })); // bottom-left
    mesh.addVertex(new Vertex(new Vec3(hw, -hh, -hd), { uv: [1, 0] }));  // bottom-right
    mesh.addVertex(new Vertex(new Vec3(hw, hh, -hd), { uv: [1, 1] }));   // top-right
    mesh.addVertex(new Vertex(new Vec3(-hw, hh, -hd), { uv: [0, 1] }));  // top-left
    mesh.addFace(new Face([backStart + 3, backStart + 2, backStart + 1, backStart + 0]));

    // Front face (+Z) - looking from front
    const frontStart = mesh.vertices.length;
    mesh.addVertex(new Vertex(new Vec3(-hw, -hh, hd), { uv: [0, 0] }));
    mesh.addVertex(new Vertex(new Vec3(hw, -hh, hd), { uv: [1, 0] }));
    mesh.addVertex(new Vertex(new Vec3(hw, hh, hd), { uv: [1, 1] }));
    mesh.addVertex(new Vertex(new Vec3(-hw, hh, hd), { uv: [0, 1] }));
    mesh.addFace(new Face([frontStart + 0, frontStart + 1, frontStart + 2, frontStart + 3]));

    // Left face (-X)
    const leftStart = mesh.vertices.length;
    mesh.addVertex(new Vertex(new Vec3(-hw, -hh, -hd), { uv: [0, 0] }));
    mesh.addVertex(new Vertex(new Vec3(-hw, -hh, hd), { uv: [1, 0] }));
    mesh.addVertex(new Vertex(new Vec3(-hw, hh, hd), { uv: [1, 1] }));
    mesh.addVertex(new Vertex(new Vec3(-hw, hh, -hd), { uv: [0, 1] }));
    mesh.addFace(new Face([leftStart + 0, leftStart + 1, leftStart + 2, leftStart + 3]));

    // Right face (+X)
    const rightStart = mesh.vertices.length;
    mesh.addVertex(new Vertex(new Vec3(hw, -hh, -hd), { uv: [0, 0] }));
    mesh.addVertex(new Vertex(new Vec3(hw, -hh, hd), { uv: [1, 0] }));
    mesh.addVertex(new Vertex(new Vec3(hw, hh, hd), { uv: [1, 1] }));
    mesh.addVertex(new Vertex(new Vec3(hw, hh, -hd), { uv: [0, 1] }));
    mesh.addFace(new Face([rightStart + 3, rightStart + 2, rightStart + 1, rightStart + 0]));

    // Top face (+Y)
    const topStart = mesh.vertices.length;
    mesh.addVertex(new Vertex(new Vec3(-hw, hh, -hd), { uv: [0, 0] }));
    mesh.addVertex(new Vertex(new Vec3(hw, hh, -hd), { uv: [1, 0] }));
    mesh.addVertex(new Vertex(new Vec3(hw, hh, hd), { uv: [1, 1] }));
    mesh.addVertex(new Vertex(new Vec3(-hw, hh, hd), { uv: [0, 1] }));
    mesh.addFace(new Face([topStart + 3, topStart + 2, topStart + 1, topStart + 0]));

    // Bottom face (-Y)
    const bottomStart = mesh.vertices.length;
    mesh.addVertex(new Vertex(new Vec3(-hw, -hh, -hd), { uv: [0, 0] }));
    mesh.addVertex(new Vertex(new Vec3(hw, -hh, -hd), { uv: [1, 0] }));
    mesh.addVertex(new Vertex(new Vec3(hw, -hh, hd), { uv: [1, 1] }));
    mesh.addVertex(new Vertex(new Vec3(-hw, -hh, hd), { uv: [0, 1] }));
    mesh.addFace(new Face([bottomStart + 0, bottomStart + 1, bottomStart + 2, bottomStart + 3]));

    mesh.calculateNormals();
    return mesh;
  }

  /**
   * Create a box mesh with shared vertices.
   * Use this for topology-sensitive operations like edge detection and bevel.
   * For UV-correct boxes with per-face UVs, use createBox().
   */
  static createBoxWithSharedVertices(width: number, height: number, depth: number): Mesh {
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

  /**
   * Bend mesh around an axis perpendicular to the bend direction.
   *
   * @param mesh The mesh to bend
   * @param axis The axis along which bending occurs ('x', 'y', or 'z')
   * @param angle Total bend angle in radians (positive = bend toward positive perpendicular direction)
   * @param center Center point of the bend operation (defaults to mesh center on the bend axis)
   * @returns New mesh with bent vertices
   *
   * Example: bend along Y axis bends the mesh so top/bottom curve toward X (or Z)
   */
  static bend(mesh: Mesh, axis: 'x' | 'y' | 'z', angle: number, center?: Vec3): Mesh {
    const result = mesh.clone();

    // Get mesh bounds to determine the bend range
    const bounds = result.getAABB();
    const meshCenter = center ?? bounds.center;

    // Get the extent along the bend axis
    let axisMin: number, axisMax: number;
    switch (axis) {
      case 'x': axisMin = bounds.min.x; axisMax = bounds.max.x; break;
      case 'y': axisMin = bounds.min.y; axisMax = bounds.max.y; break;
      case 'z': axisMin = bounds.min.z; axisMax = bounds.max.z; break;
    }
    const axisLength = axisMax - axisMin;

    if (axisLength < 1e-6 || Math.abs(angle) < 1e-6) {
      return result; // No bending needed
    }

    // Calculate bend radius: arc length = radius * angle
    // We want the mesh to span the full angle, so radius = axisLength / angle
    const radius = axisLength / Math.abs(angle);

    // For each vertex, compute its bent position
    for (const vertex of result.vertices) {
      const pos = vertex.position;

      // Get coordinate along bend axis (relative to mesh center on that axis)
      let axisCoord: number, perpCoord: number;
      switch (axis) {
        case 'x':
          axisCoord = pos.x - meshCenter.x;
          perpCoord = pos.z - meshCenter.z;
          break;
        case 'y':
          axisCoord = pos.y - meshCenter.y;
          perpCoord = pos.x - meshCenter.x;
          break;
        case 'z':
          axisCoord = pos.z - meshCenter.z;
          perpCoord = pos.x - meshCenter.x;
          break;
      }

      // Normalize axis coordinate to [-0.5, 0.5] range (relative to mesh extent)
      const t = axisCoord / axisLength;

      // Calculate the bend angle at this point (proportional to position along axis)
      const bendAngle = t * angle;

      // Calculate new position on the bent arc
      // The vertex rotates around a point at distance 'radius' from the mesh
      const newRadius = radius + perpCoord;
      const newAxisCoord = newRadius * Math.sin(bendAngle);
      const newPerpCoord = radius - newRadius * Math.cos(bendAngle);

      // Apply the transformation back to 3D coordinates
      switch (axis) {
        case 'x':
          vertex.position = new Vec3(
            meshCenter.x + newAxisCoord,
            pos.y,
            meshCenter.z + newPerpCoord
          );
          break;
        case 'y':
          vertex.position = new Vec3(
            meshCenter.x + newPerpCoord,
            meshCenter.y + newAxisCoord,
            pos.z
          );
          break;
        case 'z':
          vertex.position = new Vec3(
            meshCenter.x + newPerpCoord,
            pos.y,
            meshCenter.z + newAxisCoord
          );
          break;
      }
    }

    // Recalculate normals after bending
    result.calculateNormals();

    return result;
  }

  /**
   * Twist mesh around an axis.
   *
   * @param mesh The mesh to twist
   * @param axis The axis to twist around ('x', 'y', or 'z')
   * @param angle Total twist angle in radians over the full extent of the mesh
   * @param center Center point of the twist operation (defaults to mesh center)
   * @returns New mesh with twisted vertices
   *
   * Example: twist around Y axis rotates vertices in XZ plane, with rotation
   * proportional to Y position (bottom = no rotation, top = full rotation)
   */
  static twist(mesh: Mesh, axis: 'x' | 'y' | 'z', angle: number, center?: Vec3): Mesh {
    const result = mesh.clone();

    // Get mesh bounds to determine the twist range
    const bounds = result.getAABB();
    const twistCenter = center ?? bounds.center;

    // Get the extent along the twist axis
    let axisMin: number, axisMax: number;
    switch (axis) {
      case 'x': axisMin = bounds.min.x; axisMax = bounds.max.x; break;
      case 'y': axisMin = bounds.min.y; axisMax = bounds.max.y; break;
      case 'z': axisMin = bounds.min.z; axisMax = bounds.max.z; break;
    }
    const axisLength = axisMax - axisMin;

    if (axisLength < 1e-6 || Math.abs(angle) < 1e-6) {
      return result; // No twisting needed
    }

    // For each vertex, rotate it around the axis proportionally to its position
    for (const vertex of result.vertices) {
      const pos = vertex.position;

      // Get coordinate along twist axis and perpendicular coordinates
      let axisCoord: number, perpX: number, perpY: number;
      switch (axis) {
        case 'x':
          axisCoord = pos.x;
          perpX = pos.y - twistCenter.y;
          perpY = pos.z - twistCenter.z;
          break;
        case 'y':
          axisCoord = pos.y;
          perpX = pos.x - twistCenter.x;
          perpY = pos.z - twistCenter.z;
          break;
        case 'z':
          axisCoord = pos.z;
          perpX = pos.x - twistCenter.x;
          perpY = pos.y - twistCenter.y;
          break;
      }

      // Calculate twist angle at this point (proportional to position along axis)
      // Centered: mid-point gets no twist, ends get ±angle/2
      const t = (axisCoord - (axisMin + axisMax) / 2) / axisLength;
      const twistAngle = t * angle;

      // Rotate perpendicular coordinates around the axis
      const cos = Math.cos(twistAngle);
      const sin = Math.sin(twistAngle);
      const newPerpX = perpX * cos - perpY * sin;
      const newPerpY = perpX * sin + perpY * cos;

      // Apply the transformation back to 3D coordinates
      switch (axis) {
        case 'x':
          vertex.position = new Vec3(
            pos.x,
            twistCenter.y + newPerpX,
            twistCenter.z + newPerpY
          );
          break;
        case 'y':
          vertex.position = new Vec3(
            twistCenter.x + newPerpX,
            pos.y,
            twistCenter.z + newPerpY
          );
          break;
        case 'z':
          vertex.position = new Vec3(
            twistCenter.x + newPerpX,
            twistCenter.y + newPerpY,
            pos.z
          );
          break;
      }
    }

    // Recalculate normals after twisting
    result.calculateNormals();

    return result;
  }

  /**
   * Taper mesh by scaling progressively along an axis.
   *
   * @param mesh The mesh to taper
   * @param axis The axis along which tapering occurs ('x', 'y', or 'z')
   * @param startScale Scale factor at the minimum axis position (e.g., 1.0 = no change)
   * @param endScale Scale factor at the maximum axis position (e.g., 0.5 = half size)
   * @param center Optional center point for the taper (defaults to mesh center)
   * @returns New mesh with tapered vertices
   *
   * Example: taper along Y with startScale=1 and endScale=0.5 makes a cone-like shape
   * where the bottom is full size and the top is half size.
   */
  static taper(mesh: Mesh, axis: 'x' | 'y' | 'z', startScale: number, endScale: number, center?: Vec3): Mesh {
    const result = mesh.clone();

    // Get mesh bounds to determine the taper range
    const bounds = result.getAABB();
    const taperCenter = center ?? bounds.center;

    // Get the extent along the taper axis
    let axisMin: number, axisMax: number;
    switch (axis) {
      case 'x': axisMin = bounds.min.x; axisMax = bounds.max.x; break;
      case 'y': axisMin = bounds.min.y; axisMax = bounds.max.y; break;
      case 'z': axisMin = bounds.min.z; axisMax = bounds.max.z; break;
    }
    const axisLength = axisMax - axisMin;

    if (axisLength < 1e-6) {
      return result; // No tapering possible (flat mesh)
    }

    // For each vertex, scale perpendicular coordinates based on position along axis
    for (const vertex of result.vertices) {
      const pos = vertex.position;

      // Get coordinate along taper axis
      let axisCoord: number;
      switch (axis) {
        case 'x': axisCoord = pos.x; break;
        case 'y': axisCoord = pos.y; break;
        case 'z': axisCoord = pos.z; break;
      }

      // Calculate interpolation factor (0 at min, 1 at max)
      const t = (axisCoord - axisMin) / axisLength;

      // Interpolate scale factor
      const scale = startScale + (endScale - startScale) * t;

      // Scale perpendicular coordinates relative to center
      switch (axis) {
        case 'x':
          vertex.position = new Vec3(
            pos.x,
            taperCenter.y + (pos.y - taperCenter.y) * scale,
            taperCenter.z + (pos.z - taperCenter.z) * scale
          );
          break;
        case 'y':
          vertex.position = new Vec3(
            taperCenter.x + (pos.x - taperCenter.x) * scale,
            pos.y,
            taperCenter.z + (pos.z - taperCenter.z) * scale
          );
          break;
        case 'z':
          vertex.position = new Vec3(
            taperCenter.x + (pos.x - taperCenter.x) * scale,
            taperCenter.y + (pos.y - taperCenter.y) * scale,
            pos.z
          );
          break;
      }
    }

    // Recalculate normals after tapering
    result.calculateNormals();

    return result;
  }

  /**
   * Mirror mesh across a plane.
   *
   * @param mesh The mesh to mirror
   * @param plane The mirror plane, defined by axis ('x', 'y', 'z') or { point, normal }
   * @param weld If true, merge the mirrored mesh with the original (weld boundary vertices)
   * @returns New mesh with mirrored geometry (and original if weld=true)
   *
   * Example: mirror(mesh, 'x') mirrors across YZ plane (x=0)
   * Example: mirror(mesh, { point: {x:0,y:0,z:0}, normal: {x:1,y:0,z:0} }, true) mirrors and welds
   */
  static mirror(
    mesh: Mesh,
    plane: 'x' | 'y' | 'z' | { point: Vec3; normal: Vec3 },
    weld: boolean = false
  ): Mesh {
    // Normalize plane definition
    let planePoint: Vec3;
    let planeNormal: Vec3;

    if (typeof plane === 'string') {
      planePoint = new Vec3(0, 0, 0);
      switch (plane) {
        case 'x': planeNormal = new Vec3(1, 0, 0); break;
        case 'y': planeNormal = new Vec3(0, 1, 0); break;
        case 'z': planeNormal = new Vec3(0, 0, 1); break;
      }
    } else {
      planePoint = plane.point;
      planeNormal = plane.normal.normalize();
    }

    // Create mirrored mesh
    const mirrored = new Mesh();

    // Mirror each vertex across the plane
    for (const vertex of mesh.vertices) {
      const pos = vertex.position;

      // Calculate distance from point to plane
      const d = pos.sub(planePoint).dot(planeNormal);

      // Mirror position: p' = p - 2*d*n
      const mirroredPos = pos.sub(planeNormal.mul(2 * d));

      // Clone vertex with mirrored position
      const newVertex = vertex.clone();
      newVertex.position = mirroredPos;

      // Mirror normal if present
      if (newVertex.attributes.normal) {
        const n = newVertex.attributes.normal;
        // Reflect normal: n' = n - 2*(n·planeNormal)*planeNormal
        const nd = n.dot(planeNormal);
        newVertex.attributes.normal = n.sub(planeNormal.mul(2 * nd));
      }

      mirrored.addVertex(newVertex);
    }

    // Copy faces with reversed winding order (to maintain outward normals)
    for (const face of mesh.faces) {
      // Reverse the indices to flip the face normal
      const reversedIndices = [...face.indices].reverse();
      const newFace = new Face(reversedIndices, face.color);
      newFace.materialSlotIndex = face.materialSlotIndex;
      mirrored.addFace(newFace);
    }

    // Copy material slots
    for (const slot of mesh.materialSlots) {
      mirrored.addMaterialSlot(slot);
    }

    if (!weld) {
      // Just return the mirrored mesh
      mirrored.calculateNormals();
      return mirrored;
    }

    // Weld: combine original mesh with mirrored mesh
    const result = mesh.clone();
    const vertexOffset = result.vertices.length;

    // Add mirrored vertices
    for (const vertex of mirrored.vertices) {
      result.addVertex(vertex);
    }

    // Add mirrored faces with offset indices
    for (const face of mirrored.faces) {
      const offsetIndices = face.indices.map(i => i + vertexOffset);
      const newFace = new Face(offsetIndices, face.color);
      newFace.materialSlotIndex = face.materialSlotIndex;
      result.addFace(newFace);
    }

    // Weld boundary vertices that are on the mirror plane
    // Find vertices that are on (or very close to) the mirror plane
    const WELD_TOLERANCE = 1e-5;
    const vertexMap = new Map<number, number>(); // mirrored index -> original index

    for (let i = 0; i < mesh.vertices.length; i++) {
      const pos = mesh.vertices[i].position;
      const d = Math.abs(pos.sub(planePoint).dot(planeNormal));

      if (d < WELD_TOLERANCE) {
        // This vertex is on the mirror plane
        // Map the mirrored vertex back to the original
        vertexMap.set(i + vertexOffset, i);
      }
    }

    // Remap face indices for welded vertices
    if (vertexMap.size > 0) {
      for (const face of result.faces) {
        for (let i = 0; i < face.indices.length; i++) {
          const mappedIndex = vertexMap.get(face.indices[i]);
          if (mappedIndex !== undefined) {
            face.indices[i] = mappedIndex;
          }
        }
      }

      // Remove duplicate vertices (the mirrored ones that got remapped)
      // This is complex, so for now we just leave the unused vertices
      // They don't affect rendering, just slightly increase memory
    }

    result.calculateNormals();
    return result;
  }

  /**
   * Create a radial array of a mesh around an axis.
   *
   * @param mesh The mesh to duplicate radially
   * @param axis The axis to rotate around, defined by point + direction, or simple 'x'/'y'/'z'
   * @param count Number of copies to create (including original)
   * @param angle Total angle in radians to spread copies over (default: 2*PI for full circle)
   * @param includeOriginal If true (default), includes the original mesh; if false, only rotated copies
   * @returns New mesh with all copies combined
   *
   * Example: radialArray(tooth, 'y', 24) creates 24 copies around Y axis (15° apart)
   * Example: radialArray(mesh, 'z', 4, Math.PI) creates 4 copies over 180°
   */
  static radialArray(
    mesh: Mesh,
    axis: 'x' | 'y' | 'z' | { point: Vec3; direction: Vec3 },
    count: number,
    angle: number = Math.PI * 2,
    includeOriginal: boolean = true
  ): Mesh {
    if (count < 1) {
      return mesh.clone();
    }

    // Normalize axis definition
    let axisPoint: Vec3;
    let axisDir: Vec3;

    if (typeof axis === 'string') {
      axisPoint = new Vec3(0, 0, 0);
      switch (axis) {
        case 'x': axisDir = new Vec3(1, 0, 0); break;
        case 'y': axisDir = new Vec3(0, 1, 0); break;
        case 'z': axisDir = new Vec3(0, 0, 1); break;
      }
    } else {
      axisPoint = axis.point;
      axisDir = axis.direction.normalize();
    }

    const result = new Mesh();

    // Copy material slots from original
    for (const slot of mesh.materialSlots) {
      result.addMaterialSlot(slot);
    }

    // Calculate angle step
    const angleStep = count > 1 ? angle / count : 0;
    const startIndex = includeOriginal ? 0 : 1;

    // Create each copy
    for (let i = startIndex; i < count; i++) {
      const rotAngle = i * angleStep;
      const vertexOffset = result.vertices.length;

      // Add rotated vertices
      for (const vertex of mesh.vertices) {
        const pos = vertex.position;

        // Rotate position around axis
        const rotatedPos = this.rotatePointAroundAxis(pos, axisPoint, axisDir, rotAngle);

        const newVertex = vertex.clone();
        newVertex.position = rotatedPos;

        // Rotate normal if present
        if (newVertex.attributes.normal) {
          newVertex.attributes.normal = this.rotateVectorAroundAxis(
            newVertex.attributes.normal, axisDir, rotAngle
          );
        }

        result.addVertex(newVertex);
      }

      // Add faces with offset indices
      for (const face of mesh.faces) {
        const offsetIndices = face.indices.map(idx => idx + vertexOffset);
        const newFace = new Face(offsetIndices, face.color);
        newFace.materialSlotIndex = face.materialSlotIndex;
        result.addFace(newFace);
      }
    }

    result.calculateNormals();
    return result;
  }

  /**
   * Rotate a point around an axis using Rodrigues' rotation formula.
   */
  private static rotatePointAroundAxis(point: Vec3, axisPoint: Vec3, axisDir: Vec3, angle: number): Vec3 {
    // Translate point relative to axis point
    const p = point.sub(axisPoint);

    // Rodrigues' rotation formula
    const rotated = this.rotateVectorAroundAxis(p, axisDir, angle);

    // Translate back
    return rotated.add(axisPoint);
  }

  /**
   * Rotate a vector around an axis using Rodrigues' rotation formula.
   */
  private static rotateVectorAroundAxis(v: Vec3, axis: Vec3, angle: number): Vec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // v_rot = v*cos(θ) + (axis × v)*sin(θ) + axis*(axis·v)*(1-cos(θ))
    const cross = axis.cross(v);
    const dot = axis.dot(v);

    return v.mul(cos)
      .add(cross.mul(sin))
      .add(axis.mul(dot * (1 - cos)));
  }

  // ===========================================================================
  // B5-003: Loop Resampling for Blend Zones
  // ===========================================================================

  /**
   * Resample a loop to have a target number of vertices.
   * Uses linear interpolation along the loop perimeter.
   *
   * @param loop The input edge loop
   * @param targetCount The desired number of vertices
   * @returns A new EdgeLoop with targetCount vertices
   */
  static resampleLoop(loop: EdgeLoop, targetCount: number): EdgeLoop {
    if (targetCount < 3) {
      throw new Error('Target vertex count must be at least 3');
    }

    const vertices = loop.vertices;
    const n = vertices.length;

    if (n === targetCount) {
      // Already the right size
      return new EdgeLoop(vertices.map(v => v.clone()));
    }

    // Calculate cumulative edge lengths
    const edgeLengths: number[] = [];
    let totalLength = 0;

    for (let i = 0; i < n; i++) {
      const nextI = (i + 1) % n;
      const length = vertices[i].position.sub(vertices[nextI].position).length();
      edgeLengths.push(length);
      totalLength += length;
    }

    // Create cumulative distance array
    const cumulative: number[] = [0];
    for (let i = 0; i < n; i++) {
      cumulative.push(cumulative[i] + edgeLengths[i]);
    }

    // Sample new vertices at equal arc-length intervals
    const newVertices: Vertex[] = [];
    const stepLength = totalLength / targetCount;

    for (let i = 0; i < targetCount; i++) {
      const targetDist = i * stepLength;

      // Find which edge this distance falls on
      let edgeIndex = 0;
      while (edgeIndex < n - 1 && cumulative[edgeIndex + 1] <= targetDist) {
        edgeIndex++;
      }

      // Handle wrap-around
      if (edgeIndex >= n) {
        edgeIndex = n - 1;
      }

      // Interpolate along this edge
      const edgeStart = cumulative[edgeIndex];
      const edgeLen = edgeLengths[edgeIndex];
      const t = edgeLen > 0 ? (targetDist - edgeStart) / edgeLen : 0;

      const v1 = vertices[edgeIndex];
      const v2 = vertices[(edgeIndex + 1) % n];

      // Interpolate position using Vec3
      const interpolatedPos = new Vec3(
        v1.position.x + t * (v2.position.x - v1.position.x),
        v1.position.y + t * (v2.position.y - v1.position.y),
        v1.position.z + t * (v2.position.z - v1.position.z)
      );

      newVertices.push(new Vertex(interpolatedPos));
    }

    return new EdgeLoop(newVertices);
  }

  /**
   * Loft between two loops that may have different vertex counts.
   * Automatically resamples to the larger count.
   *
   * @param loop1 First edge loop
   * @param loop2 Second edge loop
   * @param segments Number of intermediate segments (default 1 = direct connection)
   * @returns A mesh connecting the two loops
   */
  static loftWithResampling(loop1: EdgeLoop, loop2: EdgeLoop, segments: number = 1): Mesh {
    const count1 = loop1.length;
    const count2 = loop2.length;

    // Resample to the larger count
    const targetCount = Math.max(count1, count2);

    const resampled1 = count1 === targetCount ? loop1 : this.resampleLoop(loop1, targetCount);
    const resampled2 = count2 === targetCount ? loop2 : this.resampleLoop(loop2, targetCount);

    if (segments === 1) {
      // Direct loft
      return this.loft([resampled1, resampled2]);
    }

    // Create intermediate loops by interpolation
    const loops: EdgeLoop[] = [resampled1];

    for (let s = 1; s < segments; s++) {
      const t = s / segments;
      const intermediateVerts: Vertex[] = [];

      for (let i = 0; i < targetCount; i++) {
        const v1 = resampled1.vertices[i];
        const v2 = resampled2.vertices[i];
        const interpolatedPos = new Vec3(
          v1.position.x + t * (v2.position.x - v1.position.x),
          v1.position.y + t * (v2.position.y - v1.position.y),
          v1.position.z + t * (v2.position.z - v1.position.z)
        );
        intermediateVerts.push(new Vertex(interpolatedPos));
      }

      loops.push(new EdgeLoop(intermediateVerts));
    }

    loops.push(resampled2);

    return this.loft(loops);
  }

  /**
   * Create a blend mesh between two loops from different builders.
   * This is the high-level API for B5-003 blend zones.
   *
   * @param myLoop Loop from the current builder (already in world space)
   * @param theirLoop Loop from another builder (already in world space)
   * @param options Blend options
   * @returns A mesh connecting the two loops
   */
  static createBlendZone(
    myLoop: EdgeLoop,
    theirLoop: EdgeLoop,
    options: {
      segments?: number;
      alignLoops?: boolean;  // Try to align starting vertices for better topology
    } = {}
  ): Mesh {
    const segments = options.segments ?? 1;

    let loop1 = myLoop;
    let loop2 = theirLoop;

    // Optionally align loops to minimize twist
    if (options.alignLoops !== false) {
      loop2 = this.alignLoopToMatch(loop1, loop2);
    }

    return this.loftWithResampling(loop1, loop2, segments);
  }

  /**
   * Rotate a loop's starting vertex to best align with another loop.
   * Minimizes the sum of squared distances between corresponding vertices.
   */
  private static alignLoopToMatch(reference: EdgeLoop, toAlign: EdgeLoop): EdgeLoop {
    const refVerts = reference.vertices;
    const alignVerts = toAlign.vertices;

    // Resample if needed for comparison
    const targetCount = refVerts.length;
    const resampled = alignVerts.length === targetCount
      ? alignVerts
      : this.resampleLoop(toAlign, targetCount).vertices;

    // Find the rotation that minimizes distance
    let bestRotation = 0;
    let bestScore = Infinity;

    for (let rot = 0; rot < targetCount; rot++) {
      let score = 0;
      for (let i = 0; i < targetCount; i++) {
        const refV = refVerts[i].position;
        const alignV = resampled[(i + rot) % targetCount].position;
        const dx = refV.x - alignV.x;
        const dy = refV.y - alignV.y;
        const dz = refV.z - alignV.z;
        score += dx * dx + dy * dy + dz * dz;
      }
      if (score < bestScore) {
        bestScore = score;
        bestRotation = rot;
      }
    }

    // Apply rotation
    if (bestRotation === 0) {
      return new EdgeLoop(resampled.map(v => v.clone()));
    }

    const rotated: Vertex[] = [];
    for (let i = 0; i < targetCount; i++) {
      rotated.push(resampled[(i + bestRotation) % targetCount].clone());
    }

    return new EdgeLoop(rotated);
  }
}
