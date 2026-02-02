/**
 * PSD (Procedurable Scene Description) v0.1 Tests
 *
 * Validates type interfaces, path conventions, validation helpers,
 * and parent-child consistency.
 *
 * B2-001
 */

import { describe, it, expect } from '@jest/globals';
import {
  PSDScene,
  PSDMeshPrim,
  PSDInstancePrim,
  PSDXformPrim,
  PSDMaterial,
  PSD_IDENTITY_TRANSFORM,
  PSD_EMPTY_BOX,
  isValidPSDPath,
  getParentPath,
  getPrimName,
  validatePSDScene,
  createEmptyPSDScene,
  serializeToPSD,
  deserializePSD,
  extractMaterials
} from '../../generation/builder/PSD';
import { parseAndExecuteBuilder, YamlBuilderDefinition } from '../../generation/builder/YamlBuilderParser';

// ============================================================================
// Test Helpers
// ============================================================================

function makeXform(path: string, parent: string | null, children: string[], tags: string[] = []): PSDXformPrim {
  return {
    path,
    type: 'Xform',
    parent,
    transform: { ...PSD_IDENTITY_TRANSFORM },
    tags,
    bounds: { ...PSD_EMPTY_BOX },
    children
  };
}

function makeMesh(path: string, parent: string, tags: string[] = []): PSDMeshPrim {
  return {
    path,
    type: 'Mesh',
    parent,
    transform: { ...PSD_IDENTITY_TRANSFORM },
    tags,
    bounds: { min: [-1, 0, -1], max: [1, 1, 1] },
    children: [],
    geometry: {
      vertices: [-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1],
      normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      indices: [0, 1, 2, 0, 2, 3]
    },
    materialSlots: [0, 0],
    skeleton: null,
    jointWeights: []
  };
}

function makeInstance(path: string, parent: string, prototype: string, tags: string[] = []): PSDInstancePrim {
  return {
    path,
    type: 'Instance',
    parent,
    transform: { ...PSD_IDENTITY_TRANSFORM },
    tags,
    bounds: { ...PSD_EMPTY_BOX },
    children: [],
    prototype,
    seed: 42
  };
}

function makeValidScene(): PSDScene {
  const mat: PSDMaterial = { name: 'wood', color: [0.6, 0.4, 0.2], roughness: 0.7, metalness: 0.0 };
  return {
    version: '0.1',
    name: 'TestScene',
    generator: 'TestScene seed=42',
    materials: [mat],
    prims: {
      '/TestScene': makeXform('/TestScene', null, ['/TestScene/table', '/TestScene/chair'], ['scene']),
      '/TestScene/table': makeMesh('/TestScene/table', '/TestScene', ['furniture', 'table']),
      '/TestScene/chair': makeInstance('/TestScene/chair', '/TestScene', '/TestScene/table', ['furniture', 'chair'])
    }
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('PSD v0.1', () => {
  describe('path helpers', () => {
    it('isValidPSDPath should validate paths', () => {
      expect(isValidPSDPath('/Root')).toBe(true);
      expect(isValidPSDPath('/Root/child')).toBe(true);
      expect(isValidPSDPath('/Root/child/grandchild')).toBe(true);

      expect(isValidPSDPath('')).toBe(false);
      expect(isValidPSDPath('/')).toBe(false);       // just slash, no name
      expect(isValidPSDPath('Root')).toBe(false);     // no leading slash
      expect(isValidPSDPath('/Root/')).toBe(false);   // trailing slash
    });

    it('getParentPath should extract parent', () => {
      expect(getParentPath('/Root/table/leg')).toBe('/Root/table');
      expect(getParentPath('/Root/table')).toBe('/Root');
      expect(getParentPath('/Root')).toBe(null);
    });

    it('getPrimName should extract last segment', () => {
      expect(getPrimName('/Root/table/leg')).toBe('leg');
      expect(getPrimName('/Root/table')).toBe('table');
      expect(getPrimName('/Root')).toBe('Root');
    });
  });

  describe('createEmptyPSDScene', () => {
    it('should create a valid empty scene', () => {
      const scene = createEmptyPSDScene('MyScene', 'MyBuilder seed=1');
      expect(scene.version).toBe('0.1');
      expect(scene.name).toBe('MyScene');
      expect(scene.generator).toBe('MyBuilder seed=1');
      expect(Object.keys(scene.prims)).toHaveLength(0);
      expect(scene.materials).toHaveLength(0);
    });
  });

  describe('validatePSDScene', () => {
    it('should pass for a valid scene', () => {
      const scene = makeValidScene();
      const errors = validatePSDScene(scene);
      expect(errors).toHaveLength(0);
    });

    it('should detect path-key mismatch', () => {
      const scene = makeValidScene();
      // Manually mismatch path and key
      const prim = scene.prims['/TestScene/table'] as PSDMeshPrim;
      prim.path = '/TestScene/wrong';
      const errors = validatePSDScene(scene);
      expect(errors.some(e => e.includes('does not match'))).toBe(true);
    });

    it('should detect invalid paths', () => {
      const scene = createEmptyPSDScene('Test', 'test');
      scene.materials = [{ name: 'mat', color: [1, 1, 1], roughness: 0.5, metalness: 0 }];
      // Add prim with invalid path key
      (scene.prims as any)['bad_path'] = makeXform('bad_path', null, []);
      const errors = validatePSDScene(scene);
      expect(errors.some(e => e.includes('Invalid prim path'))).toBe(true);
    });

    it('should detect non-existent parent', () => {
      const scene = createEmptyPSDScene('Test', 'test');
      scene.materials = [{ name: 'mat', color: [1, 1, 1], roughness: 0.5, metalness: 0 }];
      scene.prims['/Root'] = makeXform('/Root', null, ['/Root/child']);
      scene.prims['/Root/child'] = makeMesh('/Root/child', '/Root/missing_parent');
      const errors = validatePSDScene(scene);
      expect(errors.some(e => e.includes('non-existent parent'))).toBe(true);
    });

    it('should detect non-existent children', () => {
      const scene = createEmptyPSDScene('Test', 'test');
      scene.materials = [{ name: 'mat', color: [1, 1, 1], roughness: 0.5, metalness: 0 }];
      scene.prims['/Root'] = makeXform('/Root', null, ['/Root/ghost']);
      const errors = validatePSDScene(scene);
      expect(errors.some(e => e.includes('non-existent child'))).toBe(true);
    });

    it('should detect parent-child inconsistency', () => {
      const scene = createEmptyPSDScene('Test', 'test');
      scene.materials = [{ name: 'mat', color: [1, 1, 1], roughness: 0.5, metalness: 0 }];
      scene.prims['/Root'] = makeXform('/Root', null, ['/Root/child']);
      // child claims different parent
      scene.prims['/Root/child'] = makeMesh('/Root/child', '/Root/other');
      scene.prims['/Root/other'] = makeXform('/Root/other', '/Root', []);
      // Fix Root to have both children so parent exists
      (scene.prims['/Root'] as PSDXformPrim).children = ['/Root/child', '/Root/other'];
      const errors = validatePSDScene(scene);
      expect(errors.some(e => e.includes("parent is '/Root/other', expected '/Root'"))).toBe(true);
    });

    it('should detect material index out of bounds', () => {
      const scene = createEmptyPSDScene('Test', 'test');
      scene.materials = [{ name: 'mat', color: [1, 1, 1], roughness: 0.5, metalness: 0 }];
      const mesh = makeMesh('/Root', null as any);
      mesh.materialSlots = [0, 5]; // index 5 out of bounds (only 1 material)
      scene.prims['/Root'] = mesh;
      const errors = validatePSDScene(scene);
      expect(errors.some(e => e.includes('out of bounds'))).toBe(true);
    });

    it('should detect non-existent instance prototype', () => {
      const scene = createEmptyPSDScene('Test', 'test');
      scene.materials = [{ name: 'mat', color: [1, 1, 1], roughness: 0.5, metalness: 0 }];
      scene.prims['/Root'] = makeXform('/Root', null, ['/Root/inst']);
      scene.prims['/Root/inst'] = makeInstance('/Root/inst', '/Root', '/Root/missing_proto');
      const errors = validatePSDScene(scene);
      expect(errors.some(e => e.includes('non-existent prototype'))).toBe(true);
    });

    it('should verify skeleton stub is null on mesh prims', () => {
      const scene = makeValidScene();
      // All mesh prims should have skeleton: null
      for (const prim of Object.values(scene.prims)) {
        if (prim.type === 'Mesh') {
          expect((prim as PSDMeshPrim).skeleton).toBeNull();
          expect((prim as PSDMeshPrim).jointWeights).toEqual([]);
        }
      }
    });
  });

  describe('type structure', () => {
    it('PSDMeshPrim should have required geometry fields', () => {
      const mesh = makeMesh('/Root', null as any);
      expect(mesh.geometry.vertices).toBeDefined();
      expect(mesh.geometry.normals).toBeDefined();
      expect(mesh.geometry.indices).toBeDefined();
      expect(mesh.materialSlots).toBeDefined();
      expect(mesh.skeleton).toBeNull();
      expect(mesh.jointWeights).toEqual([]);
    });

    it('PSDInstancePrim should have prototype reference', () => {
      const inst = makeInstance('/Root/inst', '/Root', '/Root/proto');
      expect(inst.prototype).toBe('/Root/proto');
      expect(inst.seed).toBe(42);
    });

    it('PSD_IDENTITY_TRANSFORM should be identity', () => {
      expect(PSD_IDENTITY_TRANSFORM.position).toEqual([0, 0, 0]);
      expect(PSD_IDENTITY_TRANSFORM.rotation).toEqual([0, 0, 0]);
      expect(PSD_IDENTITY_TRANSFORM.scale).toEqual([1, 1, 1]);
    });

    it('geometry arrays should have consistent lengths', () => {
      const mesh = makeMesh('/Root', null as any);
      const g = mesh.geometry;
      // vertices and normals should have same length (3 components per vertex)
      expect(g.vertices.length).toBe(g.normals.length);
      // vertex count should be divisible by 3
      expect(g.vertices.length % 3).toBe(0);
      // index count should be divisible by 3 (triangles)
      expect(g.indices.length % 3).toBe(0);
    });
  });

  describe('serializeToPSD', () => {
    it('should serialize a simple builder output', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'TestBox',
        shapes: {
          base: { type: 'rect', width: 2, height: 2 }
        },
        geometry: [
          { extrude2d: 'box', shape: 'base', depth: 1, color: { r: 0.8, g: 0.2, b: 0.1 } }
        ]
      };

      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });
      const scene = serializeToPSD(output);

      expect(scene.version).toBe('0.1');
      expect(scene.name).toBe('TestBox');
      expect(scene.generator).toBe('TestBox seed=42');

      // Should have root Xform + mesh = 2 prims
      expect(Object.keys(scene.prims)).toHaveLength(2);
      expect(scene.prims['/TestBox']).toBeDefined();
      expect(scene.prims['/TestBox'].type).toBe('Xform');
      expect(scene.prims['/TestBox/mesh']).toBeDefined();
      expect(scene.prims['/TestBox/mesh'].type).toBe('Mesh');

      // Mesh should have geometry
      const meshPrim = scene.prims['/TestBox/mesh'] as PSDMeshPrim;
      expect(meshPrim.geometry.vertices.length).toBeGreaterThan(0);
      expect(meshPrim.geometry.normals.length).toBe(meshPrim.geometry.vertices.length);
      expect(meshPrim.geometry.indices.length).toBeGreaterThan(0);

      // Phase 3 stubs
      expect(meshPrim.skeleton).toBeNull();
      expect(meshPrim.jointWeights).toEqual([]);

      // Should have at least one material
      expect(scene.materials.length).toBeGreaterThan(0);

      // Validation should pass
      const errors = validatePSDScene(scene);
      expect(errors).toHaveLength(0);
    });

    it('should extract unique materials from face colors', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'TwoColors',
        materials: {
          red: { color: { r: 1, g: 0, b: 0 } },
          blue: { color: { r: 0, g: 0, b: 1 } }
        },
        shapes: {
          s1: { type: 'rect', width: 1, height: 1 },
          s2: { type: 'rect', width: 1, height: 1, center: { x: 2, z: 0 } }
        },
        geometry: [
          { extrude2d: 'part1', shape: 's1', depth: 0.5, color: '$red' },
          { extrude2d: 'part2', shape: 's2', depth: 0.5, color: '$blue' }
        ]
      };

      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });
      const { materials } = extractMaterials(output.mesh);

      // Should have exactly 2 unique materials
      expect(materials.length).toBe(2);
      // One red, one blue
      const hasRed = materials.some(m => m.color[0] === 1 && m.color[1] === 0 && m.color[2] === 0);
      const hasBlue = materials.some(m => m.color[0] === 0 && m.color[1] === 0 && m.color[2] === 1);
      expect(hasRed).toBe(true);
      expect(hasBlue).toBe(true);
    });

    it('should preserve bounds from builder output', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'BoundsTest',
        shapes: {
          base: { type: 'rect', width: 4, height: 6 }
        },
        geometry: [
          { extrude2d: 'plate', shape: 'base', depth: 0.5 }
        ]
      };

      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });
      const scene = serializeToPSD(output);

      const root = scene.prims['/BoundsTest'] as PSDXformPrim;
      // Bounds should be non-zero
      expect(root.bounds.max[0] - root.bounds.min[0]).toBeGreaterThan(0);
    });

    it('should include metadata', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'MetaTest',
        shapes: { s: { type: 'rect', width: 1, height: 1 } },
        geometry: [{ extrude2d: 'mesh', shape: 's', depth: 0.1 }]
      };

      const output = await parseAndExecuteBuilder(yaml, { seed: 99 });
      const scene = serializeToPSD(output);

      expect(scene.metadata).toBeDefined();
      expect(scene.metadata!.seed).toBe(99);
      expect(scene.metadata!.vertexCount).toBeGreaterThan(0);
      expect(scene.metadata!.faceCount).toBeGreaterThan(0);
    });
  });

  describe('round-trip (serialize → deserialize)', () => {
    it('should preserve geometry through round-trip', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'RoundTrip',
        shapes: { base: { type: 'rect', width: 2, height: 2 } },
        geometry: [{ extrude2d: 'box', shape: 'base', depth: 1, color: { r: 0.5, g: 0.5, b: 0.5 } }]
      };

      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });
      const scene = serializeToPSD(output);
      const deserialized = deserializePSD(scene);

      // Vertex count should match (triangulated, unrolled)
      expect(deserialized.vertices.length).toBeGreaterThan(0);
      expect(deserialized.normals.length).toBe(deserialized.vertices.length);
      expect(deserialized.triangleCount).toBeGreaterThan(0);

      // Materials preserved
      expect(deserialized.materials.length).toBeGreaterThan(0);

      // Colors reconstructed from materials
      expect(deserialized.colors.length).toBe(deserialized.vertices.length);

      // Name preserved
      expect(deserialized.name).toBe('RoundTrip');
    });

    it('should preserve triangle count through round-trip', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'TriCount',
        shapes: { base: { type: 'circle', radius: 1, segments: 16 } },
        geometry: [{ extrude2d: 'cylinder', shape: 'base', depth: 2 }]
      };

      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });
      const scene = serializeToPSD(output);
      const meshPrim = scene.prims['/TriCount/mesh'] as PSDMeshPrim;

      const deserialized = deserializePSD(scene);

      // Triangle count from PSD should match deserialized
      expect(deserialized.triangleCount).toBe(meshPrim.geometry.indices.length / 3);
    });
  });
});
