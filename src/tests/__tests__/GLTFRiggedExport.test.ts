/**
 * GLTFRiggedExport Tests (E4-001: Skeleton and Skin Export)
 *
 * Tests for exporting rigged models with skeletons, skins, and vertex weights.
 */

import { describe, it, expect } from '@jest/globals';
import { exportRiggedGLB } from '../../export/GLTFExporter';
import { TracedBuilder } from '../../generation/builder/TracedBuilder';
import { Vec3 } from '../../platform/math/Vec3';

/**
 * Create a simple rigged mesh for testing.
 * A vertical strip with 2 joints (root at bottom, tip at top).
 */
function createRiggedTestMesh() {
  const builder = new TracedBuilder('RiggedTest', 42);

  // Define skeleton: root at origin, tip above it
  builder.registerSkeleton([
    { name: 'root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) },
    { name: 'tip', parent: 'root', position: new Vec3(0, 1, 0), orientation: new Vec3(0, 0, 0) }
  ]);

  // Create a simple strip mesh
  builder.placeVertex('v0', { x: '-0.1', y: '0', z: '0' });    // Bottom left
  builder.placeVertex('v1', { x: '0.1', y: '0', z: '0' });     // Bottom right
  builder.placeVertex('v2', { x: '0.1', y: '0.5', z: '0' });   // Middle right
  builder.placeVertex('v3', { x: '-0.1', y: '0.5', z: '0' });  // Middle left
  builder.placeVertex('v4', { x: '0.1', y: '1', z: '0' });     // Top right
  builder.placeVertex('v5', { x: '-0.1', y: '1', z: '0' });    // Top left

  // Bottom quad
  builder.createFace('bottom', ['v0', 'v1', 'v2', 'v3']);
  // Top quad
  builder.createFace('top', ['v3', 'v2', 'v4', 'v5']);

  // Apply gradient weights: root at bottom, tip at top
  builder.computeWeights([
    { type: 'gradient', joint_a: 'root', joint_b: 'tip', axis: 'y' }
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

describe('Rigged glTF Export (E4-001)', () => {
  describe('exportRiggedGLB', () => {
    it('should export a rigged model with skeleton and skin', () => {
      const output = createRiggedTestMesh();
      const result = exportRiggedGLB(output, 'test_rig');

      expect(result.glb).toBeDefined();
      expect(result.glb.byteLength).toBeGreaterThan(0);

      // Parse and verify structure
      const { json } = parseGLB(result.glb);

      // Verify asset info
      expect(json.asset.version).toBe('2.0');
      expect(json.asset.generator).toContain('E4-001');

      // Verify skin exists
      expect(json.skins).toBeDefined();
      expect(json.skins.length).toBe(1);
      expect(json.skins[0].joints).toBeDefined();
      expect(json.skins[0].joints.length).toBe(2); // root + tip
      expect(json.skins[0].inverseBindMatrices).toBeDefined();
    });

    it('should include joint nodes in scene hierarchy', () => {
      const output = createRiggedTestMesh();
      const result = exportRiggedGLB(output, 'test_rig');
      const { json } = parseGLB(result.glb);

      // Verify nodes include joints
      expect(json.nodes.length).toBeGreaterThanOrEqual(3); // mesh + 2 joints

      // Find joint nodes by name
      const rootNode = json.nodes.find((n: any) => n.name === 'root');
      const tipNode = json.nodes.find((n: any) => n.name === 'tip');
      expect(rootNode).toBeDefined();
      expect(tipNode).toBeDefined();

      // Tip should have translation (child of root)
      expect(tipNode.translation).toBeDefined();
      expect(tipNode.translation[1]).toBeCloseTo(1); // y = 1
    });

    it('should include JOINTS_0 and WEIGHTS_0 attributes', () => {
      const output = createRiggedTestMesh();
      const result = exportRiggedGLB(output, 'test_rig');
      const { json } = parseGLB(result.glb);

      // Verify mesh primitive has skinning attributes
      expect(json.meshes).toBeDefined();
      expect(json.meshes[0].primitives).toBeDefined();
      const primitive = json.meshes[0].primitives[0];

      expect(primitive.attributes.JOINTS_0).toBeDefined();
      expect(primitive.attributes.WEIGHTS_0).toBeDefined();

      // Verify accessor types
      const jointsAccessor = json.accessors[primitive.attributes.JOINTS_0];
      expect(jointsAccessor.type).toBe('VEC4');
      expect(jointsAccessor.componentType).toBe(5121); // UNSIGNED_BYTE

      const weightsAccessor = json.accessors[primitive.attributes.WEIGHTS_0];
      expect(weightsAccessor.type).toBe('VEC4');
      expect(weightsAccessor.componentType).toBe(5126); // FLOAT
    });

    it('should include inverse bind matrices accessor', () => {
      const output = createRiggedTestMesh();
      const result = exportRiggedGLB(output, 'test_rig');
      const { json } = parseGLB(result.glb);

      const ibmAccessorIdx = json.skins[0].inverseBindMatrices;
      const ibmAccessor = json.accessors[ibmAccessorIdx];

      expect(ibmAccessor.type).toBe('MAT4');
      expect(ibmAccessor.componentType).toBe(5126); // FLOAT
      expect(ibmAccessor.count).toBe(2); // 2 joints
    });

    it('should report correct statistics', () => {
      const output = createRiggedTestMesh();
      const result = exportRiggedGLB(output, 'test_rig');

      expect(result.stats.jointCount).toBe(2);
      expect(result.stats.vertexCount).toBeGreaterThan(0);
      expect(result.stats.skinnedVertexCount).toBeGreaterThan(0);
      expect(result.stats.triangleCount).toBeGreaterThan(0);
    });

    it('should throw error if no skeleton', () => {
      const builder = new TracedBuilder('NoSkeleton', 42);
      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
      builder.placeVertex('v2', { x: '0', y: '1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      const output = builder.build();
      expect(() => exportRiggedGLB(output)).toThrow('no skeleton defined');
    });

    it('should throw error if no weights', () => {
      const builder = new TracedBuilder('NoWeights', 42);

      builder.registerSkeleton([
        { name: 'root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) }
      ]);

      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
      builder.placeVertex('v2', { x: '0', y: '1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      const output = builder.build();
      expect(() => exportRiggedGLB(output)).toThrow('no vertex weights defined');
    });

    it('should preserve joint constraints as extras', () => {
      const builder = new TracedBuilder('Constrained', 42);

      builder.registerSkeleton([
        { name: 'root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) },
        {
          name: 'hinge_joint',
          parent: 'root',
          position: new Vec3(0, 1, 0),
          orientation: new Vec3(0, 0, 0),
          constraints: {
            type: 'hinge',
            axis: 'x',
            limits: { min: -45, max: 45 }
          }
        }
      ]);

      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
      builder.placeVertex('v2', { x: '0', y: '1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      builder.computeWeights([
        { type: 'proximity', joint: 'root', radius: 2, falloff: 'linear' }
      ]);

      const output = builder.build();
      const result = exportRiggedGLB(output);
      const { json } = parseGLB(result.glb);

      // Find the hinge_joint node
      const hingeNode = json.nodes.find((n: any) => n.name === 'hinge_joint');
      expect(hingeNode).toBeDefined();
      expect(hingeNode.extras).toBeDefined();
      expect(hingeNode.extras.jointConstraints).toBeDefined();
      expect(hingeNode.extras.jointConstraints.type).toBe('hinge');
      expect(hingeNode.extras.jointConstraints.axis).toBe('x');
    });
  });
});
