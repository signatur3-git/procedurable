/**
 * MorphTarget Tests (E3-001: Morph Target System)
 *
 * Tests for morph target creation, application, and blending.
 */

import {
  MorphTarget,
  MorphTargetSet,
  applyMorphTargets,
  createMorphTarget,
  createMorphTargetFromOffsets,
  interpolateMorphTargetSets
} from '../../platform/geometry/MorphTarget';
import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { Mesh } from '../../platform/geometry/Mesh';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { Vec3 } from '../../platform/math/Vec3';

/**
 * Helper to create a simple test cube mesh
 */
function createCubeMesh(): Mesh {
  const vertices = [
    new Vertex(new Vec3(-0.5, -0.5, -0.5)), // 0
    new Vertex(new Vec3(0.5, -0.5, -0.5)),  // 1
    new Vertex(new Vec3(0.5, 0.5, -0.5)),   // 2
    new Vertex(new Vec3(-0.5, 0.5, -0.5)),  // 3
    new Vertex(new Vec3(-0.5, -0.5, 0.5)),  // 4
    new Vertex(new Vec3(0.5, -0.5, 0.5)),   // 5
    new Vertex(new Vec3(0.5, 0.5, 0.5)),    // 6
    new Vertex(new Vec3(-0.5, 0.5, 0.5)),   // 7
  ];

  const faces = [
    new Face([0, 1, 2, 3]), // front
    new Face([4, 7, 6, 5]), // back
    new Face([0, 4, 5, 1]), // bottom
    new Face([2, 6, 7, 3]), // top
    new Face([0, 3, 7, 4]), // left
    new Face([1, 5, 6, 2]), // right
  ];

  return new Mesh(vertices, faces);
}

/**
 * Create a stretched variant of the cube (2x width)
 */
function createStretchedCube(): Mesh {
  const vertices = [
    new Vertex(new Vec3(-1, -0.5, -0.5)),  // 0 - stretched X
    new Vertex(new Vec3(1, -0.5, -0.5)),   // 1 - stretched X
    new Vertex(new Vec3(1, 0.5, -0.5)),    // 2 - stretched X
    new Vertex(new Vec3(-1, 0.5, -0.5)),   // 3 - stretched X
    new Vertex(new Vec3(-1, -0.5, 0.5)),   // 4 - stretched X
    new Vertex(new Vec3(1, -0.5, 0.5)),    // 5 - stretched X
    new Vertex(new Vec3(1, 0.5, 0.5)),     // 6 - stretched X
    new Vertex(new Vec3(-1, 0.5, 0.5)),    // 7 - stretched X
  ];

  const faces = [
    new Face([0, 1, 2, 3]),
    new Face([4, 7, 6, 5]),
    new Face([0, 4, 5, 1]),
    new Face([2, 6, 7, 3]),
    new Face([0, 3, 7, 4]),
    new Face([1, 5, 6, 2]),
  ];

  return new Mesh(vertices, faces);
}

describe('MorphTarget (E3-001)', () => {
  describe('MorphTarget class', () => {
    it('should create a morph target with valid offsets', () => {
      const target = new MorphTarget('test', [
        { vertexIndex: 0, offset: new Vec3(1, 0, 0) },
        { vertexIndex: 1, offset: new Vec3(0, 1, 0) }
      ], 10);

      expect(target.name).toBe('test');
      expect(target.offsetCount).toBe(2);
      expect(target.baseVertexCount).toBe(10);
    });

    it('should throw for out-of-bounds vertex index', () => {
      expect(() => new MorphTarget('test', [
        { vertexIndex: 10, offset: new Vec3(1, 0, 0) }
      ], 10)).toThrow('vertex index 10 out of bounds');
    });

    it('should return zero offset for unaffected vertices', () => {
      const target = new MorphTarget('test', [
        { vertexIndex: 0, offset: new Vec3(1, 0, 0) }
      ], 10);

      const offset0 = target.getOffset(0);
      const offset5 = target.getOffset(5);

      expect(offset0.x).toBe(1);
      expect(offset5.x).toBe(0);
      expect(offset5.y).toBe(0);
      expect(offset5.z).toBe(0);
    });

    it('should clone correctly', () => {
      const target = new MorphTarget('test', [
        { vertexIndex: 0, offset: new Vec3(1, 0, 0) }
      ], 10);

      const clone = target.clone();
      expect(clone.name).toBe('test');
      expect(clone.offsetCount).toBe(1);

      // Modify original should not affect clone
      target.offsets[0].offset.x = 99;
      expect(clone.offsets[0].offset.x).toBe(1);
    });

    it('should scale offsets correctly', () => {
      const target = new MorphTarget('test', [
        { vertexIndex: 0, offset: new Vec3(2, 4, 6) }
      ], 10);

      const scaled = target.scaled(0.5);
      expect(scaled.offsets[0].offset.x).toBe(1);
      expect(scaled.offsets[0].offset.y).toBe(2);
      expect(scaled.offsets[0].offset.z).toBe(3);
    });
  });

  describe('MorphTargetSet', () => {
    it('should create from mesh', () => {
      const mesh = createCubeMesh();
      const set = MorphTargetSet.fromMesh(mesh);
      expect(set.vertexCount).toBe(8);
      expect(set.size).toBe(0);
    });

    it('should add and retrieve targets', () => {
      const set = new MorphTargetSet(8);
      const target = new MorphTarget('stretch', [
        { vertexIndex: 0, offset: new Vec3(1, 0, 0) }
      ], 8);

      set.addTarget(target);

      expect(set.hasTarget('stretch')).toBe(true);
      expect(set.hasTarget('nonexistent')).toBe(false);
      expect(set.size).toBe(1);
      expect(set.getTarget('stretch')).toBe(target);
    });

    it('should reject targets with wrong vertex count', () => {
      const set = new MorphTargetSet(8);
      const target = new MorphTarget('bad', [], 10); // Wrong count

      expect(() => set.addTarget(target)).toThrow("doesn't match base mesh");
    });

    it('should reject duplicate target names', () => {
      const set = new MorphTargetSet(8);
      const t1 = new MorphTarget('stretch', [], 8);
      const t2 = new MorphTarget('stretch', [], 8);

      set.addTarget(t1);
      expect(() => set.addTarget(t2)).toThrow('already exists');
    });

    it('should list all target names', () => {
      const set = new MorphTargetSet(8);
      set.addTarget(new MorphTarget('a', [], 8));
      set.addTarget(new MorphTarget('b', [], 8));
      set.addTarget(new MorphTarget('c', [], 8));

      const names = set.getTargetNames();
      expect(names).toContain('a');
      expect(names).toContain('b');
      expect(names).toContain('c');
    });

    it('should remove targets', () => {
      const set = new MorphTargetSet(8);
      set.addTarget(new MorphTarget('stretch', [], 8));

      expect(set.removeTarget('stretch')).toBe(true);
      expect(set.hasTarget('stretch')).toBe(false);
      expect(set.removeTarget('stretch')).toBe(false);
    });
  });

  describe('createMorphTarget (from meshes)', () => {
    it('should compute delta between base and variant meshes', () => {
      const base = createCubeMesh();
      const variant = createStretchedCube();

      const target = createMorphTarget(base, variant, 'stretch');

      expect(target.name).toBe('stretch');
      expect(target.baseVertexCount).toBe(8);
      // All 8 vertices should have X offset (stretched from 0.5 to 1.0)
      expect(target.offsetCount).toBe(8);

      // Check a specific vertex offset (vertex 0: -0.5 -> -1.0, delta = -0.5)
      const offset0 = target.getOffset(0);
      expect(offset0.x).toBeCloseTo(-0.5);
      expect(offset0.y).toBeCloseTo(0);
      expect(offset0.z).toBeCloseTo(0);

      // Vertex 1: 0.5 -> 1.0, delta = 0.5
      const offset1 = target.getOffset(1);
      expect(offset1.x).toBeCloseTo(0.5);
    });

    it('should throw for vertex count mismatch', () => {
      const base = createCubeMesh();
      const bad = new Mesh([new Vertex(new Vec3(0, 0, 0))], []);

      expect(() => createMorphTarget(base, bad, 'bad')).toThrow('Topology mismatch');
    });

    it('should throw for face count mismatch', () => {
      const base = createCubeMesh();
      const bad = new Mesh(
        base.vertices.map(v => v.clone()),
        [] // No faces
      );

      expect(() => createMorphTarget(base, bad, 'bad')).toThrow('Topology mismatch');
    });

    it('should throw for face connectivity mismatch', () => {
      const base = createCubeMesh();
      const bad = new Mesh(
        base.vertices.map(v => v.clone()),
        base.faces.map(f => new Face([...f.indices].reverse())) // Reversed indices
      );

      expect(() => createMorphTarget(base, bad, 'bad')).toThrow('different vertex indices');
    });

    it('should filter offsets below threshold', () => {
      const base = createCubeMesh();
      const variant = base.clone();

      // Tiny offset
      variant.vertices[0].position = variant.vertices[0].position.add(new Vec3(0.00001, 0, 0));

      const target = createMorphTarget(base, variant, 'tiny', 0.0001);
      expect(target.offsetCount).toBe(0); // Filtered out
    });
  });

  describe('createMorphTargetFromOffsets', () => {
    it('should create target from inline offset data', () => {
      const target = createMorphTargetFromOffsets('test', [
        { vertex: 0, offset: { x: 1, y: 2, z: 3 } },
        { vertex: 5, offset: { x: -1, y: 0, z: 0 } }
      ], 10);

      expect(target.name).toBe('test');
      expect(target.offsetCount).toBe(2);

      const offset0 = target.getOffset(0);
      expect(offset0.x).toBe(1);
      expect(offset0.y).toBe(2);
      expect(offset0.z).toBe(3);
    });
  });

  describe('applyMorphTargets', () => {
    it('should apply single target at full weight', () => {
      const base = createCubeMesh();
      const variant = createStretchedCube();

      const targetSet = MorphTargetSet.fromMesh(base);
      targetSet.addTarget(createMorphTarget(base, variant, 'stretch'));

      const result = applyMorphTargets(base, targetSet, { stretch: 1.0 });

      expect(result.appliedTargets).toHaveLength(1);
      expect(result.appliedTargets[0].name).toBe('stretch');
      expect(result.appliedTargets[0].weight).toBe(1.0);

      // Vertex 0 should be at stretched position (-1, -0.5, -0.5)
      expect(result.mesh.vertices[0].position.x).toBeCloseTo(-1);
      expect(result.mesh.vertices[0].position.y).toBeCloseTo(-0.5);
    });

    it('should apply single target at partial weight', () => {
      const base = createCubeMesh();
      const variant = createStretchedCube();

      const targetSet = MorphTargetSet.fromMesh(base);
      targetSet.addTarget(createMorphTarget(base, variant, 'stretch'));

      const result = applyMorphTargets(base, targetSet, { stretch: 0.5 });

      // Vertex 0: base (-0.5) + 0.5 * delta(-0.5) = -0.75
      expect(result.mesh.vertices[0].position.x).toBeCloseTo(-0.75);
    });

    it('should apply multiple targets additively', () => {
      const base = createCubeMesh();

      const targetSet = MorphTargetSet.fromMesh(base);

      // Stretch X
      targetSet.addTarget(new MorphTarget('stretchX', [
        { vertexIndex: 0, offset: new Vec3(-0.5, 0, 0) },
        { vertexIndex: 1, offset: new Vec3(0.5, 0, 0) }
      ], 8));

      // Stretch Y
      targetSet.addTarget(new MorphTarget('stretchY', [
        { vertexIndex: 0, offset: new Vec3(0, -0.5, 0) },
        { vertexIndex: 3, offset: new Vec3(0, 0.5, 0) }
      ], 8));

      const result = applyMorphTargets(base, targetSet, {
        stretchX: 1.0,
        stretchY: 1.0
      });

      // Vertex 0: base (-0.5, -0.5, -0.5) + X(-0.5, 0, 0) + Y(0, -0.5, 0) = (-1, -1, -0.5)
      expect(result.mesh.vertices[0].position.x).toBeCloseTo(-1);
      expect(result.mesh.vertices[0].position.y).toBeCloseTo(-1);
      expect(result.mesh.vertices[0].position.z).toBeCloseTo(-0.5);

      expect(result.appliedTargets).toHaveLength(2);
    });

    it('should skip negligible weights', () => {
      const base = createCubeMesh();
      const targetSet = MorphTargetSet.fromMesh(base);
      targetSet.addTarget(new MorphTarget('test', [
        { vertexIndex: 0, offset: new Vec3(1, 0, 0) }
      ], 8));

      const result = applyMorphTargets(base, targetSet, { test: 0.00001 });

      // Weight below minWeight, should not be applied
      expect(result.appliedTargets).toHaveLength(0);
      expect(result.mesh.vertices[0].position.x).toBeCloseTo(-0.5); // Unchanged
    });

    it('should clamp weights when option is set', () => {
      const base = createCubeMesh();
      const targetSet = MorphTargetSet.fromMesh(base);
      targetSet.addTarget(new MorphTarget('test', [
        { vertexIndex: 0, offset: new Vec3(1, 0, 0) }
      ], 8));

      // Weight > 1 without clamping (extrapolation)
      const resultNoCl = applyMorphTargets(base, targetSet, { test: 2.0 });
      expect(resultNoCl.mesh.vertices[0].position.x).toBeCloseTo(1.5); // -0.5 + 2*1

      // Weight > 1 with clamping
      const resultCl = applyMorphTargets(base, targetSet, { test: 2.0 }, { clampWeights: true });
      expect(resultCl.mesh.vertices[0].position.x).toBeCloseTo(0.5); // -0.5 + 1*1
    });

    it('should throw for unknown target name', () => {
      const base = createCubeMesh();
      const targetSet = MorphTargetSet.fromMesh(base);

      expect(() => applyMorphTargets(base, targetSet, { nonexistent: 1.0 }))
        .toThrow('"nonexistent" not found');
    });

    it('should throw for vertex count mismatch', () => {
      const base = createCubeMesh();
      const wrongSet = new MorphTargetSet(100);

      expect(() => applyMorphTargets(base, wrongSet, {}))
        .toThrow("doesn't match target set");
    });

    it('should not modify the original mesh', () => {
      const base = createCubeMesh();
      const originalX = base.vertices[0].position.x;

      const targetSet = MorphTargetSet.fromMesh(base);
      targetSet.addTarget(new MorphTarget('test', [
        { vertexIndex: 0, offset: new Vec3(1, 0, 0) }
      ], 8));

      applyMorphTargets(base, targetSet, { test: 1.0 });

      expect(base.vertices[0].position.x).toBe(originalX);
    });

    it('should work with Map weights', () => {
      const base = createCubeMesh();
      const targetSet = MorphTargetSet.fromMesh(base);
      targetSet.addTarget(new MorphTarget('test', [
        { vertexIndex: 0, offset: new Vec3(1, 0, 0) }
      ], 8));

      const weights = new Map<string, number>([['test', 0.5]]);
      const result = applyMorphTargets(base, targetSet, weights);

      expect(result.mesh.vertices[0].position.x).toBeCloseTo(0); // -0.5 + 0.5*1
    });
  });

  describe('interpolateMorphTargetSets', () => {
    it('should interpolate between two sets', () => {
      const setA = new MorphTargetSet(8);
      const setB = new MorphTargetSet(8);

      setA.addTarget(new MorphTarget('shared', [
        { vertexIndex: 0, offset: new Vec3(1, 0, 0) }
      ], 8));

      setB.addTarget(new MorphTarget('shared', [
        { vertexIndex: 0, offset: new Vec3(0, 1, 0) }
      ], 8));

      const interpolated = interpolateMorphTargetSets(setA, setB, 0.5);

      const target = interpolated.getTarget('shared');
      expect(target).toBeDefined();
      const offset = target!.getOffset(0);
      expect(offset.x).toBeCloseTo(0.5);
      expect(offset.y).toBeCloseTo(0.5);
    });

    it('should handle targets only in first set', () => {
      const setA = new MorphTargetSet(8);
      const setB = new MorphTargetSet(8);

      setA.addTarget(new MorphTarget('onlyA', [
        { vertexIndex: 0, offset: new Vec3(1, 0, 0) }
      ], 8));

      const interpolated = interpolateMorphTargetSets(setA, setB, 0.75);

      const target = interpolated.getTarget('onlyA');
      expect(target).toBeDefined();
      // Scaled by (1 - t) = 0.25
      expect(target!.getOffset(0).x).toBeCloseTo(0.25);
    });

    it('should handle targets only in second set', () => {
      const setA = new MorphTargetSet(8);
      const setB = new MorphTargetSet(8);

      setB.addTarget(new MorphTarget('onlyB', [
        { vertexIndex: 0, offset: new Vec3(1, 0, 0) }
      ], 8));

      const interpolated = interpolateMorphTargetSets(setA, setB, 0.75);

      const target = interpolated.getTarget('onlyB');
      expect(target).toBeDefined();
      // Scaled by t = 0.75
      expect(target!.getOffset(0).x).toBeCloseTo(0.75);
    });

    it('should throw for mismatched vertex counts', () => {
      const setA = new MorphTargetSet(8);
      const setB = new MorphTargetSet(10);

      expect(() => interpolateMorphTargetSets(setA, setB, 0.5))
        .toThrow('different vertex counts');
    });
  });

  describe('MeshOperations morph methods', () => {
    it('should provide applyMorphTargets as static method', () => {
      const base = createCubeMesh();
      const targetSet = MorphTargetSet.fromMesh(base);
      targetSet.addTarget(new MorphTarget('test', [
        { vertexIndex: 0, offset: new Vec3(1, 0, 0) }
      ], 8));

      const result = MeshOperations.applyMorphTargets(base, targetSet, { test: 1.0 });
      expect(result.mesh.vertices[0].position.x).toBeCloseTo(0.5);
    });

    it('should provide createMorphTarget as static method', () => {
      const base = createCubeMesh();
      const variant = createStretchedCube();

      const target = MeshOperations.createMorphTarget(base, variant, 'stretch');
      expect(target.name).toBe('stretch');
      expect(target.offsetCount).toBeGreaterThan(0);
    });

    it('should provide createMorphTargetFromOffsets as static method', () => {
      const target = MeshOperations.createMorphTargetFromOffsets('test', [
        { vertex: 0, offset: { x: 1, y: 0, z: 0 } }
      ], 10);

      expect(target.name).toBe('test');
      expect(target.getOffset(0).x).toBe(1);
    });
  });

  describe('TracedBuilder morph target methods', () => {
    it('should register morph targets', () => {
      const { TracedBuilder } = require('../../generation/builder/TracedBuilder');
      const builder = new TracedBuilder('TestBuilder', 42);

      // Add some vertices
      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
      builder.placeVertex('v2', { x: '0', y: '1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      builder.registerMorphTargets([
        {
          name: 'stretch',
          offsets: [
            { vertexIndex: 0, offset: new Vec3(0.5, 0, 0) }
          ],
          defaultWeight: 0,
          description: 'Stretch effect'
        }
      ]);

      const targets = builder.getMorphTargets();
      expect(targets).not.toBeNull();
      expect(targets!.baseVertexCount).toBe(3);
      expect(targets!.targets).toHaveLength(1);
      expect(targets!.targets[0].name).toBe('stretch');
    });

    it('should get morph target by name', () => {
      const { TracedBuilder } = require('../../generation/builder/TracedBuilder');
      const builder = new TracedBuilder('TestBuilder', 42);

      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
      builder.placeVertex('v2', { x: '0', y: '1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      builder.registerMorphTargets([
        { name: 'a', offsets: [] },
        { name: 'b', offsets: [] }
      ]);

      expect(builder.getMorphTarget('a')).toBeDefined();
      expect(builder.getMorphTarget('b')).toBeDefined();
      expect(builder.getMorphTarget('c')).toBeUndefined();
    });

    it('should get morph target names', () => {
      const { TracedBuilder } = require('../../generation/builder/TracedBuilder');
      const builder = new TracedBuilder('TestBuilder', 42);

      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
      builder.placeVertex('v2', { x: '0', y: '1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      builder.registerMorphTargets([
        { name: 'smile', offsets: [] },
        { name: 'frown', offsets: [] }
      ]);

      const names = builder.getMorphTargetNames();
      expect(names).toContain('smile');
      expect(names).toContain('frown');
    });

    it('should throw for duplicate morph target names', () => {
      const { TracedBuilder } = require('../../generation/builder/TracedBuilder');
      const builder = new TracedBuilder('TestBuilder', 42);

      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
      builder.placeVertex('v2', { x: '0', y: '1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      expect(() => builder.registerMorphTargets([
        { name: 'dup', offsets: [] },
        { name: 'dup', offsets: [] }
      ])).toThrow("Duplicate morph target name: 'dup'");
    });

    it('should throw for out-of-bounds vertex index', () => {
      const { TracedBuilder } = require('../../generation/builder/TracedBuilder');
      const builder = new TracedBuilder('TestBuilder', 42);

      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
      builder.placeVertex('v2', { x: '0', y: '1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      expect(() => builder.registerMorphTargets([
        { name: 'bad', offsets: [{ vertexIndex: 100, offset: new Vec3(0, 0, 0) }] }
      ])).toThrow('out of bounds');
    });

    it('should include morph targets in build output', () => {
      const { TracedBuilder } = require('../../generation/builder/TracedBuilder');
      const builder = new TracedBuilder('TestBuilder', 42);

      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
      builder.placeVertex('v2', { x: '0', y: '1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      builder.registerMorphTargets([
        { name: 'test', offsets: [{ vertexIndex: 0, offset: new Vec3(1, 0, 0) }] }
      ]);

      const output = builder.build();
      expect(output.morphTargets).toBeDefined();
      expect(output.morphTargets!.targets).toHaveLength(1);
    });

    it('should add morph target from variant mesh', () => {
      const { TracedBuilder } = require('../../generation/builder/TracedBuilder');
      const builder = new TracedBuilder('TestBuilder', 42);

      // Build a simple mesh
      builder.placeVertex('v0', { x: '0', y: '0', z: '0' });
      builder.placeVertex('v1', { x: '1', y: '0', z: '0' });
      builder.placeVertex('v2', { x: '0', y: '1', z: '0' });
      builder.createFace('f0', ['v0', 'v1', 'v2']);

      // Create a variant with shifted vertex
      const variant = builder.mesh.clone();
      variant.vertices[0].position = new Vec3(0.5, 0, 0);

      builder.addMorphTargetFromMesh('shift', variant, 0, 'Shift v0');

      const target = builder.getMorphTarget('shift');
      expect(target).toBeDefined();
      expect(target!.offsets).toHaveLength(1);
      expect(target!.offsets[0].offset.x).toBeCloseTo(0.5);
    });
  });
});
