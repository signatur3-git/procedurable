/**
 * Tests for TerrainChunk - Chunk-aligned terrain (G1-002)
 */

import {
  generateTerrainChunk,
  generateTerrainRegion,
  verifyChunkBoundary
} from '../../platform/scene/TerrainChunk';
import { field } from '../../platform/spatial/ScalarField';

describe('TerrainChunk (G1-002)', () => {
  // Create a deterministic height function for testing
  const seed = 12345;
  const terrain = field.remap(
    field.fbm(seed, 0.1, 1.0, 4, 0.5),
    -1, 1,
    0, 10  // 0-10m elevation for easier testing
  );

  const heightFunction = (x: number, z: number): number => {
    return terrain.sample(x, 0, z);
  };

  describe('generateTerrainChunk', () => {
    it('should generate a chunk with correct bounds', () => {
      const chunk = generateTerrainChunk(0, 0, {
        chunkSize: 64,
        segments: 16,
        heightFunction
      });

      expect(chunk.chunkX).toBe(0);
      expect(chunk.chunkZ).toBe(0);
      expect(chunk.size).toBe(64);
      expect(chunk.segments).toBe(16);
      expect(chunk.bounds.minX).toBe(0);
      expect(chunk.bounds.maxX).toBe(64);
      expect(chunk.bounds.minZ).toBe(0);
      expect(chunk.bounds.maxZ).toBe(64);
    });

    it('should generate a chunk at non-origin position', () => {
      const chunk = generateTerrainChunk(2, 3, {
        chunkSize: 64,
        segments: 16,
        heightFunction
      });

      expect(chunk.chunkX).toBe(2);
      expect(chunk.chunkZ).toBe(3);
      expect(chunk.bounds.minX).toBe(128);  // 2 * 64
      expect(chunk.bounds.maxX).toBe(192);  // 3 * 64
      expect(chunk.bounds.minZ).toBe(192);  // 3 * 64
      expect(chunk.bounds.maxZ).toBe(256);  // 4 * 64
    });

    it('should generate correct number of vertices and faces', () => {
      const segments = 16;
      const chunk = generateTerrainChunk(0, 0, {
        chunkSize: 64,
        segments,
        heightFunction
      });

      // Vertices: (segments+1) x (segments+1) = 17 x 17 = 289
      const expectedVertices = (segments + 1) * (segments + 1);
      expect(chunk.mesh.vertices.length).toBe(expectedVertices);

      // Faces: 2 triangles per grid cell = 2 * segments * segments
      const expectedFaces = 2 * segments * segments;
      expect(chunk.mesh.faces.length).toBe(expectedFaces);
    });

    it('should use world-space coordinates for height function', () => {
      // Create a chunk at position (1, 0)
      const chunk = generateTerrainChunk(1, 0, {
        chunkSize: 64,
        segments: 8,
        heightFunction
      });

      // The chunk should span x=64 to x=128
      // Verify boundary vertices are at expected world positions
      const leftBoundary = chunk.mesh.vertices.filter(
        v => Math.abs(v.position.x - 64) < 0.001
      );
      const rightBoundary = chunk.mesh.vertices.filter(
        v => Math.abs(v.position.x - 128) < 0.001
      );

      // Should have segments+1 vertices on each boundary
      expect(leftBoundary.length).toBe(9);  // 8 + 1
      expect(rightBoundary.length).toBe(9);

      // Verify heights match the height function at those world positions
      for (const v of leftBoundary) {
        const expectedY = heightFunction(v.position.x, v.position.z);
        expect(v.position.y).toBeCloseTo(expectedY, 6);
      }
    });

    it('should generate UVs in 0-1 range', () => {
      const chunk = generateTerrainChunk(0, 0, {
        chunkSize: 64,
        segments: 8,
        heightFunction
      });

      for (const v of chunk.mesh.vertices) {
        const uv = v.attributes.uv;
        expect(uv).toBeDefined();
        expect(uv![0]).toBeGreaterThanOrEqual(0);
        expect(uv![0]).toBeLessThanOrEqual(1);
        expect(uv![1]).toBeGreaterThanOrEqual(0);
        expect(uv![1]).toBeLessThanOrEqual(1);
      }
    });

    it('should generate smooth normals', () => {
      const chunk = generateTerrainChunk(0, 0, {
        chunkSize: 64,
        segments: 8,
        heightFunction
      });

      for (const v of chunk.mesh.vertices) {
        const normal = v.attributes.normal;
        expect(normal).toBeDefined();
        // Should be approximately unit length
        const len = Math.sqrt(normal!.x ** 2 + normal!.y ** 2 + normal!.z ** 2);
        expect(len).toBeCloseTo(1.0, 4);
        // For mostly flat terrain, Y component should be positive
        expect(normal!.y).toBeGreaterThan(0);
      }
    });

    it('should support negative chunk coordinates', () => {
      const chunk = generateTerrainChunk(-1, -2, {
        chunkSize: 64,
        segments: 8,
        heightFunction
      });

      expect(chunk.chunkX).toBe(-1);
      expect(chunk.chunkZ).toBe(-2);
      expect(chunk.bounds.minX).toBe(-64);
      expect(chunk.bounds.maxX).toBe(0);
      expect(chunk.bounds.minZ).toBe(-128);
      expect(chunk.bounds.maxZ).toBe(-64);
    });
  });

  describe('boundary vertex sharing', () => {
    it('should share boundary vertices between X-adjacent chunks', () => {
      const chunk0 = generateTerrainChunk(0, 0, {
        chunkSize: 64,
        segments: 8,
        heightFunction
      });

      const chunk1 = generateTerrainChunk(1, 0, {
        chunkSize: 64,
        segments: 8,
        heightFunction
      });

      const result = verifyChunkBoundary(chunk0, chunk1);
      expect(result.matches).toBe(true);
      expect(result.mismatchCount).toBe(0);
    });

    it('should share boundary vertices between Z-adjacent chunks', () => {
      const chunk0 = generateTerrainChunk(0, 0, {
        chunkSize: 64,
        segments: 8,
        heightFunction
      });

      const chunk1 = generateTerrainChunk(0, 1, {
        chunkSize: 64,
        segments: 8,
        heightFunction
      });

      const result = verifyChunkBoundary(chunk0, chunk1);
      expect(result.matches).toBe(true);
      expect(result.mismatchCount).toBe(0);
    });

    it('should reject non-adjacent chunks in verification', () => {
      const chunk0 = generateTerrainChunk(0, 0, {
        chunkSize: 64,
        segments: 8,
        heightFunction
      });

      const chunk2 = generateTerrainChunk(2, 0, {  // Gap of 1 chunk
        chunkSize: 64,
        segments: 8,
        heightFunction
      });

      const result = verifyChunkBoundary(chunk0, chunk2);
      expect(result.matches).toBe(false);
      expect(result.details).toContain('not adjacent');
    });

    it('should reject diagonal chunks in verification', () => {
      const chunk0 = generateTerrainChunk(0, 0, {
        chunkSize: 64,
        segments: 8,
        heightFunction
      });

      const chunkDiag = generateTerrainChunk(1, 1, {
        chunkSize: 64,
        segments: 8,
        heightFunction
      });

      const result = verifyChunkBoundary(chunk0, chunkDiag);
      expect(result.matches).toBe(false);
      expect(result.details).toContain('not adjacent');
    });

    it('should verify boundary in both directions', () => {
      const chunkA = generateTerrainChunk(5, 3, {
        chunkSize: 32,
        segments: 4,
        heightFunction
      });

      const chunkB = generateTerrainChunk(4, 3, {  // Left of A
        chunkSize: 32,
        segments: 4,
        heightFunction
      });

      // Check A->B
      const resultAB = verifyChunkBoundary(chunkA, chunkB);
      expect(resultAB.matches).toBe(true);

      // Check B->A
      const resultBA = verifyChunkBoundary(chunkB, chunkA);
      expect(resultBA.matches).toBe(true);
    });
  });

  describe('generateTerrainRegion', () => {
    it('should generate a 2x2 region', () => {
      const chunks = generateTerrainRegion(0, 0, 1, 1, {
        chunkSize: 32,
        segments: 4,
        heightFunction
      });

      expect(chunks.length).toBe(4);  // 2x2 = 4 chunks

      // Verify all chunks are present
      const coords = chunks.map(c => `${c.chunkX},${c.chunkZ}`).sort();
      expect(coords).toEqual(['0,0', '0,1', '1,0', '1,1']);
    });

    it('should generate a single chunk region', () => {
      const chunks = generateTerrainRegion(5, 5, 5, 5, {
        chunkSize: 32,
        segments: 4,
        heightFunction
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0].chunkX).toBe(5);
      expect(chunks[0].chunkZ).toBe(5);
    });

    it('should have seamless boundaries for all chunks in region', () => {
      const chunks = generateTerrainRegion(0, 0, 2, 2, {
        chunkSize: 32,
        segments: 4,
        heightFunction
      });

      expect(chunks.length).toBe(9);  // 3x3 = 9 chunks

      // Verify all adjacent pairs have matching boundaries
      for (let i = 0; i < chunks.length; i++) {
        for (let j = i + 1; j < chunks.length; j++) {
          const c1 = chunks[i];
          const c2 = chunks[j];

          const dx = Math.abs(c2.chunkX - c1.chunkX);
          const dz = Math.abs(c2.chunkZ - c1.chunkZ);

          if (dx + dz === 1) {
            // Adjacent - verify boundary
            const result = verifyChunkBoundary(c1, c2);
            expect(result.matches).toBe(true);
          }
        }
      }
    });

    it('should handle negative coordinates in region', () => {
      const chunks = generateTerrainRegion(-1, -1, 0, 0, {
        chunkSize: 32,
        segments: 4,
        heightFunction
      });

      expect(chunks.length).toBe(4);

      // Verify chunk at (-1, -1) has correct bounds
      const negChunk = chunks.find(c => c.chunkX === -1 && c.chunkZ === -1);
      expect(negChunk).toBeDefined();
      expect(negChunk!.bounds.minX).toBe(-32);
      expect(negChunk!.bounds.maxX).toBe(0);
    });
  });

  describe('determinism', () => {
    it('should produce identical results for same parameters', () => {
      const chunk1 = generateTerrainChunk(0, 0, {
        chunkSize: 32,
        segments: 4,
        heightFunction
      });

      const chunk2 = generateTerrainChunk(0, 0, {
        chunkSize: 32,
        segments: 4,
        heightFunction
      });

      // Compare all vertex positions
      expect(chunk1.mesh.vertices.length).toBe(chunk2.mesh.vertices.length);

      for (let i = 0; i < chunk1.mesh.vertices.length; i++) {
        const v1 = chunk1.mesh.vertices[i].position;
        const v2 = chunk2.mesh.vertices[i].position;

        expect(v1.x).toBeCloseTo(v2.x, 10);
        expect(v1.y).toBeCloseTo(v2.y, 10);
        expect(v1.z).toBeCloseTo(v2.z, 10);
      }
    });

    it('should produce different terrain with different height functions', () => {
      const terrain2 = field.remap(
        field.fbm(99999, 0.1, 1.0, 4, 0.5),
        -1, 1,
        0, 10
      );

      const chunk1 = generateTerrainChunk(0, 0, {
        chunkSize: 32,
        segments: 4,
        heightFunction
      });

      const chunk2 = generateTerrainChunk(0, 0, {
        chunkSize: 32,
        segments: 4,
        heightFunction: (x, z) => terrain2.sample(x, 0, z)
      });

      // At least some vertices should have different heights
      let differences = 0;
      for (let i = 0; i < chunk1.mesh.vertices.length; i++) {
        if (Math.abs(chunk1.mesh.vertices[i].position.y - chunk2.mesh.vertices[i].position.y) > 0.01) {
          differences++;
        }
      }

      expect(differences).toBeGreaterThan(0);
    });
  });
});
