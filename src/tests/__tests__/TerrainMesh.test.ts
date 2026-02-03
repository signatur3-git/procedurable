/**
 * Terrain Mesh Generation Tests (G1-001)
 *
 * Tests for height field mesh generation and terrain commands
 */

import { describe, it, expect } from '@jest/globals';
import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { executeBuilder } from '../../generation/builder/YamlBuilderExecutor';

describe('Terrain Mesh Generation (G1-001)', () => {
  describe('MeshOperations.createHeightFieldMesh', () => {
    it('should create a flat plane mesh', () => {
      const mesh = MeshOperations.createHeightFieldMesh({
        width: 10,
        depth: 10,
        segmentsX: 2,
        segmentsZ: 2,
        heightFunction: () => 0  // Flat
      });

      // 3x3 grid = 9 vertices
      expect(mesh.vertices.length).toBe(9);
      // 2x2 cells, 2 triangles each = 8 faces
      expect(mesh.faces.length).toBe(8);
    });

    it('should have correct vertex positions', () => {
      const mesh = MeshOperations.createHeightFieldMesh({
        width: 4,
        depth: 4,
        segmentsX: 2,
        segmentsZ: 2,
        heightFunction: () => 0
      });

      // Centered at origin: corners at (-2, 0, -2) to (2, 0, 2)
      const positions = mesh.vertices.map(v => ({
        x: Math.round(v.position.x * 10) / 10,
        y: v.position.y,
        z: Math.round(v.position.z * 10) / 10
      }));

      // Check corners exist
      expect(positions).toContainEqual({ x: -2, y: 0, z: -2 });
      expect(positions).toContainEqual({ x: 2, y: 0, z: -2 });
      expect(positions).toContainEqual({ x: -2, y: 0, z: 2 });
      expect(positions).toContainEqual({ x: 2, y: 0, z: 2 });
    });

    it('should apply height function correctly', () => {
      const mesh = MeshOperations.createHeightFieldMesh({
        width: 10,
        depth: 10,
        segmentsX: 4,
        segmentsZ: 4,
        heightFunction: (x, z) => x + z  // Height increases with x and z
      });

      // Find min and max heights
      const heights = mesh.vertices.map(v => v.position.y);
      const minHeight = Math.min(...heights);
      const maxHeight = Math.max(...heights);

      // At (-5, _, -5), height should be -10; at (5, _, 5), height should be 10
      expect(minHeight).toBeCloseTo(-10, 0);
      expect(maxHeight).toBeCloseTo(10, 0);
    });

    it('should have UV coordinates', () => {
      const mesh = MeshOperations.createHeightFieldMesh({
        width: 10,
        depth: 10,
        segmentsX: 2,
        segmentsZ: 2,
        heightFunction: () => 0
      });

      // All vertices should have UVs
      for (const vertex of mesh.vertices) {
        expect(vertex.attributes.uv).toBeDefined();
        expect(vertex.attributes.uv![0]).toBeGreaterThanOrEqual(0);
        expect(vertex.attributes.uv![0]).toBeLessThanOrEqual(1);
        expect(vertex.attributes.uv![1]).toBeGreaterThanOrEqual(0);
        expect(vertex.attributes.uv![1]).toBeLessThanOrEqual(1);
      }
    });

    it('should compute smooth normals', () => {
      const mesh = MeshOperations.createHeightFieldMesh({
        width: 10,
        depth: 10,
        segmentsX: 2,
        segmentsZ: 2,
        heightFunction: () => 0  // Flat plane
      });

      // All normals should be approximately (0, 1, 0) for flat terrain
      for (const vertex of mesh.vertices) {
        expect(vertex.attributes.normal).toBeDefined();
        expect(vertex.attributes.normal!.x).toBeCloseTo(0, 1);
        expect(vertex.attributes.normal!.y).toBeCloseTo(1, 1);
        expect(vertex.attributes.normal!.z).toBeCloseTo(0, 1);
      }
    });

    it('should flatten building pads', () => {
      const mesh = MeshOperations.createHeightFieldMesh({
        width: 10,
        depth: 10,
        segmentsX: 10,
        segmentsZ: 10,
        heightFunction: (x, z) => Math.sin(x) * Math.cos(z),  // Wavy terrain
        modifications: [
          {
            type: 'flatten',
            center: { x: 0, z: 0 },
            radius: 2,
            elevation: 0.5
          }
        ]
      });

      // Find vertices in the flatten zone
      const flattenedVertices = mesh.vertices.filter(v => {
        const dx = v.position.x;
        const dz = v.position.z;
        return Math.sqrt(dx * dx + dz * dz) <= 2;
      });

      // All flattened vertices should have the same height
      for (const v of flattenedVertices) {
        expect(v.position.y).toBeCloseTo(0.5, 1);
      }
    });

    it('should support falloff on flatten zones', () => {
      const mesh = MeshOperations.createHeightFieldMesh({
        width: 10,
        depth: 10,
        segmentsX: 20,
        segmentsZ: 20,
        heightFunction: () => 0,  // Flat base
        modifications: [
          {
            type: 'flatten',
            center: { x: 0, z: 0 },
            radius: 2,
            elevation: 1.0,
            falloff: 1.0  // Blend over 1 unit
          }
        ]
      });

      // Center should be at elevation 1.0
      const centerVert = mesh.vertices.find(v =>
        Math.abs(v.position.x) < 0.1 && Math.abs(v.position.z) < 0.1
      );
      expect(centerVert?.position.y).toBeCloseTo(1.0, 1);

      // Edge of flatten zone should be blended
      const edgeVert = mesh.vertices.find(v => {
        const dist = Math.sqrt(v.position.x ** 2 + v.position.z ** 2);
        return Math.abs(dist - 1.5) < 0.3;  // In the falloff zone
      });
      // Should be between 0 and 1
      expect(edgeVert?.position.y).toBeGreaterThan(0);
      expect(edgeVert?.position.y).toBeLessThan(1);
    });

    it('should support center offset', () => {
      const mesh = MeshOperations.createHeightFieldMesh({
        width: 4,
        depth: 4,
        segmentsX: 2,
        segmentsZ: 2,
        heightFunction: () => 0,
        center: { x: 10, z: 20 }
      });

      // Check corners are offset
      const positions = mesh.vertices.map(v => ({
        x: v.position.x,
        z: v.position.z
      }));

      // Corners should be at (8, 18), (12, 18), (8, 22), (12, 22)
      expect(positions.some(p => Math.abs(p.x - 8) < 0.1 && Math.abs(p.z - 18) < 0.1)).toBe(true);
      expect(positions.some(p => Math.abs(p.x - 12) < 0.1 && Math.abs(p.z - 22) < 0.1)).toBe(true);
    });
  });

  describe('YAML terrain command', () => {
    it('should generate terrain from YAML', async () => {
      const yaml = {
        version: '1.0',
        name: 'TerrainTest',
        geometry: [
          {
            terrain: {
              name: 'ground',
              width: 10,
              depth: 10,
              segments_x: 4,
              segments_z: 4,
              noise_amplitude: 0,  // Flat
              base_height: 0
            }
          }
        ]
      };

      const result = await executeBuilder(yaml, { seed: 42 });

      // 5x5 grid = 25 vertices, 4x4 cells * 2 triangles = 32 faces
      expect(result.mesh.vertices.length).toBe(25);
      expect(result.mesh.faces.length).toBe(32);
    });

    it('should generate noisy terrain', async () => {
      const yaml = {
        version: '1.0',
        name: 'NoisyTerrain',
        geometry: [
          {
            terrain: {
              name: 'hills',
              width: 10,
              depth: 10,
              segments_x: 8,
              segments_z: 8,
              noise_scale: 0.2,
              noise_amplitude: 2.0,
              base_height: 0,
              octaves: 4,
              seed: 42
            }
          }
        ]
      };

      const result = await executeBuilder(yaml, { seed: 42 });

      // Should have height variation
      const heights = result.mesh.vertices.map(v => v.position.y);
      const minHeight = Math.min(...heights);
      const maxHeight = Math.max(...heights);

      expect(maxHeight - minHeight).toBeGreaterThan(0.5);  // Should have variation
    });

    it('should be deterministic with same seed', async () => {
      const yaml = {
        version: '1.0',
        name: 'DeterministicTerrain',
        geometry: [
          {
            terrain: {
              name: 'ground',
              width: 10,
              depth: 10,
              segments_x: 4,
              segments_z: 4,
              noise_amplitude: 1.0,
              seed: 12345
            }
          }
        ]
      };

      const result1 = await executeBuilder(yaml, { seed: 1 });
      const result2 = await executeBuilder(yaml, { seed: 2 });  // Different builder seed

      // Same terrain seed = same heights
      const heights1 = result1.mesh.vertices.map(v => v.position.y);
      const heights2 = result2.mesh.vertices.map(v => v.position.y);

      for (let i = 0; i < heights1.length; i++) {
        expect(heights1[i]).toBeCloseTo(heights2[i], 5);
      }
    });

    it('should support flatten zones', async () => {
      const yaml = {
        version: '1.0',
        name: 'FlattenedTerrain',
        geometry: [
          {
            terrain: {
              name: 'ground',
              width: 10,
              depth: 10,
              segments_x: 10,
              segments_z: 10,
              noise_amplitude: 2.0,
              flatten: [
                {
                  center: { x: 0, z: 0 },
                  radius: 2,
                  elevation: 0
                }
              ]
            }
          }
        ]
      };

      const result = await executeBuilder(yaml, { seed: 42 });

      // Find vertices in the flatten zone
      const centerVerts = result.mesh.vertices.filter(v => {
        const dist = Math.sqrt(v.position.x ** 2 + v.position.z ** 2);
        return dist < 1.5;  // Well inside the flatten zone
      });

      // All should be at elevation 0
      for (const v of centerVerts) {
        expect(v.position.y).toBeCloseTo(0, 1);
      }
    });
  });
});
