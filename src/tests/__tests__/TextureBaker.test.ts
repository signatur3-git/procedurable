/**
 * Texture Baker Tests (G6-001)
 */

import { describe, it, expect } from '@jest/globals';
import { bakeTextures, bakeTexturesPerMaterial, TextureBaker } from '../../platform/materials/TextureBaker';
import { MaterialStackDefinition } from '../../platform/materials/MaterialStack';
import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { unwrapMesh } from '../../platform/geometry/UVUnwrapper';
import { Mesh } from '../../platform/geometry/Mesh';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { Vec3 } from '../../platform/math/Vec3';

// Import generators
import '../../platform/materials/generators';

describe('Texture Baker (G6-001)', () => {
  // Helper to create a simple material definition
  const simpleMaterial: MaterialStackDefinition = {
    layers: [
      { generator: 'noise_color', params: { colorA: { r: 0.3, g: 0.2, b: 0.1 }, colorB: { r: 0.6, g: 0.5, b: 0.4 } } }
    ]
  };

  const woodMaterial: MaterialStackDefinition = {
    layers: [
      { generator: 'wood_grain', params: { species: 'oak' } }
    ]
  };

  describe('bakeTextures', () => {
    it('should bake textures for a simple box', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);

      const result = bakeTextures(unwrapped.mesh, simpleMaterial, { resolution: 64 });

      expect(result.resolution).toBe(64);
      expect(result.textures.size).toBeGreaterThan(0);
      expect(result.bakeTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should create albedo texture with RGBA data', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);

      const result = bakeTextures(unwrapped.mesh, simpleMaterial, {
        resolution: 32,
        channels: ['albedo']
      });

      expect(result.textures.has('albedo')).toBe(true);
      const albedo = result.textures.get('albedo')!;
      expect(albedo.length).toBe(32 * 32 * 4); // RGBA
    });

    it('should create normal texture with correct default values', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);

      const result = bakeTextures(unwrapped.mesh, simpleMaterial, {
        resolution: 32,
        channels: ['normal']
      });

      expect(result.textures.has('normal')).toBe(true);
      const normal = result.textures.get('normal')!;
      expect(normal.length).toBe(32 * 32 * 4);

      // Check that at least some pixels have the flat normal color (128, 128, 255)
      let flatNormalCount = 0;
      for (let i = 0; i < normal.length; i += 4) {
        if (normal[i] === 128 && normal[i + 1] === 128 && normal[i + 2] === 255) {
          flatNormalCount++;
        }
      }
      expect(flatNormalCount).toBeGreaterThan(0);
    });

    it('should create roughness texture as grayscale', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);

      const result = bakeTextures(unwrapped.mesh, simpleMaterial, {
        resolution: 32,
        channels: ['roughness']
      });

      expect(result.textures.has('roughness')).toBe(true);
      const roughness = result.textures.get('roughness')!;
      expect(roughness.length).toBe(32 * 32); // Single channel
    });

    it('should create metallic texture as grayscale', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);

      const result = bakeTextures(unwrapped.mesh, simpleMaterial, {
        resolution: 32,
        channels: ['metallic']
      });

      expect(result.textures.has('metallic')).toBe(true);
      const metallic = result.textures.get('metallic')!;
      expect(metallic.length).toBe(32 * 32);
    });

    it('should bake multiple channels at once', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);

      const result = bakeTextures(unwrapped.mesh, simpleMaterial, {
        resolution: 32,
        channels: ['albedo', 'normal', 'roughness', 'metallic', 'ao']
      });

      expect(result.textures.has('albedo')).toBe(true);
      expect(result.textures.has('normal')).toBe(true);
      expect(result.textures.has('roughness')).toBe(true);
      expect(result.textures.has('metallic')).toBe(true);
      expect(result.textures.has('ao')).toBe(true);
    });

    it('should report bake statistics', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);

      const result = bakeTextures(unwrapped.mesh, simpleMaterial, { resolution: 32 });

      expect(result.stats.pixelsBaked).toBeGreaterThan(0);
      expect(result.stats.coverage).toBeGreaterThan(0);
      expect(result.stats.coverage).toBeLessThanOrEqual(1);
    });

    it('should have non-zero pixel values in albedo', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);

      const result = bakeTextures(unwrapped.mesh, simpleMaterial, {
        resolution: 32,
        channels: ['albedo']
      });

      const albedo = result.textures.get('albedo')!;
      let nonZeroCount = 0;
      for (let i = 0; i < albedo.length; i += 4) {
        if (albedo[i] > 0 || albedo[i + 1] > 0 || albedo[i + 2] > 0) {
          nonZeroCount++;
        }
      }
      expect(nonZeroCount).toBeGreaterThan(0);
    });
  });

  describe('TextureBaker class', () => {
    it('should create baker with options', () => {
      const baker = new TextureBaker({ resolution: 512, seed: 42 });
      expect(baker).toBeDefined();
    });

    it('should bake using class method', () => {
      const baker = new TextureBaker({ resolution: 32 });
      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);

      const result = baker.bake(unwrapped.mesh, simpleMaterial);

      expect(result.resolution).toBe(32);
      expect(result.textures.size).toBeGreaterThan(0);
    });

    it('should allow setting resolution', () => {
      const baker = new TextureBaker();
      baker.setResolution(64);

      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);
      const result = baker.bake(unwrapped.mesh, simpleMaterial);

      expect(result.resolution).toBe(64);
    });

    it('should allow setting channels', () => {
      const baker = new TextureBaker({ resolution: 32 });
      baker.setChannels(['albedo']);

      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);
      const result = baker.bake(unwrapped.mesh, simpleMaterial);

      expect(result.textures.has('albedo')).toBe(true);
      expect(result.textures.has('normal')).toBe(false);
    });
  });

  describe('Determinism', () => {
    it('should produce identical results with same seed', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);

      const r1 = bakeTextures(unwrapped.mesh, simpleMaterial, { resolution: 32, seed: 42 });
      const r2 = bakeTextures(unwrapped.mesh, simpleMaterial, { resolution: 32, seed: 42 });

      const albedo1 = r1.textures.get('albedo')!;
      const albedo2 = r2.textures.get('albedo')!;

      expect(albedo1.length).toBe(albedo2.length);
      for (let i = 0; i < albedo1.length; i++) {
        expect(albedo1[i]).toBe(albedo2[i]);
      }
    });

    it('should produce different results with different seeds', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);

      const r1 = bakeTextures(unwrapped.mesh, woodMaterial, { resolution: 32, seed: 42 });
      const r2 = bakeTextures(unwrapped.mesh, woodMaterial, { resolution: 32, seed: 123 });

      const albedo1 = r1.textures.get('albedo')!;
      const albedo2 = r2.textures.get('albedo')!;

      let differences = 0;
      for (let i = 0; i < albedo1.length; i++) {
        if (albedo1[i] !== albedo2[i]) differences++;
      }
      expect(differences).toBeGreaterThan(0);
    });
  });

  describe('Wood material baking', () => {
    it('should bake wood grain texture', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);

      const result = bakeTextures(unwrapped.mesh, woodMaterial, {
        resolution: 64,
        channels: ['albedo', 'roughness']
      });

      expect(result.textures.has('albedo')).toBe(true);
      expect(result.stats.pixelsBaked).toBeGreaterThan(0);

      // Wood should have variation in color
      const albedo = result.textures.get('albedo')!;
      const colors = new Set<number>();
      for (let i = 0; i < albedo.length; i += 4) {
        colors.add(albedo[i]); // Just red channel
      }
      expect(colors.size).toBeGreaterThan(1); // Multiple shades
    });
  });

  describe('Edge cases', () => {
    it('should handle mesh with no UVs gracefully', () => {
      // Create mesh without UVs
      const box = MeshOperations.createBox(1, 1, 1);
      // Don't unwrap - UVs may be missing or invalid

      const result = bakeTextures(box, simpleMaterial, { resolution: 32 });

      // Should still produce result, even if mostly empty
      expect(result.textures.size).toBeGreaterThan(0);
    });

    it('should handle empty material stack', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const unwrapped = unwrapMesh(box);

      const emptyMaterial: MaterialStackDefinition = { layers: [] };
      const result = bakeTextures(unwrapped.mesh, emptyMaterial, { resolution: 32 });

      expect(result.textures.size).toBeGreaterThan(0);
    });
  });

  describe('bakeTexturesPerMaterial', () => {
    // Helper to create a multi-material mesh
    function createMultiMaterialMesh(): Mesh {
      const mesh = new Mesh();

      // Add material slots with full properties
      mesh.addMaterialSlot({ name: 'white_material', color: { r: 1, g: 1, b: 1 }, roughness: 0.5, metalness: 0 });
      mesh.addMaterialSlot({ name: 'black_material', color: { r: 0, g: 0, b: 0 }, roughness: 0.5, metalness: 0 });
      mesh.addMaterialSlot({ name: 'wood_material', color: { r: 0.6, g: 0.4, b: 0.2 }, roughness: 0.6, metalness: 0 });

      // Create vertices for 3 quads (2 triangles each) using Vec3
      // Quad 1 - white
      const v0 = new Vertex(new Vec3(0, 0, 0), { uv: [0, 0] });
      const v1 = new Vertex(new Vec3(1, 0, 0), { uv: [1, 0] });
      const v2 = new Vertex(new Vec3(1, 1, 0), { uv: [1, 1] });
      const v3 = new Vertex(new Vec3(0, 1, 0), { uv: [0, 1] });
      mesh.addVertex(v0);
      mesh.addVertex(v1);
      mesh.addVertex(v2);
      mesh.addVertex(v3);

      // Quad 2 - black
      const v4 = new Vertex(new Vec3(2, 0, 0), { uv: [0, 0] });
      const v5 = new Vertex(new Vec3(3, 0, 0), { uv: [1, 0] });
      const v6 = new Vertex(new Vec3(3, 1, 0), { uv: [1, 1] });
      const v7 = new Vertex(new Vec3(2, 1, 0), { uv: [0, 1] });
      mesh.addVertex(v4);
      mesh.addVertex(v5);
      mesh.addVertex(v6);
      mesh.addVertex(v7);

      // Quad 3 - wood
      const v8 = new Vertex(new Vec3(4, 0, 0), { uv: [0, 0] });
      const v9 = new Vertex(new Vec3(5, 0, 0), { uv: [1, 0] });
      const v10 = new Vertex(new Vec3(5, 1, 0), { uv: [1, 1] });
      const v11 = new Vertex(new Vec3(4, 1, 0), { uv: [0, 1] });
      mesh.addVertex(v8);
      mesh.addVertex(v9);
      mesh.addVertex(v10);
      mesh.addVertex(v11);

      // Add faces with material slots
      mesh.addFace(new Face([0, 1, 2], undefined, 0)); // white
      mesh.addFace(new Face([0, 2, 3], undefined, 0)); // white
      mesh.addFace(new Face([4, 5, 6], undefined, 1)); // black
      mesh.addFace(new Face([4, 6, 7], undefined, 1)); // black
      mesh.addFace(new Face([8, 9, 10], undefined, 2)); // wood
      mesh.addFace(new Face([8, 10, 11], undefined, 2)); // wood

      return mesh;
    }

    it('should bake separate textures for each material', () => {
      const mesh = createMultiMaterialMesh();

      const materialDefs = new Map<number, MaterialStackDefinition>();
      materialDefs.set(0, { layers: [{ generator: 'solid_color', params: { color: { r: 1, g: 1, b: 1 } } }] });
      materialDefs.set(1, { layers: [{ generator: 'solid_color', params: { color: { r: 0, g: 0, b: 0 } } }] });
      materialDefs.set(2, { layers: [{ generator: 'wood_grain', params: { species: 'oak' } }] });

      const result = bakeTexturesPerMaterial(mesh, materialDefs, { resolution: 64 });

      expect(result.stats.materialCount).toBe(3);
      expect(result.materials.size).toBe(3);
    });

    it('should create 1x1 textures for solid colors', () => {
      const mesh = createMultiMaterialMesh();

      // Only solid color materials
      const materialDefs = new Map<number, MaterialStackDefinition>();
      materialDefs.set(0, { layers: [{ generator: 'solid_color', params: { color: { r: 1, g: 1, b: 1 } } }] });
      materialDefs.set(1, { layers: [{ generator: 'solid_color', params: { color: { r: 0, g: 0, b: 0 } } }] });
      materialDefs.set(2, { layers: [] }); // Empty = solid

      const result = bakeTexturesPerMaterial(mesh, materialDefs, { resolution: 512 });

      // All should be solid color (1x1 textures)
      expect(result.stats.solidColorMaterials).toBe(3);
      expect(result.stats.texturedMaterials).toBe(0);

      // Check that solid materials have 1x1 resolution
      for (const [, matResult] of result.materials) {
        if (matResult.isSolidColor) {
          expect(matResult.bakeResult.resolution).toBe(1);
        }
      }
    });

    it('should use full resolution for textured materials', () => {
      const mesh = createMultiMaterialMesh();

      const materialDefs = new Map<number, MaterialStackDefinition>();
      materialDefs.set(0, { layers: [{ generator: 'solid_color', params: { color: { r: 1, g: 1, b: 1 } } }] });
      materialDefs.set(1, { layers: [{ generator: 'solid_color', params: { color: { r: 0, g: 0, b: 0 } } }] });
      materialDefs.set(2, { layers: [{ generator: 'wood_grain', params: { species: 'oak' } }] });

      const result = bakeTexturesPerMaterial(mesh, materialDefs, { resolution: 256 });

      // 2 solid, 1 textured
      expect(result.stats.solidColorMaterials).toBe(2);
      expect(result.stats.texturedMaterials).toBe(1);

      // Wood material should have full resolution
      const woodMat = result.materials.get(2);
      expect(woodMat).toBeDefined();
      expect(woodMat!.isSolidColor).toBe(false);
      expect(woodMat!.bakeResult.resolution).toBe(256);
    });

    it('should track triangle count per material', () => {
      const mesh = createMultiMaterialMesh();

      const materialDefs = new Map<number, MaterialStackDefinition>();
      materialDefs.set(0, { layers: [] });
      materialDefs.set(1, { layers: [] });
      materialDefs.set(2, { layers: [] });

      const result = bakeTexturesPerMaterial(mesh, materialDefs);

      expect(result.stats.totalTriangles).toBe(6);
      expect(result.materials.get(0)?.triangleCount).toBe(2);
      expect(result.materials.get(1)?.triangleCount).toBe(2);
      expect(result.materials.get(2)?.triangleCount).toBe(2);
    });

    it('should use TextureBaker class for per-material baking', () => {
      const mesh = createMultiMaterialMesh();

      const materialDefs = new Map<number, MaterialStackDefinition>();
      materialDefs.set(0, { layers: [] });
      materialDefs.set(1, { layers: [] });

      const baker = new TextureBaker({ resolution: 128 });
      const result = baker.bakePerMaterial(mesh, materialDefs);

      expect(result.stats.materialCount).toBeGreaterThan(0);
    });
  });
});
