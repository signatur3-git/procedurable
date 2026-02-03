/**
 * Vertex Weights Tests (E2-001: Weight Rules and Assignment)
 *
 * Tests for vertex weight computation, normalization, and serialization.
 */

import { TracedBuilder } from '../../generation/builder/TracedBuilder';
import { Vec3 } from '../../platform/math/Vec3';
import { executeBuilder } from '../../generation/builder/YamlBuilderExecutor';
import { serializeToPSD, PSDMeshPrim } from '../../generation/builder/PSD';
import type { YamlBuilderDefinition } from '../../generation/builder/YamlBuilderTypes';

describe('Vertex Weights (E2-001)', () => {
  describe('TracedBuilder.computeWeights', () => {
    it('should compute proximity weights for vertices near a joint', () => {
      const builder = new TracedBuilder('TestBuilder', 42);

      // Create two joints so we can test non-normalized weights
      builder.registerSkeleton([
        { name: 'root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'other', parent: null, position: new Vec3(10, 0, 0), orientation: new Vec3(0, 0, 0) }
      ]);

      // Add some test vertices around the joint
      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });      // At joint - should be weight 1
      builder.placeVertex('v1', { x: '0.5', y: '0', z: '0' });    // 0.5m away
      builder.placeVertex('v2', { x: '1', y: '0', z: '0' });      // 1m away - at radius edge
      builder.placeVertex('v3', { x: '1.5', y: '0', z: '0' });    // 1.5m away - outside radius

      // Create a face to make it a valid mesh
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      // Compute weights with proximity rule (only root joint, not other)
      builder.computeWeights([
        { type: 'proximity', joint: 'root', radius: 1, falloff: 'linear' }
      ]);

      const weights = builder.getVertexWeights();
      expect(weights).not.toBeNull();
      expect(weights!.stats.weightedVertices).toBeGreaterThan(0);

      // Check individual vertex weights
      // Note: With single influence, weights are normalized to 1.0
      const w0 = builder.getWeightsForVertex(0);
      expect(w0.length).toBe(1);
      expect(w0[0].weight).toBeCloseTo(1);  // At joint (normalized)

      const w1 = builder.getWeightsForVertex(1);
      expect(w1.length).toBe(1);
      expect(w1[0].weight).toBeCloseTo(1);  // Normalized (was 0.5, now 1.0)

      // v2 at radius edge has weight 0, so not included
      const w2 = builder.getWeightsForVertex(2);
      expect(w2.length).toBe(0);  // At edge - weight 0 means no influence

      // v3 outside radius
      const w3 = builder.getWeightsForVertex(3);
      expect(w3.length).toBe(0);  // Outside radius
    });

    it('should compute region weights for vertices in bounding box', () => {
      const builder = new TracedBuilder('TestBuilder', 42);

      builder.registerSkeleton([
        { name: 'root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) }
      ]);

      builder.placeVertex('v0', { x: '0.5', y: '0.5', z: '0.5' });  // Inside box
      builder.placeVertex('v1', { x: '2', y: '2', z: '2' });          // Outside box
      builder.createFace('f0', ['v0', 'v0', 'v1']);  // Degenerate but valid for test

      builder.computeWeights([
        {
          type: 'region',
          joint: 'root',
          min: new Vec3(0, 0, 0),
          max: new Vec3(1, 1, 1),
          weight: 1
        }
      ]);

      const w0 = builder.getWeightsForVertex(0);
      expect(w0.length).toBe(1);
      expect(w0[0].weight).toBe(1);

      const w1 = builder.getWeightsForVertex(1);
      expect(w1.length).toBe(0);  // Outside region
    });

    it('should compute gradient weights between two joints', () => {
      const builder = new TracedBuilder('TestBuilder', 42);

      builder.registerSkeleton([
        { name: 'hip', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'knee', parent: 'hip', position: new Vec3(0, -1, 0), orientation: new Vec3(0, 0, 0) }
      ]);

      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });     // At hip - weight 1 for hip
      builder.placeVertex('v1', { x: '0', y: '-0.5', z: '0' });  // Halfway - 0.5 each
      builder.placeVertex('v2', { x: '0', y: '-1', z: '0' });    // At knee - weight 1 for knee
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      builder.computeWeights([
        { type: 'gradient', joint_a: 'hip', joint_b: 'knee', axis: 'y' }
      ]);

      const w0 = builder.getWeightsForVertex(0);
      expect(w0.find(w => w.jointIndex === 0)?.weight).toBeCloseTo(1);  // Full hip

      const w1 = builder.getWeightsForVertex(1);
      const hipWeight = w1.find(w => w.jointIndex === 0)?.weight ?? 0;
      const kneeWeight = w1.find(w => w.jointIndex === 1)?.weight ?? 0;
      expect(hipWeight).toBeCloseTo(0.5);
      expect(kneeWeight).toBeCloseTo(0.5);

      const w2 = builder.getWeightsForVertex(2);
      expect(w2.find(w => w.jointIndex === 1)?.weight).toBeCloseTo(1);  // Full knee
    });

    it('should normalize weights to sum to 1', () => {
      const builder = new TracedBuilder('TestBuilder', 42);

      builder.registerSkeleton([
        { name: 'a', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'b', parent: null, position: new Vec3(1, 0, 0), orientation: new Vec3(0, 0, 0) }
      ]);

      // Vertex equidistant from both joints
      builder.placeVertex('v0', { x: '0.5', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '0.5', y: '0.1', z: '0' });
      builder.placeVertex('v2', { x: '0.5', y: '-0.1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      builder.computeWeights([
        { type: 'proximity', joint: 'a', radius: 1, falloff: 'linear' },
        { type: 'proximity', joint: 'b', radius: 1, falloff: 'linear' }
      ]);

      const w0 = builder.getWeightsForVertex(0);
      const sum = w0.reduce((s, w) => s + w.weight, 0);
      expect(sum).toBeCloseTo(1);
    });

    it('should limit to MAX_INFLUENCES per vertex', () => {
      const builder = new TracedBuilder('TestBuilder', 42);

      // Create 6 joints all affecting the same vertex
      builder.registerSkeleton([
        { name: 'j0', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'j1', parent: null, position: new Vec3(0.1, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'j2', parent: null, position: new Vec3(0.2, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'j3', parent: null, position: new Vec3(0.3, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'j4', parent: null, position: new Vec3(0.4, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'j5', parent: null, position: new Vec3(0.5, 0, 0), orientation: new Vec3(0, 0, 0) }
      ]);

      builder.placeVertex('v0', { x: '0.25', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '0.25', y: '0.1', z: '0' });
      builder.placeVertex('v2', { x: '0.25', y: '-0.1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      builder.computeWeights([
        { type: 'proximity', joint: 'j0', radius: 1, falloff: 'linear' },
        { type: 'proximity', joint: 'j1', radius: 1, falloff: 'linear' },
        { type: 'proximity', joint: 'j2', radius: 1, falloff: 'linear' },
        { type: 'proximity', joint: 'j3', radius: 1, falloff: 'linear' },
        { type: 'proximity', joint: 'j4', radius: 1, falloff: 'linear' },
        { type: 'proximity', joint: 'j5', radius: 1, falloff: 'linear' }
      ]);

      const w0 = builder.getWeightsForVertex(0);
      expect(w0.length).toBeLessThanOrEqual(TracedBuilder.MAX_INFLUENCES);
    });

    it('should throw when computing weights without skeleton', () => {
      const builder = new TracedBuilder('TestBuilder', 42);
      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });

      expect(() => builder.computeWeights([
        { type: 'proximity', joint: 'root', radius: 1 }
      ])).toThrow(/no skeleton defined/);
    });
  });

  describe('YAML weight rules', () => {
    it('should parse and apply proximity weight rules from YAML', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'WeightTest',
        skeleton: [
          { name: 'root', position: { x: 0, y: 0, z: 0 } }
        ],
        weights: [
          { type: 'proximity', joint: 'root', radius: 1, falloff: 'smooth' }
        ],
        geometry: [
          { box: { name: 'body', center: { x: '0', y: '0', z: '0' }, size: { x: '0.5', y: '0.5', z: '0.5' } } }
        ]
      };

      const output = await executeBuilder(yaml, { seed: 42 });

      expect(output.vertexWeights).toBeDefined();
      expect(output.vertexWeights!.stats.weightedVertices).toBeGreaterThan(0);
    });

    it('should support expressions in weight rule parameters', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'WeightExprTest',
        measurements: {
          influence_radius: { value: 0.5 }
        },
        skeleton: [
          { name: 'root', position: { x: 0, y: 0, z: 0 } }
        ],
        weights: [
          { type: 'proximity', joint: 'root', radius: 'influence_radius * 2', falloff: 'linear' }
        ],
        geometry: [
          { box: { name: 'body', center: { x: '0', y: '0', z: '0' }, size: { x: '1', y: '1', z: '1' } } }
        ]
      };

      const output = await executeBuilder(yaml, { seed: 42 });

      expect(output.vertexWeights).toBeDefined();
      expect(output.vertexWeights!.stats.weightedVertices).toBeGreaterThan(0);
    });
  });

  describe('PSD serialization', () => {
    it('should include joint weights in PSD mesh prim', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'PSDWeightTest',
        skeleton: [
          { name: 'root', position: { x: 0, y: 0, z: 0 } }
        ],
        weights: [
          { type: 'proximity', joint: 'root', radius: 2, falloff: 'linear' }
        ],
        geometry: [
          { box: { name: 'body', center: { x: '0', y: '0', z: '0' }, size: { x: '1', y: '1', z: '1' } } }
        ]
      };

      const output = await executeBuilder(yaml, { seed: 42 });
      const psd = serializeToPSD(output);

      const meshPrim = Object.values(psd.prims).find(p => p.type === 'Mesh') as PSDMeshPrim;
      expect(meshPrim.jointWeights).toBeDefined();
      expect(meshPrim.jointWeights!.length).toBeGreaterThan(0);
      expect(meshPrim.maxInfluences).toBe(4);
      expect(meshPrim.weightStats).toBeDefined();
    });
  });

  describe('falloff functions', () => {
    it('should apply different falloff curves correctly', () => {
      const builder = new TracedBuilder('TestBuilder', 42);

      // Use two joints so weights aren't all normalized to 1
      builder.registerSkeleton([
        { name: 'root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'tip', parent: null, position: new Vec3(1, 0, 0), orientation: new Vec3(0, 0, 0) }
      ]);

      // Create a vertex at 25% of distance from root (closer to root)
      builder.placeVertex('v0', { x: '0.25', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '0.25', y: '0.1', z: '0' });
      builder.placeVertex('v2', { x: '0.25', y: '-0.1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      // Test linear falloff - v0 is 0.25 from root, 0.75 from tip
      // root weight: 1 - 0.25 = 0.75, tip weight: 1 - 0.75 = 0.25
      // after normalization: root = 0.75, tip = 0.25
      builder.computeWeights([
        { type: 'proximity', joint: 'root', radius: 1, falloff: 'linear' },
        { type: 'proximity', joint: 'tip', radius: 1, falloff: 'linear' }
      ]);
      const linearWeights = builder.getWeightsForVertex(0);
      const rootLinear = linearWeights.find(w => w.jointIndex === 0)?.weight ?? 0;
      expect(rootLinear).toBeCloseTo(0.75);

      // Test smooth falloff - should have higher weight at same distance
      builder.computeWeights([
        { type: 'proximity', joint: 'root', radius: 1, falloff: 'smooth' },
        { type: 'proximity', joint: 'tip', radius: 1, falloff: 'smooth' }
      ]);
      const smoothWeights = builder.getWeightsForVertex(0);
      const rootSmooth = smoothWeights.find(w => w.jointIndex === 0)?.weight ?? 0;
      // Smooth preserves the relative ordering but with different curve
      expect(rootSmooth).toBeGreaterThan(0.5);

      // Test sharp falloff
      builder.computeWeights([
        { type: 'proximity', joint: 'root', radius: 1, falloff: 'sharp' },
        { type: 'proximity', joint: 'tip', radius: 1, falloff: 'sharp' }
      ]);
      const sharpWeights = builder.getWeightsForVertex(0);
      const rootSharp = sharpWeights.find(w => w.jointIndex === 0)?.weight ?? 0;
      // Sharp should also favor the closer joint
      expect(rootSharp).toBeGreaterThan(0.5);
    });
  });

  describe('weight visualization data (E2-002)', () => {
    it('should generate heat map data for visualization', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'HeatMapTest',
        skeleton: [
          { name: 'center', position: { x: 0, y: 0, z: 0 } }
        ],
        weights: [
          { type: 'proximity', joint: 'center', radius: 2, falloff: 'linear' }
        ],
        geometry: [
          { box: { name: 'body', center: { x: '0', y: '0', z: '0' }, size: { x: '1', y: '1', z: '1' } } }
        ]
      };

      const output = await executeBuilder(yaml, { seed: 42 });

      // Verify we can access weights for visualization
      expect(output.vertexWeights).toBeDefined();
      const weights = output.vertexWeights!;

      // Build a heat map like the DSL command would
      const vertexCount = output.mesh.vertices.length;
      const heatMap: number[] = new Array(vertexCount).fill(0);

      for (let vi = 0; vi < vertexCount; vi++) {
        const vw = weights.weights.get(vi);
        if (vw && vw.length > 0) {
          // Just take first weight for this test (only one joint)
          heatMap[vi] = vw[0].weight;
        }
      }

      // All vertices should have some weight (box is smaller than radius)
      const weightedCount = heatMap.filter(w => w > 0).length;
      expect(weightedCount).toBeGreaterThan(0);
    });
  });
});
