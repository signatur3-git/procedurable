/**
 * UV Debug Texture Tests
 *
 * Tests for UV visualization and automated UV quality checks
 */

import { Mesh } from '../../platform/geometry/Mesh';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { Vec3 } from '../../platform/math/Vec3';
import { generateUVDebugTexture, bakeTextures } from '../../platform/materials/TextureBaker';

describe('UV Debug Texture Generation', () => {
  /**
   * Create a simple quad mesh with UVs
   */
  function createQuadMesh(): Mesh {
    const mesh = new Mesh();

    // Create vertices with UVs covering [0.1, 0.9] range
    mesh.addVertex(new Vertex(new Vec3(0, 0, 0), { uv: [0.1, 0.1] }));
    mesh.addVertex(new Vertex(new Vec3(1, 0, 0), { uv: [0.9, 0.1] }));
    mesh.addVertex(new Vertex(new Vec3(1, 0, 1), { uv: [0.9, 0.9] }));
    mesh.addVertex(new Vertex(new Vec3(0, 0, 1), { uv: [0.1, 0.9] }));

    mesh.addFace(new Face([0, 1, 2, 3]));

    return mesh;
  }

  /**
   * Create a box mesh with UVs (6 faces, 2 triangles each = 12 triangles)
   */
  function createBoxMeshWithUVs(): Mesh {
    const mesh = new Mesh();

    // Create 8 corner vertices
    const positions = [
      [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],  // back face
      [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]   // front face
    ];

    // Add vertices - each face will have its own UVs, so we'll need to create
    // separate vertices for each face (24 total = 4 per face * 6 faces)
    const faceData = [
      { indices: [0, 1, 2, 3], uvs: [[0.0, 0.0], [0.33, 0.0], [0.33, 0.5], [0.0, 0.5]] },    // back
      { indices: [4, 7, 6, 5], uvs: [[0.33, 0.0], [0.66, 0.0], [0.66, 0.5], [0.33, 0.5]] },  // front
      { indices: [0, 4, 5, 1], uvs: [[0.66, 0.0], [1.0, 0.0], [1.0, 0.5], [0.66, 0.5]] },    // bottom
      { indices: [2, 6, 7, 3], uvs: [[0.0, 0.5], [0.33, 0.5], [0.33, 1.0], [0.0, 1.0]] },    // top
      { indices: [0, 3, 7, 4], uvs: [[0.33, 0.5], [0.66, 0.5], [0.66, 1.0], [0.33, 1.0]] },  // left
      { indices: [1, 5, 6, 2], uvs: [[0.66, 0.5], [1.0, 0.5], [1.0, 1.0], [0.66, 1.0]] }     // right
    ];

    for (const face of faceData) {
      const faceVertexIndices: number[] = [];

      for (let i = 0; i < 4; i++) {
        const pos = positions[face.indices[i]];
        const uv = face.uvs[i];
        const vi = mesh.addVertex(new Vertex(
          new Vec3(pos[0], pos[1], pos[2]),
          { uv: uv as [number, number] }
        ));
        faceVertexIndices.push(vi);
      }

      mesh.addFace(new Face(faceVertexIndices));
    }

    return mesh;
  }

  /**
   * Create a mesh with a degenerate triangle (zero UV area)
   */
  function createDegenerateMesh(): Mesh {
    const mesh = new Mesh();

    // Good triangle
    mesh.addVertex(new Vertex(new Vec3(0, 0, 0), { uv: [0.1, 0.1] }));
    mesh.addVertex(new Vertex(new Vec3(1, 0, 0), { uv: [0.5, 0.1] }));
    mesh.addVertex(new Vertex(new Vec3(0.5, 1, 0), { uv: [0.3, 0.5] }));
    mesh.addFace(new Face([0, 1, 2]));

    // Degenerate triangle - all vertices on same line in UV space
    mesh.addVertex(new Vertex(new Vec3(2, 0, 0), { uv: [0.6, 0.6] }));
    mesh.addVertex(new Vertex(new Vec3(3, 0, 0), { uv: [0.8, 0.6] }));  // Same V
    mesh.addVertex(new Vertex(new Vec3(2.5, 1, 0), { uv: [0.7, 0.6] })); // Same V - degenerate!
    mesh.addFace(new Face([3, 4, 5]));

    return mesh;
  }

  describe('generateUVDebugTexture', () => {
    it('should generate a debug texture with correct dimensions', () => {
      const mesh = createQuadMesh();
      const result = generateUVDebugTexture(mesh, 64);

      expect(result.buffer.length).toBe(64 * 64 * 4); // RGBA
      expect(result.triangleCount).toBe(2); // Quad is triangulated to 2 triangles
    });

    it('should count triangles correctly for box mesh', () => {
      const mesh = createBoxMeshWithUVs();
      const result = generateUVDebugTexture(mesh, 64);

      expect(result.triangleCount).toBe(12); // 6 faces * 2 triangles per face
    });

    it('should detect degenerate triangles', () => {
      const mesh = createDegenerateMesh();
      const result = generateUVDebugTexture(mesh, 64);

      expect(result.triangleCount).toBe(2); // 2 triangles total
      expect(result.stats.degenerateCount).toBe(1); // 1 degenerate
    });

    it('should calculate total area', () => {
      const mesh = createQuadMesh();
      const result = generateUVDebugTexture(mesh, 64);

      // UVs span from 0.1 to 0.9 = 0.8 in each dimension
      // Expected area = 0.8 * 0.8 = 0.64
      expect(result.stats.totalArea).toBeGreaterThan(0.6);
      expect(result.stats.totalArea).toBeLessThan(0.7);
    });

    it('should fill pixels within UV triangles', () => {
      const mesh = createQuadMesh();
      const result = generateUVDebugTexture(mesh, 64);

      // Count non-background pixels (background is dark gray: 32, 32, 32)
      let filledPixels = 0;
      for (let i = 0; i < 64 * 64; i++) {
        const r = result.buffer[i * 4];
        const g = result.buffer[i * 4 + 1];
        const b = result.buffer[i * 4 + 2];
        // Check if not dark gray background
        if (r !== 32 || g !== 32 || b !== 32) {
          filledPixels++;
        }
      }

      // Should have significant filled area (at least 50% of the 0.64 UV coverage)
      expect(filledPixels).toBeGreaterThan(64 * 64 * 0.3);
    });

    it('should have corner markers at UV space corners', () => {
      const mesh = createQuadMesh();
      const result = generateUVDebugTexture(mesh, 64);

      // Check (0,0) - should be red marker
      const idx00 = 0;
      expect(result.buffer[idx00 * 4]).toBe(255);     // R
      expect(result.buffer[idx00 * 4 + 1]).toBe(0);   // G
      expect(result.buffer[idx00 * 4 + 2]).toBe(0);   // B

      // Check (1,0) - pixel (63, 0) should be green marker
      const idx10 = 63;
      expect(result.buffer[idx10 * 4]).toBe(0);       // R
      expect(result.buffer[idx10 * 4 + 1]).toBe(255); // G
      expect(result.buffer[idx10 * 4 + 2]).toBe(0);   // B
    });
  });

  describe('UV Quality Validation', () => {
    /**
     * Compare UV debug texture coverage with baked texture coverage
     * to verify that the baker samples the same pixels as the UV layout shows
     */
    it('should have matching coverage between UV debug and baked texture', () => {
      const mesh = createBoxMeshWithUVs();
      const resolution = 64;

      // Generate UV debug texture
      const debugResult = generateUVDebugTexture(mesh, resolution);

      // Bake a simple texture
      const bakeResult = bakeTextures(mesh, {
        layers: [{
          generator: 'noise_color',
          params: { scale: 1 },
          blendMode: 'normal',
          opacity: 1.0
        }]
      }, { resolution, channels: ['albedo'] });

      // Count filled pixels in UV debug (non-background)
      let debugFilled = 0;
      for (let i = 0; i < resolution * resolution; i++) {
        const r = debugResult.buffer[i * 4];
        const g = debugResult.buffer[i * 4 + 1];
        const b = debugResult.buffer[i * 4 + 2];
        if (r !== 32 || g !== 32 || b !== 32) {
          debugFilled++;
        }
      }

      // Bake coverage - use pixelsBaked to calculate coverage ratio
      const bakedPixels = bakeResult.stats.pixelsBaked;
      const bakeCoverage = bakedPixels / (resolution * resolution);
      const debugCoverage = debugFilled / (resolution * resolution);

      // Within 20% of each other (accounting for edge differences and dilation)
      expect(Math.abs(debugCoverage - bakeCoverage)).toBeLessThan(0.2);
    });

    it('should flag meshes with many degenerate triangles', () => {
      const mesh = createDegenerateMesh();
      const result = generateUVDebugTexture(mesh, 64);

      // Quality check: more than 10% degenerate triangles is a problem
      const degenerateRatio = result.stats.degenerateCount / result.triangleCount;
      expect(degenerateRatio).toBe(0.5); // 1 of 2 triangles is degenerate

      // This should trigger a warning in a real quality check
      const hasQualityIssue = degenerateRatio > 0.1;
      expect(hasQualityIssue).toBe(true);
    });
  });
});
