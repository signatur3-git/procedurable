/**
 * GLTFTexturedExport.test.ts
 *
 * Tests for G6-002: glTF Export with Baked Textures
 *
 * Verifies:
 * - Texture embedding in GLB format
 * - PNG encoding of texture data
 * - Material texture references (baseColorTexture, metallicRoughnessTexture, normalTexture, occlusionTexture)
 * - Combined metallicRoughness texture (G=roughness, B=metallic)
 * - Proper sampler configuration
 */

import { exportTexturedGLB, type BakedTextureSet } from '../../export';
import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { Mesh } from '../../platform/geometry/Mesh';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { Vec3 } from '../../platform/math/Vec3';

describe('G6-002: glTF Export with Baked Textures', () => {
  // Create a simple test mesh with UVs
  const createTestMesh = () => {
    return MeshOperations.createBox(1, 1, 1, 'world_scale');
  };

  // Create a minimal texture set for testing
  const createTestTextureSet = (resolution: number = 64): BakedTextureSet => {
    const pixelCount = resolution * resolution;

    // Albedo: simple gradient (RGBA)
    const albedo = new Uint8Array(pixelCount * 4);
    for (let i = 0; i < pixelCount; i++) {
      const x = (i % resolution) / resolution;
      const y = Math.floor(i / resolution) / resolution;
      albedo[i * 4] = Math.round(x * 255);       // R: gradient by X
      albedo[i * 4 + 1] = Math.round(y * 255);   // G: gradient by Y
      albedo[i * 4 + 2] = 128;                   // B: constant
      albedo[i * 4 + 3] = 255;                   // A: opaque
    }

    // Roughness: grayscale
    const roughness = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      roughness[i] = Math.round((i / pixelCount) * 255); // Gradient
    }

    // Metallic: grayscale
    const metallic = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      metallic[i] = i % 2 === 0 ? 0 : 255; // Checkerboard
    }

    // Normal: flat normal map (RGBA)
    const normal = new Uint8Array(pixelCount * 4);
    for (let i = 0; i < pixelCount; i++) {
      normal[i * 4] = 128;     // X: 0
      normal[i * 4 + 1] = 128; // Y: 0
      normal[i * 4 + 2] = 255; // Z: 1 (pointing up)
      normal[i * 4 + 3] = 255; // A: unused
    }

    // AO: grayscale
    const ao = new Uint8Array(pixelCount);
    ao.fill(200); // Mostly bright with slight occlusion

    return {
      albedo,
      roughness,
      metallic,
      normal,
      ao,
      resolution
    };
  };

  describe('Basic Export', () => {
    it('should export mesh with all texture channels', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(64);

      const result = exportTexturedGLB(mesh, textures, 'textured_box');

      expect(result.glb).toBeDefined();
      expect(result.glb.byteLength).toBeGreaterThan(0);
      expect(result.stats.textureCount).toBe(4); // albedo, metallicRoughness, normal, ao
      expect(result.stats.textureResolution).toBe(64);
      expect(result.stats.hasUVs).toBe(true);
    });

    it('should export mesh with only albedo texture', () => {
      const mesh = createTestMesh();
      const textures: BakedTextureSet = {
        albedo: new Uint8Array(16 * 16 * 4).fill(255),
        resolution: 16
      };

      const result = exportTexturedGLB(mesh, textures, 'albedo_only');

      expect(result.stats.textureCount).toBe(1);
    });

    it('should export mesh with only metallicRoughness texture', () => {
      const mesh = createTestMesh();
      const textures: BakedTextureSet = {
        roughness: new Uint8Array(16 * 16).fill(128),
        metallic: new Uint8Array(16 * 16).fill(0),
        resolution: 16
      };

      const result = exportTexturedGLB(mesh, textures, 'mr_only');

      // Combined metallicRoughness = 1 texture
      expect(result.stats.textureCount).toBe(1);
    });

    it('should throw error for mesh without UVs', () => {
      // Create a mesh manually without UVs
      const mesh = new Mesh();
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(0, 1, 0)));
      mesh.addFace(new Face([0, 1, 2]));

      const textures = createTestTextureSet(16);

      expect(() => exportTexturedGLB(mesh, textures)).toThrow(/no UVs/);
    });
  });

  describe('GLB Structure Validation', () => {
    it('should produce valid GLB header', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(32);

      const result = exportTexturedGLB(mesh, textures);
      const glb = result.glb;

      // GLB magic: "glTF" in little-endian
      expect(glb[0]).toBe(0x67); // 'g'
      expect(glb[1]).toBe(0x6C); // 'l'
      expect(glb[2]).toBe(0x54); // 'T'
      expect(glb[3]).toBe(0x46); // 'F'

      // Version: 2
      const version = new DataView(glb.buffer, glb.byteOffset + 4, 4).getUint32(0, true);
      expect(version).toBe(2);

      // Total length should match buffer size
      const totalLength = new DataView(glb.buffer, glb.byteOffset + 8, 4).getUint32(0, true);
      expect(totalLength).toBe(glb.byteLength);
    });

    it('should contain JSON chunk with texture references', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(32);

      const result = exportTexturedGLB(mesh, textures, 'test');
      const glb = result.glb;

      // Extract JSON chunk
      const jsonChunkLength = new DataView(glb.buffer, glb.byteOffset + 12, 4).getUint32(0, true);
      const jsonChunkType = new DataView(glb.buffer, glb.byteOffset + 16, 4).getUint32(0, true);
      expect(jsonChunkType).toBe(0x4E4F534A); // "JSON"

      const jsonBytes = glb.slice(20, 20 + jsonChunkLength);
      const jsonStr = new TextDecoder().decode(jsonBytes);
      const gltf = JSON.parse(jsonStr);

      // Verify texture-related properties
      expect(gltf.textures).toBeDefined();
      expect(gltf.textures.length).toBe(4);

      expect(gltf.images).toBeDefined();
      expect(gltf.images.length).toBe(4);

      expect(gltf.samplers).toBeDefined();
      expect(gltf.samplers.length).toBe(1);

      // Verify material has texture references
      expect(gltf.materials).toBeDefined();
      expect(gltf.materials[0].pbrMetallicRoughness.baseColorTexture).toBeDefined();
      expect(gltf.materials[0].pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
      expect(gltf.materials[0].normalTexture).toBeDefined();
      expect(gltf.materials[0].occlusionTexture).toBeDefined();
    });

    it('should have correct sampler settings', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(32);

      const result = exportTexturedGLB(mesh, textures);
      const glb = result.glb;

      // Extract JSON
      const jsonChunkLength = new DataView(glb.buffer, glb.byteOffset + 12, 4).getUint32(0, true);
      const jsonBytes = glb.slice(20, 20 + jsonChunkLength);
      const gltf = JSON.parse(new TextDecoder().decode(jsonBytes));

      const sampler = gltf.samplers[0];
      expect(sampler.magFilter).toBe(9729); // LINEAR
      expect(sampler.minFilter).toBe(9987); // LINEAR_MIPMAP_LINEAR
      expect(sampler.wrapS).toBe(10497);    // REPEAT
      expect(sampler.wrapT).toBe(10497);    // REPEAT
    });
  });

  describe('PNG Encoding', () => {
    it('should embed PNG images in buffer', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(16);

      const result = exportTexturedGLB(mesh, textures);
      const glb = result.glb;

      // Extract JSON to get buffer view info
      const jsonChunkLength = new DataView(glb.buffer, glb.byteOffset + 12, 4).getUint32(0, true);
      const jsonBytes = glb.slice(20, 20 + jsonChunkLength);
      const gltf = JSON.parse(new TextDecoder().decode(jsonBytes));

      // Find BIN chunk start
      const jsonChunkPadded = Math.ceil(jsonChunkLength / 4) * 4;
      const binStart = 20 + jsonChunkPadded + 8; // After JSON chunk + BIN header

      // Verify each image has PNG signature
      for (const image of gltf.images) {
        expect(image.mimeType).toBe('image/png');
        expect(image.bufferView).toBeDefined();

        const bufferView = gltf.bufferViews[image.bufferView];
        const imageStart = binStart + bufferView.byteOffset;

        // PNG signature: 137 80 78 71 13 10 26 10
        expect(glb[imageStart]).toBe(137);
        expect(glb[imageStart + 1]).toBe(80);  // 'P'
        expect(glb[imageStart + 2]).toBe(78);  // 'N'
        expect(glb[imageStart + 3]).toBe(71);  // 'G'
      }
    });

    it('should produce valid PNG dimensions', () => {
      const resolution = 32;
      const mesh = createTestMesh();
      const textures = createTestTextureSet(resolution);

      const result = exportTexturedGLB(mesh, textures);
      const glb = result.glb;

      // Extract gltf JSON
      const jsonChunkLength = new DataView(glb.buffer, glb.byteOffset + 12, 4).getUint32(0, true);
      const jsonBytes = glb.slice(20, 20 + jsonChunkLength);
      const gltf = JSON.parse(new TextDecoder().decode(jsonBytes));

      // Find BIN chunk start
      const jsonChunkPadded = Math.ceil(jsonChunkLength / 4) * 4;
      const binStart = 20 + jsonChunkPadded + 8;

      // Check first image's IHDR chunk for dimensions
      const image = gltf.images[0];
      const bufferView = gltf.bufferViews[image.bufferView];
      const imageStart = binStart + bufferView.byteOffset;

      // PNG structure: signature(8) + IHDR length(4) + "IHDR"(4) + width(4) + height(4)
      // Width and height are big-endian at offset 16 and 20
      const width = new DataView(glb.buffer, glb.byteOffset + imageStart + 16, 4).getUint32(0, false);
      const height = new DataView(glb.buffer, glb.byteOffset + imageStart + 20, 4).getUint32(0, false);

      expect(width).toBe(resolution);
      expect(height).toBe(resolution);
    });
  });

  describe('MetallicRoughness Combination', () => {
    it('should combine roughness and metallic into single texture', () => {
      const mesh = createTestMesh();
      const resolution = 16;
      const pixelCount = resolution * resolution;

      // Specific patterns for verification
      const roughness = new Uint8Array(pixelCount);
      const metallic = new Uint8Array(pixelCount);

      for (let i = 0; i < pixelCount; i++) {
        roughness[i] = 100; // Constant roughness
        metallic[i] = 200;  // Constant metallic
      }

      const textures: BakedTextureSet = {
        roughness,
        metallic,
        resolution
      };

      const result = exportTexturedGLB(mesh, textures);

      // Should have exactly 1 texture (combined metallicRoughness)
      expect(result.stats.textureCount).toBe(1);

      // Verify the material references it
      const glb = result.glb;
      const jsonChunkLength = new DataView(glb.buffer, glb.byteOffset + 12, 4).getUint32(0, true);
      const jsonBytes = glb.slice(20, 20 + jsonChunkLength);
      const gltf = JSON.parse(new TextDecoder().decode(jsonBytes));

      expect(gltf.materials[0].pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
      expect(gltf.materials[0].pbrMetallicRoughness.baseColorTexture).toBeUndefined();
    });

    it('should create metallicRoughness with only roughness provided', () => {
      const mesh = createTestMesh();
      const textures: BakedTextureSet = {
        roughness: new Uint8Array(16 * 16).fill(180),
        resolution: 16
      };

      const result = exportTexturedGLB(mesh, textures);

      expect(result.stats.textureCount).toBe(1);
    });

    it('should create metallicRoughness with only metallic provided', () => {
      const mesh = createTestMesh();
      const textures: BakedTextureSet = {
        metallic: new Uint8Array(16 * 16).fill(255),
        resolution: 16
      };

      const result = exportTexturedGLB(mesh, textures);

      expect(result.stats.textureCount).toBe(1);
    });
  });

  describe('Material Properties', () => {
    it('should set correct texCoord on all texture references', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(16);

      const result = exportTexturedGLB(mesh, textures);
      const glb = result.glb;

      const jsonChunkLength = new DataView(glb.buffer, glb.byteOffset + 12, 4).getUint32(0, true);
      const jsonBytes = glb.slice(20, 20 + jsonChunkLength);
      const gltf = JSON.parse(new TextDecoder().decode(jsonBytes));

      const mat = gltf.materials[0];
      expect(mat.pbrMetallicRoughness.baseColorTexture.texCoord).toBe(0);
      expect(mat.pbrMetallicRoughness.metallicRoughnessTexture.texCoord).toBe(0);
      expect(mat.normalTexture.texCoord).toBe(0);
      expect(mat.occlusionTexture.texCoord).toBe(0);
    });

    it('should set normal map scale to 1.0', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(16);

      const result = exportTexturedGLB(mesh, textures);
      const glb = result.glb;

      const jsonChunkLength = new DataView(glb.buffer, glb.byteOffset + 12, 4).getUint32(0, true);
      const jsonBytes = glb.slice(20, 20 + jsonChunkLength);
      const gltf = JSON.parse(new TextDecoder().decode(jsonBytes));

      expect(gltf.materials[0].normalTexture.scale).toBe(1.0);
    });

    it('should set occlusion strength to 1.0', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(16);

      const result = exportTexturedGLB(mesh, textures);
      const glb = result.glb;

      const jsonChunkLength = new DataView(glb.buffer, glb.byteOffset + 12, 4).getUint32(0, true);
      const jsonBytes = glb.slice(20, 20 + jsonChunkLength);
      const gltf = JSON.parse(new TextDecoder().decode(jsonBytes));

      expect(gltf.materials[0].occlusionTexture.strength).toBe(1.0);
    });
  });

  describe('Stats Accuracy', () => {
    it('should report correct vertex and triangle counts', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(16);

      const result = exportTexturedGLB(mesh, textures);

      // Box has 24 vertices (4 per face * 6 faces) and 12 triangles (2 per face * 6 faces)
      expect(result.stats.vertexCount).toBe(24);
      expect(result.stats.triangleCount).toBe(12);
    });

    it('should report correct texture resolution', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(128);

      const result = exportTexturedGLB(mesh, textures);

      expect(result.stats.textureResolution).toBe(128);
    });

    it('should report byteSize matching GLB length', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(32);

      const result = exportTexturedGLB(mesh, textures);

      expect(result.stats.byteSize).toBe(result.glb.byteLength);
    });
  });

  describe('Different Resolutions', () => {
    it('should handle 16x16 textures', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(16);

      const result = exportTexturedGLB(mesh, textures);
      expect(result.stats.textureResolution).toBe(16);
    });

    it('should handle 256x256 textures', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(256);

      const result = exportTexturedGLB(mesh, textures);
      expect(result.stats.textureResolution).toBe(256);
    });

    it('should handle 512x512 textures', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(512);

      const result = exportTexturedGLB(mesh, textures);
      expect(result.stats.textureResolution).toBe(512);
    });
  });

  describe('Generator Attribution', () => {
    it('should set generator to Procedurable G6-002', () => {
      const mesh = createTestMesh();
      const textures = createTestTextureSet(16);

      const result = exportTexturedGLB(mesh, textures);
      const glb = result.glb;

      const jsonChunkLength = new DataView(glb.buffer, glb.byteOffset + 12, 4).getUint32(0, true);
      const jsonBytes = glb.slice(20, 20 + jsonChunkLength);
      const gltf = JSON.parse(new TextDecoder().decode(jsonBytes));

      expect(gltf.asset.generator).toBe('Procedurable G6-002');
      expect(gltf.asset.version).toBe('2.0');
    });
  });
});
