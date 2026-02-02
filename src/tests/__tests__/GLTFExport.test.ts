/**
 * Tests for glTF/GLB export (C6-001)
 */

import { exportGLB, packGLB } from '../../export/GLTFExporter';
import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { Mesh } from '../../platform/geometry/Mesh';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { Vec3 } from '../../platform/math/Vec3';
import { lathe } from '../../platform/geometry/Sweep';

describe('GLTFExport', () => {
  describe('GLB header', () => {
    it('should produce valid GLB magic and version', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = exportGLB(box, 'test-box');
      const view = new DataView(result.glb.buffer, result.glb.byteOffset);

      // Magic: "glTF" = 0x46546C67
      expect(view.getUint32(0, true)).toBe(0x46546C67);
      // Version: 2
      expect(view.getUint32(4, true)).toBe(2);
      // Total length matches buffer
      expect(view.getUint32(8, true)).toBe(result.glb.byteLength);
    });

    it('should have JSON chunk followed by BIN chunk', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = exportGLB(box, 'test-box');
      const view = new DataView(result.glb.buffer, result.glb.byteOffset);

      // JSON chunk type at offset 16
      expect(view.getUint32(16, true)).toBe(0x4E4F534A); // "JSON"

      // Read JSON chunk length to find BIN chunk
      const jsonChunkLength = view.getUint32(12, true);
      const binChunkTypeOffset = 12 + 8 + jsonChunkLength + 4;
      expect(view.getUint32(binChunkTypeOffset, true)).toBe(0x004E4942); // "BIN\0"
    });

    it('should have 4-byte aligned chunks', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = exportGLB(box, 'test-box');
      const view = new DataView(result.glb.buffer, result.glb.byteOffset);

      const jsonChunkLength = view.getUint32(12, true);
      expect(jsonChunkLength % 4).toBe(0);

      const binChunkOffset = 12 + 8 + jsonChunkLength;
      const binChunkLength = view.getUint32(binChunkOffset, true);
      expect(binChunkLength % 4).toBe(0);
    });
  });

  describe('JSON content', () => {
    function extractJSON(glb: Uint8Array): any {
      const view = new DataView(glb.buffer, glb.byteOffset);
      const jsonLength = view.getUint32(12, true);
      const jsonBytes = glb.slice(20, 20 + jsonLength);
      const jsonStr = new TextDecoder().decode(jsonBytes).trim();
      return JSON.parse(jsonStr);
    }

    it('should have correct asset info', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const json = extractJSON(exportGLB(box).glb);

      expect(json.asset.version).toBe('2.0');
      expect(json.asset.generator).toContain('Procedurable');
    });

    it('should have scene, node, and mesh', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const json = extractJSON(exportGLB(box, 'mybox').glb);

      expect(json.scenes).toHaveLength(1);
      expect(json.nodes).toHaveLength(1);
      expect(json.meshes).toHaveLength(1);
      expect(json.scenes[0].nodes).toEqual([0]);
      expect(json.nodes[0].mesh).toBe(0);
      expect(json.meshes[0].name).toBe('mybox');
    });

    it('should include POSITION and NORMAL attributes', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const json = extractJSON(exportGLB(box).glb);

      const prim = json.meshes[0].primitives[0];
      expect(prim.attributes.POSITION).toBeDefined();
      expect(prim.attributes.NORMAL).toBeDefined();
      expect(prim.indices).toBeDefined();
    });

    it('should include TEXCOORD_0 when UVs are present', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const json = extractJSON(exportGLB(box).glb);

      // createBox generates UVs
      const prim = json.meshes[0].primitives[0];
      expect(prim.attributes.TEXCOORD_0).toBeDefined();
    });

    it('should not include TEXCOORD_0 when no UVs', () => {
      // Create mesh without UVs
      const mesh = new Mesh();
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(0, 1, 0)));
      mesh.addFace(new Face([0, 1, 2]));

      const json = extractJSON(exportGLB(mesh).glb);
      const prim = json.meshes[0].primitives[0];
      expect(prim.attributes.TEXCOORD_0).toBeUndefined();
    });

    it('should have position accessor with min/max bounds', () => {
      const box = MeshOperations.createBox(2, 4, 6);
      const json = extractJSON(exportGLB(box).glb);

      const posAccessor = json.accessors[0]; // First accessor is POSITION
      expect(posAccessor.type).toBe('VEC3');
      expect(posAccessor.componentType).toBe(5126); // FLOAT

      // Box centered at origin: bounds should be ±half-size
      expect(posAccessor.min[0]).toBeCloseTo(-1, 4);
      expect(posAccessor.max[0]).toBeCloseTo(1, 4);
      expect(posAccessor.min[1]).toBeCloseTo(-2, 4);
      expect(posAccessor.max[1]).toBeCloseTo(2, 4);
      expect(posAccessor.min[2]).toBeCloseTo(-3, 4);
      expect(posAccessor.max[2]).toBeCloseTo(3, 4);
    });
  });

  describe('materials', () => {
    function extractJSON(glb: Uint8Array): any {
      const view = new DataView(glb.buffer, glb.byteOffset);
      const jsonLength = view.getUint32(12, true);
      const jsonBytes = glb.slice(20, 20 + jsonLength);
      return JSON.parse(new TextDecoder().decode(jsonBytes).trim());
    }

    it('should create default material when no material slots', () => {
      const mesh = new Mesh();
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(0, 1, 0)));
      mesh.addFace(new Face([0, 1, 2]));

      const json = extractJSON(exportGLB(mesh).glb);
      expect(json.materials).toHaveLength(1);
      expect(json.materials[0].name).toBe('default');
      expect(json.materials[0].pbrMetallicRoughness).toBeDefined();
    });

    it('should map material slots to PBR materials', () => {
      const mesh = MeshOperations.createBox(1, 1, 1);
      mesh.addMaterialSlot({
        name: 'oak',
        color: { r: 0.8, g: 0.5, b: 0.2 },
        roughness: 0.6,
        metalness: 0.0
      });
      // Assign all faces to the material
      for (const face of mesh.faces) {
        face.materialSlotIndex = 0;
      }

      const json = extractJSON(exportGLB(mesh).glb);
      const mat = json.materials[0];
      expect(mat.name).toBe('oak');
      expect(mat.pbrMetallicRoughness.baseColorFactor[0]).toBeCloseTo(0.8);
      expect(mat.pbrMetallicRoughness.roughnessFactor).toBeCloseTo(0.6);
      expect(mat.pbrMetallicRoughness.metallicFactor).toBeCloseTo(0.0);
    });

    it('should create separate primitives for different materials', () => {
      const mesh = MeshOperations.createBox(1, 1, 1);
      mesh.addMaterialSlot({ name: 'red', color: { r: 1, g: 0, b: 0 }, roughness: 0.5, metalness: 0 });
      mesh.addMaterialSlot({ name: 'blue', color: { r: 0, g: 0, b: 1 }, roughness: 0.5, metalness: 0 });

      // Assign first 3 faces to red, rest to blue
      mesh.faces.forEach((f, i) => { f.materialSlotIndex = i < 3 ? 0 : 1; });

      const json = extractJSON(exportGLB(mesh).glb);
      expect(json.meshes[0].primitives.length).toBe(2);
      expect(json.materials).toHaveLength(2);
    });
  });

  describe('stats', () => {
    it('should report correct stats for a box', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = exportGLB(box, 'box');

      // Box: 24 vertices, 6 faces → 12 triangles
      expect(result.stats.triangleCount).toBe(12);
      expect(result.stats.vertexCount).toBeGreaterThan(0);
      expect(result.stats.byteSize).toBeGreaterThan(0);
      expect(result.stats.hasUVs).toBe(true);
    });

    it('should report no UVs for mesh without UVs', () => {
      const mesh = new Mesh();
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(0, 1, 0)));
      mesh.addFace(new Face([0, 1, 2]));

      const result = exportGLB(mesh);
      expect(result.stats.hasUVs).toBe(false);
    });
  });

  describe('geometry types', () => {
    it('should export a sphere', () => {
      const sphere = MeshOperations.createSphere(1, 8, 6);
      const result = exportGLB(sphere, 'sphere');
      expect(result.stats.vertexCount).toBeGreaterThan(0);
      expect(result.stats.triangleCount).toBeGreaterThan(0);
      expect(result.stats.hasUVs).toBe(true);
    });

    it('should export a lathe/vase', () => {
      const profile = [
        { x: 0.5, y: 0 },
        { x: 0.6, y: 0.3 },
        { x: 0.4, y: 0.7 },
        { x: 0.3, y: 1.0 }
      ];
      const vase = lathe(profile, 12);
      const result = exportGLB(vase, 'vase');
      expect(result.stats.vertexCount).toBeGreaterThan(0);
      expect(result.stats.hasUVs).toBe(true);
    });
  });

  describe('packGLB', () => {
    it('should produce valid GLB from simple input', () => {
      const json = { asset: { version: '2.0' }, buffers: [{ byteLength: 4 }] };
      const bin = new Uint8Array([1, 2, 3, 4]);
      const glb = packGLB(json, bin);

      const view = new DataView(glb.buffer, glb.byteOffset);
      expect(view.getUint32(0, true)).toBe(0x46546C67); // magic
      expect(view.getUint32(4, true)).toBe(2); // version
      expect(view.getUint32(8, true)).toBe(glb.byteLength); // total length
    });
  });
});
