/**
 * GLTFMorphExport Tests (E4-002: Morph Target Export)
 *
 * Tests for exporting models with morph targets (blend shapes).
 */

import { describe, it, expect } from '@jest/globals';
import { exportMorphGLB } from '../../export/GLTFExporter';
import { TracedBuilder } from '../../generation/builder/TracedBuilder';
import { Vec3 } from '../../platform/math/Vec3';

/**
 * Create a simple mesh with morph targets for testing.
 */
function createMorphTestMesh() {
  const builder = new TracedBuilder('MorphTest', 42);

  // Create a simple triangle mesh
  builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
  builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
  builder.placeVertex('v2', { x: '0.5', y: '1', z: '0' });
  builder.createFace('f0', ['v0', 'v1', 'v2']);

  // Register morph targets
  builder.registerMorphTargets([
    {
      name: 'stretch_x',
      offsets: [
        { vertexIndex: 0, offset: new Vec3(-0.5, 0, 0) },
        { vertexIndex: 1, offset: new Vec3(0.5, 0, 0) }
      ],
      defaultWeight: 0,
      description: 'Horizontal stretch'
    },
    {
      name: 'stretch_y',
      offsets: [
        { vertexIndex: 2, offset: new Vec3(0, 0.5, 0) }
      ],
      defaultWeight: 0.5,
      description: 'Vertical stretch'
    }
  ]);

  return builder.build();
}

/**
 * Parse GLB to extract JSON and binary chunks.
 */
function parseGLB(glb: Uint8Array): { json: any; bin: Uint8Array } {
  const view = new DataView(glb.buffer);

  // Verify magic
  const magic = view.getUint32(0, true);
  expect(magic).toBe(0x46546C67); // "glTF"

  // Verify version
  const version = view.getUint32(4, true);
  expect(version).toBe(2);

  // Parse JSON chunk
  const jsonChunkLength = view.getUint32(12, true);
  const jsonChunkType = view.getUint32(16, true);
  expect(jsonChunkType).toBe(0x4E4F534A); // "JSON"

  const jsonBytes = glb.slice(20, 20 + jsonChunkLength);
  const decoder = new TextDecoder();
  const json = JSON.parse(decoder.decode(jsonBytes));

  // Parse BIN chunk
  const binOffset = 20 + jsonChunkLength;
  const binChunkLength = view.getUint32(binOffset, true);
  const binChunkType = view.getUint32(binOffset + 4, true);
  expect(binChunkType).toBe(0x004E4942); // "BIN\0"

  const bin = glb.slice(binOffset + 8, binOffset + 8 + binChunkLength);

  return { json, bin };
}

describe('Morph Target glTF Export (E4-002)', () => {
  describe('exportMorphGLB', () => {
    it('should export a model with morph targets', () => {
      const output = createMorphTestMesh();
      const result = exportMorphGLB(output, 'test_morph');

      expect(result.glb).toBeDefined();
      expect(result.glb.byteLength).toBeGreaterThan(0);

      // Parse and verify structure
      const { json } = parseGLB(result.glb);

      // Verify asset info
      expect(json.asset.version).toBe('2.0');
      expect(json.asset.generator).toContain('E4-002');
    });

    it('should include targets array in mesh primitive', () => {
      const output = createMorphTestMesh();
      const result = exportMorphGLB(output, 'test_morph');
      const { json } = parseGLB(result.glb);

      // Verify mesh has targets
      expect(json.meshes).toBeDefined();
      expect(json.meshes[0].primitives).toBeDefined();
      const primitive = json.meshes[0].primitives[0];

      expect(primitive.targets).toBeDefined();
      expect(primitive.targets.length).toBe(2); // stretch_x and stretch_y

      // Each target should have POSITION accessor
      for (const target of primitive.targets) {
        expect(target.POSITION).toBeDefined();
        const accessor = json.accessors[target.POSITION];
        expect(accessor.type).toBe('VEC3');
        expect(accessor.componentType).toBe(5126); // FLOAT
      }
    });

    it('should include default weights in mesh.weights array', () => {
      const output = createMorphTestMesh();
      const result = exportMorphGLB(output, 'test_morph');
      const { json } = parseGLB(result.glb);

      expect(json.meshes[0].weights).toBeDefined();
      expect(json.meshes[0].weights.length).toBe(2);
      expect(json.meshes[0].weights[0]).toBe(0);     // stretch_x default
      expect(json.meshes[0].weights[1]).toBe(0.5);   // stretch_y default
    });

    it('should store target names in mesh.extras.targetNames', () => {
      const output = createMorphTestMesh();
      const result = exportMorphGLB(output, 'test_morph');
      const { json } = parseGLB(result.glb);

      expect(json.meshes[0].extras).toBeDefined();
      expect(json.meshes[0].extras.targetNames).toBeDefined();
      expect(json.meshes[0].extras.targetNames).toContain('stretch_x');
      expect(json.meshes[0].extras.targetNames).toContain('stretch_y');
    });

    it('should have correct accessor min/max for morph deltas', () => {
      const output = createMorphTestMesh();
      const result = exportMorphGLB(output, 'test_morph');
      const { json } = parseGLB(result.glb);

      const primitive = json.meshes[0].primitives[0];
      const stretchXAccessor = json.accessors[primitive.targets[0].POSITION];

      // stretch_x has offsets: v0=(-0.5,0,0), v1=(0.5,0,0)
      expect(stretchXAccessor.min[0]).toBeCloseTo(-0.5);
      expect(stretchXAccessor.max[0]).toBeCloseTo(0.5);
    });

    it('should report correct statistics', () => {
      const output = createMorphTestMesh();
      const result = exportMorphGLB(output, 'test_morph');

      expect(result.stats.morphTargetCount).toBe(2);
      expect(result.stats.vertexCount).toBe(3);
      expect(result.stats.triangleCount).toBe(1);
    });

    it('should throw error if no morph targets', () => {
      const builder = new TracedBuilder('NoMorph', 42);
      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
      builder.placeVertex('v2', { x: '0', y: '1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      const output = builder.build();
      expect(() => exportMorphGLB(output)).toThrow('no morph targets defined');
    });

    it('should handle single morph target', () => {
      const builder = new TracedBuilder('SingleMorph', 42);
      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
      builder.placeVertex('v2', { x: '0', y: '1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      builder.registerMorphTargets([
        {
          name: 'single',
          offsets: [{ vertexIndex: 0, offset: new Vec3(1, 0, 0) }],
          defaultWeight: 1.0
        }
      ]);

      const output = builder.build();
      const result = exportMorphGLB(output);
      const { json } = parseGLB(result.glb);

      expect(json.meshes[0].primitives[0].targets.length).toBe(1);
      expect(json.meshes[0].weights.length).toBe(1);
      expect(json.meshes[0].weights[0]).toBe(1.0);
    });

    it('should handle morph target with zero default weight', () => {
      const builder = new TracedBuilder('ZeroWeight', 42);
      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
      builder.placeVertex('v2', { x: '0', y: '1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      builder.registerMorphTargets([
        {
          name: 'zero_weight',
          offsets: [{ vertexIndex: 0, offset: new Vec3(1, 0, 0) }],
          defaultWeight: 0
        }
      ]);

      const output = builder.build();
      const result = exportMorphGLB(output);
      const { json } = parseGLB(result.glb);

      expect(json.meshes[0].weights[0]).toBe(0);
    });
  });
});
