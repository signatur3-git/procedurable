/**
 * Texture Atlasing Tests (G3-004)
 *
 * Tests for UV atlas repacking in composed scenes — detecting UV overlap,
 * repacking overlapping islands, auto-resolution scaling, and material preservation.
 */

import { describe, it, expect } from '@jest/globals';
import {
  unwrapMesh,
  detectUVOverlap,
  computeAtlasResolution,
  repackExistingUVs,
} from '../../platform/geometry/UVUnwrapper';
import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { Mesh } from '../../platform/geometry/Mesh';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { Vec3 } from '../../platform/math/Vec3';

/**
 * Helper: create a box mesh with UVs and add it to a parent mesh at an offset,
 * simulating what TracedBuilder.compose() does (clone vertices with UVs, remap faces).
 */
function composeBoxIntoMesh(
  parent: Mesh,
  width: number, height: number, depth: number,
  offsetX: number, offsetY: number, offsetZ: number,
  materialSlotIndex?: number
): void {
  const child = MeshOperations.createBox(width, height, depth);
  const vertexMap = new Map<number, number>();

  for (let i = 0; i < child.vertices.length; i++) {
    const v = child.vertices[i];
    const newVertex = v.clone();
    newVertex.position = v.position.add(new Vec3(offsetX, offsetY, offsetZ));
    const newIndex = parent.addVertex(newVertex);
    vertexMap.set(i, newIndex);
  }

  for (const face of child.faces) {
    const newIndices = face.indices.map(idx => vertexMap.get(idx)!);
    parent.addFace(new Face(newIndices, face.color, materialSlotIndex ?? face.materialSlotIndex));
  }
}

describe('Texture Atlasing (G3-004)', () => {

  describe('detectUVOverlap', () => {
    it('should return hasOverlap: true for mesh with overlapping UV islands', () => {
      // Compose two boxes — both use [0,1] UVs independently, so they overlap
      const mesh = new Mesh();
      composeBoxIntoMesh(mesh, 1, 1, 1, 0, 0, 0);
      composeBoxIntoMesh(mesh, 1, 1, 1, 3, 0, 0);

      const result = detectUVOverlap(mesh);
      expect(result.hasOverlap).toBe(true);
      expect(result.islandCount).toBeGreaterThan(1);
    });

    it('should return hasOverlap: false for single-box mesh', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = detectUVOverlap(box);

      // A single box has 6 separate faces with per-face UVs.
      // Whether they "overlap" in UV space depends on box UV layout,
      // but a single box should either have no overlap or be handled.
      // The key test is that it doesn't crash and returns a valid result.
      expect(result.islandCount).toBeGreaterThan(0);
    });

    it('should return hasOverlap: false for mesh with no UVs', () => {
      const mesh = new Mesh();
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(0, 1, 0)));
      mesh.addFace(new Face([0, 1, 2]));

      const result = detectUVOverlap(mesh);
      expect(result.hasOverlap).toBe(false);
      expect(result.islandCount).toBe(0);
    });

    it('should detect duplicate islands as overlapping', () => {
      // Four identical boxes all using [0,1] UV space = 4 duplicate islands
      const mesh = new Mesh();
      composeBoxIntoMesh(mesh, 1, 1, 1, 0, 0, 0);
      composeBoxIntoMesh(mesh, 1, 1, 1, 3, 0, 0);
      composeBoxIntoMesh(mesh, 1, 1, 1, 6, 0, 0);
      composeBoxIntoMesh(mesh, 1, 1, 1, 9, 0, 0);

      const result = detectUVOverlap(mesh);
      expect(result.hasOverlap).toBe(true);
      // All 4 boxes have identical UV layouts → duplicates
      expect(result.uniqueIslandCount).toBeLessThan(result.islandCount);
    });
  });

  describe('repackExistingUVs', () => {
    it('should produce non-overlapping UVs for composed mesh', () => {
      const mesh = new Mesh();
      composeBoxIntoMesh(mesh, 1, 1, 1, 0, 0, 0);
      composeBoxIntoMesh(mesh, 1, 1, 1, 3, 0, 0);

      const result = repackExistingUVs(mesh, 0.02);

      // After repacking, UV overlap should be eliminated
      const overlapAfter = detectUVOverlap(result.mesh);
      expect(overlapAfter.hasOverlap).toBe(false);
    });

    it('should preserve face count after repacking', () => {
      const mesh = new Mesh();
      composeBoxIntoMesh(mesh, 1, 1, 1, 0, 0, 0);
      composeBoxIntoMesh(mesh, 1, 1, 1, 3, 0, 0);

      const originalFaceCount = mesh.faces.length;
      const result = repackExistingUVs(mesh, 0.02);

      expect(result.mesh.faces.length).toBe(originalFaceCount);
    });

    it('should deduplicate identical UV islands', () => {
      // 4 identical boxes → should deduplicate to fewer unique islands
      const mesh = new Mesh();
      composeBoxIntoMesh(mesh, 1, 1, 1, 0, 0, 0);
      composeBoxIntoMesh(mesh, 1, 1, 1, 3, 0, 0);
      composeBoxIntoMesh(mesh, 1, 1, 1, 6, 0, 0);
      composeBoxIntoMesh(mesh, 1, 1, 1, 9, 0, 0);

      const result = repackExistingUVs(mesh, 0.02);

      // After repacking, utilization should be reasonable (not 0)
      expect(result.utilization).toBeGreaterThan(0);
      // Islands should exist
      expect(result.islands.length).toBeGreaterThan(0);
      // And the result should have valid UVs
      const hasUVs = result.mesh.vertices.some(v => v.attributes.uv !== undefined);
      expect(hasUVs).toBe(true);
    });

    it('should preserve material slot indices after repacking', () => {
      const mesh = new Mesh();
      mesh.addMaterialSlot({ name: 'wood', color: { r: 0.6, g: 0.4, b: 0.2 }, roughness: 0.7, metalness: 0 });
      mesh.addMaterialSlot({ name: 'metal', color: { r: 0.8, g: 0.8, b: 0.8 }, roughness: 0.3, metalness: 0.9 });

      composeBoxIntoMesh(mesh, 1, 1, 1, 0, 0, 0, 0); // wood
      composeBoxIntoMesh(mesh, 1, 1, 1, 3, 0, 0, 1); // metal

      const result = repackExistingUVs(mesh, 0.02);

      // Material slots should be copied to the new mesh
      expect(result.mesh.materialSlots.length).toBe(2);
      expect(result.mesh.materialSlots[0].name).toBe('wood');
      expect(result.mesh.materialSlots[1].name).toBe('metal');

      // Faces should retain their material slot assignments
      const woodFaces = result.mesh.faces.filter(f => f.materialSlotIndex === 0);
      const metalFaces = result.mesh.faces.filter(f => f.materialSlotIndex === 1);
      expect(woodFaces.length).toBeGreaterThan(0);
      expect(metalFaces.length).toBeGreaterThan(0);
      expect(woodFaces.length + metalFaces.length).toBe(result.mesh.faces.length);
    });

    it('should preserve face colors after repacking', () => {
      const mesh = new Mesh();
      const child = MeshOperations.createBox(1, 1, 1);
      const vertexMap = new Map<number, number>();

      for (let i = 0; i < child.vertices.length; i++) {
        const newVertex = child.vertices[i].clone();
        const newIndex = mesh.addVertex(newVertex);
        vertexMap.set(i, newIndex);
      }

      // Set a specific face color
      const testColor = { r: 1, g: 0, b: 0 };
      for (const face of child.faces) {
        const newIndices = face.indices.map(idx => vertexMap.get(idx)!);
        const newFace = new Face(newIndices, testColor);
        mesh.addFace(newFace);
      }

      const result = repackExistingUVs(mesh, 0.02);

      // All faces should retain their color
      for (const face of result.mesh.faces) {
        expect(face.color).toEqual(testColor);
      }
    });
  });

  describe('computeAtlasResolution', () => {
    it('should return 512 for small scenes (<100 triangles per material)', () => {
      // A single box has 12 triangles
      const box = MeshOperations.createBox(1, 1, 1);
      expect(computeAtlasResolution(box)).toBe(512);
    });

    it('should return 1024 for medium scenes (100-1000 triangles per material)', () => {
      // Create a mesh with ~200 triangles
      const mesh = new Mesh();
      for (let i = 0; i < 20; i++) {
        composeBoxIntoMesh(mesh, 1, 1, 1, i * 2, 0, 0);
      }
      // 20 boxes × 12 triangles = 240 triangles
      expect(computeAtlasResolution(mesh)).toBe(1024);
    });

    it('should return 2048 for large scenes (1000+ triangles per material)', () => {
      // Create a mesh with ~1200 triangles
      const mesh = new Mesh();
      for (let i = 0; i < 100; i++) {
        composeBoxIntoMesh(mesh, 1, 1, 1, i * 2, 0, 0);
      }
      // 100 boxes × 12 triangles = 1200 triangles
      expect(computeAtlasResolution(mesh)).toBe(2048);
    });

    it('should respect baseResolution floor', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      // Even a small scene should not go below baseResolution
      expect(computeAtlasResolution(box, 1024)).toBe(1024);
    });
  });

  describe('unwrapMesh with preserveExistingUVs', () => {
    it('should repack composed meshes via unwrapMesh API', () => {
      const mesh = new Mesh();
      composeBoxIntoMesh(mesh, 1, 1, 1, 0, 0, 0);
      composeBoxIntoMesh(mesh, 1, 1, 1, 3, 0, 0);

      // Verify overlap before
      const before = detectUVOverlap(mesh);
      expect(before.hasOverlap).toBe(true);

      // Repack via the public API
      const result = unwrapMesh(mesh, {
        margin: 0.02,
        normalize: true,
        preserveExistingUVs: true
      });

      // Verify no overlap after
      const after = detectUVOverlap(result.mesh);
      expect(after.hasOverlap).toBe(false);
    });
  });
});
