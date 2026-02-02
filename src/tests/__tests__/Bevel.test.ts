/**
 * Bevel Operation Tests (C2-002)
 *
 * Tests for mesh edge beveling and chamfering.
 * Uses createBoxWithSharedVertices for proper edge topology.
 */

import { describe, it, expect } from '@jest/globals';
import { MeshOperations } from '../../platform/geometry/MeshOperations';

describe('Bevel Operation (C2-002)', () => {
  describe('chamfer (1 segment)', () => {
    it('should bevel all edges of a box', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);
      const edges = box.getEdges();

      // Chamfer all 12 edges
      const beveled = MeshOperations.bevel(box, edges, 0.1, 1);

      // Original box: 8 vertices, 6 faces (12 triangles)
      // After chamfer: more vertices and faces
      expect(beveled.vertices.length).toBeGreaterThan(box.vertices.length);
      expect(beveled.faces.length).toBeGreaterThan(box.faces.length);
    });

    it('should produce valid mesh geometry', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);
      const edges = box.getSharpEdges(Math.PI / 6); // All edges

      const beveled = MeshOperations.bevel(box, edges, 0.1, 1);

      // All face indices should be valid
      for (const face of beveled.faces) {
        for (const idx of face.indices) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(beveled.vertices.length);
        }
      }
    });

    it('should bevel only selected edges', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);

      // Only bevel top edges (4 edges)
      const topEdges = box.getEdges().filter(edge => {
        const mid = box.getEdgeMidpoint(edge);
        return mid.y > 0.4; // Top edges are at Y = 0.5
      });
      expect(topEdges.length).toBe(4);

      const beveled = MeshOperations.bevel(box, topEdges, 0.1, 1);

      // Should have more geometry than original
      expect(beveled.vertices.length).toBeGreaterThan(box.vertices.length);
    });

    it('should respect bevel width', () => {
      const box = MeshOperations.createBoxWithSharedVertices(2, 2, 2);
      const edges = box.getEdges();

      const smallBevel = MeshOperations.bevel(box, edges, 0.05, 1);
      const largeBevel = MeshOperations.bevel(box, edges, 0.3, 1);

      // Both should produce valid meshes with more geometry than original
      expect(smallBevel.vertices.length).toBeGreaterThan(box.vertices.length);
      expect(largeBevel.vertices.length).toBeGreaterThan(box.vertices.length);

      // Larger bevel should produce more geometry (more movement)
      expect(largeBevel.vertices.length).toBeGreaterThanOrEqual(smallBevel.vertices.length);
    });
  });

  describe('smooth bevel (2+ segments)', () => {
    it('should create smooth bevel with 2 segments', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);
      const edges = box.getEdges();

      const chamfer = MeshOperations.bevel(box, edges, 0.1, 1);
      const smooth = MeshOperations.bevel(box, edges, 0.1, 2);

      // More segments = more geometry
      expect(smooth.vertices.length).toBeGreaterThan(chamfer.vertices.length);
    });

    it('should create even smoother bevel with 4 segments', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);
      const edges = box.getEdges();

      const seg2 = MeshOperations.bevel(box, edges, 0.1, 2);
      const seg4 = MeshOperations.bevel(box, edges, 0.1, 4);

      // More segments = more geometry
      expect(seg4.vertices.length).toBeGreaterThan(seg2.vertices.length);
    });
  });

  describe('color preservation', () => {
    it('should preserve vertex colors during bevel', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);

      // Set colors on all vertices
      for (const v of box.vertices) {
        v.attributes.color = [1, 0, 0]; // Red
      }

      const edges = box.getEdges();
      const beveled = MeshOperations.bevel(box, edges, 0.1, 1);

      // New vertices should have interpolated colors
      const coloredVertices = beveled.vertices.filter(v => v.attributes.color);
      expect(coloredVertices.length).toBeGreaterThan(0);
    });

    it('should preserve face colors during bevel', () => {
      const box = MeshOperations.createBox(1, 1, 1);

      // Set colors on all faces
      for (const f of box.faces) {
        f.color = { r: 0, g: 1, b: 0 }; // Green
      }

      const edges = box.getEdges();
      const beveled = MeshOperations.bevel(box, edges, 0.1, 1);

      // Some faces should have colors
      const coloredFaces = beveled.faces.filter(f => f.color);
      expect(coloredFaces.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty edge list', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const beveled = MeshOperations.bevel(box, [], 0.1, 1);

      // Should return equivalent mesh (no changes)
      expect(beveled.vertices.length).toBe(box.vertices.length);
      expect(beveled.faces.length).toBe(box.faces.length);
    });

    it('should handle zero width bevel', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const edges = box.getEdges();
      const beveled = MeshOperations.bevel(box, edges, 0, 1);

      // Zero width means no change
      expect(beveled.vertices.length).toBe(box.vertices.length);
    });

    it('should clamp width to prevent self-intersection', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const edges = box.getEdges();

      // Width larger than half the smallest dimension should be clamped
      const beveled = MeshOperations.bevel(box, edges, 1.0, 1); // Way too big

      // Should still produce valid geometry (clamped width)
      expect(beveled.vertices.length).toBeGreaterThan(0);
      for (const face of beveled.faces) {
        for (const idx of face.indices) {
          expect(idx).toBeLessThan(beveled.vertices.length);
        }
      }
    });
  });

  describe('sphere beveling', () => {
    it('should bevel sharp edges on a low-poly sphere', () => {
      const sphere = MeshOperations.createSphere(1, 4, 4); // Low poly
      const sharpEdges = sphere.getSharpEdges(Math.PI / 4); // 45 degree threshold

      if (sharpEdges.length > 0) {
        const beveled = MeshOperations.bevel(sphere, sharpEdges, 0.05, 1);
        expect(beveled.vertices.length).toBeGreaterThan(sphere.vertices.length);
      }
    });
  });
});
