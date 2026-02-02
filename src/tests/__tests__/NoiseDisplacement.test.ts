/**
 * NoiseDisplacement.test.ts - Tests for C5-001: Noise Displacement
 *
 * Tests the displaceByNoise function in MeshOperations and
 * the displace: YAML command.
 */

import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { Mesh } from '../../platform/geometry/Mesh';
import { parseAndExecuteBuilder } from '../../generation/builder/YamlBuilderParser';

// Use loose typing for tests
type TestYamlDefinition = {
  name: string;
  version: string;
  decisions?: Record<string, any>;
  measurements?: Record<string, any>;
  materials?: Record<string, any>;
  geometry?: any[];
};

describe('NoiseDisplacement', () => {
  describe('MeshOperations.displaceByNoise', () => {
    /**
     * Create a simple test mesh - a unit cube centered at origin
     */
    function createTestCube(): Mesh {
      const mesh = MeshOperations.createBox(1, 1, 1);
      mesh.calculateNormals();
      return mesh;
    }

    /**
     * Create a sphere for more detailed displacement testing
     */
    function createTestSphere(): Mesh {
      const mesh = MeshOperations.createSphere(1, 16, 8);
      mesh.calculateNormals();
      return mesh;
    }

    it('should return a new mesh without modifying original', () => {
      const original = createTestCube();
      const originalVertexCount = original.vertices.length;
      const originalPositions = original.vertices.map(v => v.position.clone());

      const displaced = MeshOperations.displaceByNoise(original, 0.1, 1.0, 42);

      // Original unchanged
      expect(original.vertices.length).toBe(originalVertexCount);
      for (let i = 0; i < originalPositions.length; i++) {
        expect(original.vertices[i].position.x).toBeCloseTo(originalPositions[i].x);
        expect(original.vertices[i].position.y).toBeCloseTo(originalPositions[i].y);
        expect(original.vertices[i].position.z).toBeCloseTo(originalPositions[i].z);
      }

      // Displaced is a different mesh
      expect(displaced).not.toBe(original);
      expect(displaced.vertices.length).toBe(originalVertexCount);
    });

    it('should displace vertices with non-zero amplitude', () => {
      const original = createTestSphere();
      const displaced = MeshOperations.displaceByNoise(original, 0.1, 2.0, 42);

      // At least some vertices should have moved
      let movedCount = 0;
      for (let i = 0; i < original.vertices.length; i++) {
        const origPos = original.vertices[i].position;
        const dispPos = displaced.vertices[i].position;
        const dist = origPos.sub(dispPos).length();
        if (dist > 0.001) {
          movedCount++;
        }
      }

      // Most vertices should have moved (noise won't be exactly 0 everywhere)
      expect(movedCount).toBeGreaterThan(original.vertices.length * 0.5);
    });

    it('should produce zero displacement with zero amplitude', () => {
      const original = createTestCube();
      const displaced = MeshOperations.displaceByNoise(original, 0, 1.0, 42);

      // All vertices should be in same position
      for (let i = 0; i < original.vertices.length; i++) {
        expect(displaced.vertices[i].position.x).toBeCloseTo(original.vertices[i].position.x);
        expect(displaced.vertices[i].position.y).toBeCloseTo(original.vertices[i].position.y);
        expect(displaced.vertices[i].position.z).toBeCloseTo(original.vertices[i].position.z);
      }
    });

    it('should be deterministic with same seed', () => {
      const mesh = createTestSphere();

      const displaced1 = MeshOperations.displaceByNoise(mesh, 0.1, 2.0, 42);
      const displaced2 = MeshOperations.displaceByNoise(mesh, 0.1, 2.0, 42);

      // Same seed should produce identical results
      for (let i = 0; i < displaced1.vertices.length; i++) {
        expect(displaced1.vertices[i].position.x).toBeCloseTo(displaced2.vertices[i].position.x);
        expect(displaced1.vertices[i].position.y).toBeCloseTo(displaced2.vertices[i].position.y);
        expect(displaced1.vertices[i].position.z).toBeCloseTo(displaced2.vertices[i].position.z);
      }
    });

    it('should produce different results with different seeds', () => {
      const mesh = createTestSphere();

      const displaced1 = MeshOperations.displaceByNoise(mesh, 0.1, 2.0, 42);
      const displaced2 = MeshOperations.displaceByNoise(mesh, 0.1, 2.0, 999);

      // Different seeds should produce different results
      let differenceCount = 0;
      for (let i = 0; i < displaced1.vertices.length; i++) {
        const diff = displaced1.vertices[i].position.sub(displaced2.vertices[i].position).length();
        if (diff > 0.001) {
          differenceCount++;
        }
      }

      expect(differenceCount).toBeGreaterThan(0);
    });

    it('should respect amplitude bounds', () => {
      const mesh = createTestSphere();
      const amplitude = 0.05;

      const displaced = MeshOperations.displaceByNoise(mesh, amplitude, 2.0, 42);

      // Original sphere has radius 1, so all vertices are at distance 1 from origin
      // After displacement, vertices should be within [1 - amplitude, 1 + amplitude]
      for (const vertex of displaced.vertices) {
        const dist = vertex.position.length();
        expect(dist).toBeGreaterThanOrEqual(1 - amplitude - 0.001);
        expect(dist).toBeLessThanOrEqual(1 + amplitude + 0.001);
      }
    });

    it('should recalculate normals after displacement', () => {
      const mesh = createTestSphere();
      const displaced = MeshOperations.displaceByNoise(mesh, 0.1, 2.0, 42);

      // All vertices should have normals
      for (const vertex of displaced.vertices) {
        expect(vertex.attributes.normal).toBeDefined();
        // Normals should be normalized (length ~1)
        const normalLength = vertex.attributes.normal!.length();
        expect(normalLength).toBeCloseTo(1.0, 2);
      }
    });

    it('should work with higher frequency for more detail', () => {
      const mesh = createTestSphere();

      // Low frequency - smoother variation
      const lowFreq = MeshOperations.displaceByNoise(mesh, 0.1, 0.5, 42);
      // High frequency - more variation
      const highFreq = MeshOperations.displaceByNoise(mesh, 0.1, 5.0, 42);

      // Both should have displaced vertices, but patterns differ
      // We can verify they're different from each other
      let differenceCount = 0;
      for (let i = 0; i < lowFreq.vertices.length; i++) {
        const diff = lowFreq.vertices[i].position.sub(highFreq.vertices[i].position).length();
        if (diff > 0.001) {
          differenceCount++;
        }
      }

      expect(differenceCount).toBeGreaterThan(0);
    });
  });

  describe('YAML displace command', () => {
    it('should apply displacement via YAML geometry command', async () => {
      const yaml: TestYamlDefinition = {
        name: 'DisplacementTest',
        version: '1.0',
        decisions: {},
        measurements: {
          size: { value: 1.0 }
        },
        materials: {},
        geometry: [
          // Create a box
          {
            box: {
              name: 'base',
              center: { x: 0, y: 0.5, z: 0 },
              size: { x: 'size', y: 'size', z: 'size' }
            }
          },
          // Apply noise displacement
          { displace: 'surface_noise', amplitude: 0.05, frequency: 3.0 }
        ]
      };

      const result = await parseAndExecuteBuilder(yaml as any, { seed: 42 });

      // Should have geometry
      expect(result.mesh.vertices.length).toBeGreaterThan(0);
      expect(result.mesh.faces.length).toBeGreaterThan(0);

      // Check trace for displacement
      const displaceTrace = result.traces.get('displace:surface_noise');
      expect(displaceTrace).toBeDefined();
      expect(displaceTrace?.details.amplitude).toBe(0.05);
      expect(displaceTrace?.details.frequency).toBe(3.0);
    });

    it('should support expression-based amplitude', async () => {
      const yaml: TestYamlDefinition = {
        name: 'ExpressionDisplaceTest',
        version: '1.0',
        decisions: {},
        measurements: {
          base_amplitude: { value: 0.1 }
        },
        materials: {},
        geometry: [
          {
            box: {
              name: 'base',
              center: { x: 0, y: 0.5, z: 0 },
              size: { x: 1, y: 1, z: 1 }
            }
          },
          { displace: 'subtle_noise', amplitude: 'base_amplitude * 0.5', frequency: 2.0 }
        ]
      };

      const result = await parseAndExecuteBuilder(yaml as any, { seed: 42 });

      // Check that expression was evaluated
      const displaceTrace = result.traces.get('displace:subtle_noise');
      expect(displaceTrace).toBeDefined();
      expect(displaceTrace?.details.amplitude).toBeCloseTo(0.05);
    });

    it('should use builder seed when command seed not specified', async () => {
      const yaml: TestYamlDefinition = {
        name: 'SeedTest',
        version: '1.0',
        decisions: {},
        measurements: {},
        materials: {},
        geometry: [
          {
            box: {
              name: 'base',
              center: { x: 0, y: 0.5, z: 0 },
              size: { x: 1, y: 1, z: 1 }
            }
          },
          { displace: 'noise', amplitude: 0.05, frequency: 2.0 }
        ]
      };

      const result1 = await parseAndExecuteBuilder(yaml as any, { seed: 42 });
      const result2 = await parseAndExecuteBuilder(yaml as any, { seed: 42 });
      const result3 = await parseAndExecuteBuilder(yaml as any, { seed: 999 });

      // Same seed should produce same geometry
      expect(result1.mesh.vertices.length).toBe(result2.mesh.vertices.length);
      for (let i = 0; i < result1.mesh.vertices.length; i++) {
        expect(result1.mesh.vertices[i].position.x).toBeCloseTo(result2.mesh.vertices[i].position.x);
      }

      // Verify that the correct seed was passed to the displace command
      const trace1 = result1.traces.get('displace:noise');
      const trace3 = result3.traces.get('displace:noise');
      expect(trace1?.details.seed).toBe(42);
      expect(trace3?.details.seed).toBe(999);

      // Different seeds should produce different noise patterns
      // The displacement is deterministic per seed, so we check that the traces recorded different seeds
      expect(trace1?.details.seed).not.toBe(trace3?.details.seed);
    });
  });
});
