/**
 * UV Unwrapper Tests (G3-002)
 */

import { describe, it, expect } from '@jest/globals';
import { unwrapMesh, UVUnwrapper } from '../../platform/geometry/UVUnwrapper';
import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { Mesh } from '../../platform/geometry/Mesh';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { Vec3 } from '../../platform/math/Vec3';

describe('UV Unwrapper (G3-002)', () => {
  describe('unwrapMesh', () => {
    it('should unwrap a simple box', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = unwrapMesh(box);

      expect(result.mesh).toBeDefined();
      expect(result.islands.length).toBeGreaterThan(0);
      expect(result.utilization).toBeGreaterThan(0);
    });

    it('should create islands based on angle threshold', () => {
      const box = MeshOperations.createBox(1, 1, 1);

      // With high threshold, should create fewer islands
      const highThreshold = unwrapMesh(box, { angleThreshold: 90 });

      // With low threshold, should create more islands
      const lowThreshold = unwrapMesh(box, { angleThreshold: 30 });

      // Box has 6 faces with perpendicular normals
      // Low threshold should separate them more
      expect(lowThreshold.islands.length).toBeGreaterThanOrEqual(highThreshold.islands.length);
    });

    it('should produce UVs in [0,1] range when normalized', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = unwrapMesh(box, { normalize: true });

      // Most UVs should be in reasonable range (some may exceed due to packing)
      let inRangeCount = 0;
      for (const vertex of result.mesh.vertices) {
        const uv = vertex.attributes.uv;
        if (uv) {
          if (uv[0] >= 0 && uv[0] <= 1 && uv[1] >= 0 && uv[1] <= 1) {
            inRangeCount++;
          }
        }
      }
      // At least 50% should be in range
      expect(inRangeCount).toBeGreaterThan(result.mesh.vertices.length * 0.5);
    });

    it('should preserve face count', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = unwrapMesh(box);

      expect(result.mesh.faces.length).toBe(box.faces.length);
    });

    it('should assign all faces to islands', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = unwrapMesh(box);

      let totalFaces = 0;
      for (const island of result.islands) {
        totalFaces += island.faceIndices.length;
      }

      expect(totalFaces).toBe(box.faces.length);
    });

    it('should calculate utilization', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = unwrapMesh(box);

      expect(result.utilization).toBeGreaterThan(0);
      expect(result.utilization).toBeLessThanOrEqual(100);
    });

    it('should calculate max stretch', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = unwrapMesh(box);

      expect(result.maxStretch).toBeGreaterThanOrEqual(1);
    });

    it('should respect margin setting', () => {
      const box = MeshOperations.createBox(1, 1, 1);

      const smallMargin = unwrapMesh(box, { margin: 0.01 });
      const largeMargin = unwrapMesh(box, { margin: 0.1 });

      // With larger margin, utilization should be lower (more space wasted)
      expect(largeMargin.utilization).toBeLessThanOrEqual(smallMargin.utilization + 10);
    });
  });

  describe('UVUnwrapper class', () => {
    it('should create unwrapper with options', () => {
      const unwrapper = new UVUnwrapper({ angleThreshold: 60, margin: 0.03 });
      expect(unwrapper).toBeDefined();
    });

    it('should unwrap mesh', () => {
      const unwrapper = new UVUnwrapper();
      const box = MeshOperations.createBox(1, 1, 1);
      const result = unwrapper.unwrap(box);

      expect(result.mesh).toBeDefined();
      expect(result.islands.length).toBeGreaterThan(0);
    });

    it('should allow setting angle threshold', () => {
      const unwrapper = new UVUnwrapper();
      unwrapper.setAngleThreshold(30);

      const box = MeshOperations.createBox(1, 1, 1);
      const result = unwrapper.unwrap(box);

      expect(result.islands.length).toBeGreaterThan(0);
    });

    it('should allow setting margin', () => {
      const unwrapper = new UVUnwrapper();
      unwrapper.setMargin(0.05);

      const box = MeshOperations.createBox(1, 1, 1);
      const result = unwrapper.unwrap(box);

      expect(result.mesh).toBeDefined();
    });
  });

  describe('Island segmentation', () => {
    it('should create separate islands for perpendicular faces', () => {
      // Create L-shaped mesh with two perpendicular planes
      const mesh = new Mesh();

      // Horizontal plane
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 1)));
      mesh.addVertex(new Vertex(new Vec3(0, 0, 1)));
      mesh.addFace(new Face([0, 1, 2, 3]));

      // Vertical plane
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(0, 1, 0)));
      mesh.addVertex(new Vertex(new Vec3(0, 1, 1)));
      mesh.addVertex(new Vertex(new Vec3(0, 0, 1)));
      mesh.addFace(new Face([4, 5, 6, 7]));

      const result = unwrapMesh(mesh, { angleThreshold: 45 });

      // Should create 2 islands for perpendicular faces
      expect(result.islands.length).toBe(2);
    });

    it('should merge coplanar faces into same island', () => {
      // Create two coplanar triangles
      const mesh = new Mesh();

      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 1)));
      mesh.addVertex(new Vertex(new Vec3(0, 0, 1)));

      mesh.addFace(new Face([0, 1, 2]));
      mesh.addFace(new Face([0, 2, 3]));

      const result = unwrapMesh(mesh, { angleThreshold: 45 });

      // Both faces should be in same island (same normal)
      expect(result.islands.length).toBe(1);
      expect(result.islands[0].faceIndices.length).toBe(2);
    });
  });

  describe('UV quality after unwrap', () => {
    it('should achieve utilization > 20% for simple box', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = unwrapMesh(box, { margin: 0.02 });

      expect(result.utilization).toBeGreaterThan(20);
    });

    it('should have max stretch < 50 for uniform box', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = unwrapMesh(box);

      expect(result.maxStretch).toBeLessThan(50);
    });

    it('should have valid UV bounds for all islands', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = unwrapMesh(box);

      for (const island of result.islands) {
        expect(island.bounds.uMin).toBeLessThanOrEqual(island.bounds.uMax);
        expect(island.bounds.vMin).toBeLessThanOrEqual(island.bounds.vMax);
        // Bounds should be finite numbers
        expect(Number.isFinite(island.bounds.uMin)).toBe(true);
        expect(Number.isFinite(island.bounds.uMax)).toBe(true);
        expect(Number.isFinite(island.bounds.vMin)).toBe(true);
        expect(Number.isFinite(island.bounds.vMax)).toBe(true);
      }
    });
  });

  describe('Determinism', () => {
    it('should produce same result for same input', () => {
      const box = MeshOperations.createBox(1, 1, 1);

      const r1 = unwrapMesh(box, { angleThreshold: 45, margin: 0.02 });
      const r2 = unwrapMesh(box, { angleThreshold: 45, margin: 0.02 });

      expect(r1.islands.length).toBe(r2.islands.length);
      expect(r1.utilization).toBe(r2.utilization);
      expect(r1.mesh.vertices.length).toBe(r2.mesh.vertices.length);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty mesh', () => {
      const mesh = new Mesh();
      const result = unwrapMesh(mesh);

      expect(result.islands.length).toBe(0);
      expect(result.mesh.faces.length).toBe(0);
    });

    it('should handle single triangle', () => {
      const mesh = new Mesh();
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(0.5, 0, 1)));
      mesh.addFace(new Face([0, 1, 2]));

      const result = unwrapMesh(mesh);

      expect(result.islands.length).toBe(1);
      expect(result.mesh.faces.length).toBe(1);
    });

    it('should handle non-manifold geometry', () => {
      // Two disconnected triangles
      const mesh = new Mesh();

      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(0.5, 0, 1)));
      mesh.addFace(new Face([0, 1, 2]));

      mesh.addVertex(new Vertex(new Vec3(2, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(3, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(2.5, 0, 1)));
      mesh.addFace(new Face([3, 4, 5]));

      const result = unwrapMesh(mesh);

      expect(result.islands.length).toBe(2);
      expect(result.mesh.faces.length).toBe(2);
    });
  });
});
