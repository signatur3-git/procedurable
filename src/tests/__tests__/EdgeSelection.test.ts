/**
 * Edge Selection Tests (C2-001)
 *
 * Tests for mesh edge detection and selection functionality.
 * Uses createBoxWithSharedVertices for proper edge topology.
 */

import { describe, it, expect } from '@jest/globals';
import { Mesh } from '../../platform/geometry/Mesh';
import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { Vec3 } from '../../platform/math/Vec3';

describe('Edge Selection (C2-001)', () => {
  describe('getEdges', () => {
    it('should return all edges of a box', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);
      const edges = box.getEdges();

      // A box has 12 edges
      expect(edges.length).toBe(12);
    });

    it('should have correct vertex references', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);
      const edges = box.getEdges();

      for (const edge of edges) {
        expect(edge.vertexA).toBeGreaterThanOrEqual(0);
        expect(edge.vertexA).toBeLessThan(box.vertices.length);
        expect(edge.vertexB).toBeGreaterThanOrEqual(0);
        expect(edge.vertexB).toBeLessThan(box.vertices.length);
        // Canonical ordering
        expect(edge.vertexA).toBeLessThan(edge.vertexB);
      }
    });

    it('should have two adjacent faces for interior edges', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);
      const edges = box.getEdges();

      // All box edges are shared by exactly 2 faces
      for (const edge of edges) {
        expect(edge.faceLeft).toBeGreaterThanOrEqual(0);
        expect(edge.faceRight).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getSharpEdges', () => {
    it('should find all edges on a box (90 degree edges)', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);

      // All edges of a box are 90 degrees (PI/2 radians)
      // Threshold of 80 degrees should find all edges
      const threshold80 = (80 * Math.PI) / 180;
      const sharpEdges = box.getSharpEdges(threshold80);

      expect(sharpEdges.length).toBe(12);
    });

    it('should not find edges below threshold', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);

      // Threshold of 100 degrees - box edges are 90 degrees, should not match
      const threshold100 = (100 * Math.PI) / 180;
      const sharpEdges = box.getSharpEdges(threshold100);

      expect(sharpEdges.length).toBe(0);
    });

    it('should find edges at 30 degree threshold on box', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);

      // 30 degrees = common bevel threshold
      const threshold30 = Math.PI / 6;
      const sharpEdges = box.getSharpEdges(threshold30);

      // All 12 edges should be found (90 > 30)
      expect(sharpEdges.length).toBe(12);
    });
  });

  describe('getBoundaryEdges', () => {
    it('should return empty for closed box mesh', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);
      const boundaryEdges = box.getBoundaryEdges();

      // A closed box has no boundary edges
      expect(boundaryEdges.length).toBe(0);
    });

    it('should find boundary edges on open mesh', () => {
      // Create a simple quad (open mesh - single face)
      const mesh = new Mesh();
      mesh.addVertex({ position: new Vec3(0, 0, 0), attributes: {}, clone: () => mesh.vertices[0] } as any);
      mesh.addVertex({ position: new Vec3(1, 0, 0), attributes: {}, clone: () => mesh.vertices[1] } as any);
      mesh.addVertex({ position: new Vec3(1, 0, 1), attributes: {}, clone: () => mesh.vertices[2] } as any);
      mesh.addVertex({ position: new Vec3(0, 0, 1), attributes: {}, clone: () => mesh.vertices[3] } as any);
      mesh.addFace({ indices: [0, 1, 2, 3], triangulate: () => [], clone: () => mesh.faces[0] } as any);

      const boundaryEdges = mesh.getBoundaryEdges();

      // A single quad has 4 boundary edges
      expect(boundaryEdges.length).toBe(4);
    });
  });

  describe('tagEdges', () => {
    it('should tag edges matching selector', () => {
      const box = MeshOperations.createBoxWithSharedVertices(1, 1, 1);

      // Tag edges that are vertical (aligned with Y axis)
      const tagged = box.tagEdges((edge, mesh) => {
        const dir = mesh.getEdgeDirection(edge);
        return Math.abs(dir.y) > 0.9;  // Mostly vertical
      }, 'vertical');

      // A box has 4 vertical edges
      expect(tagged.length).toBe(4);
      for (const edge of tagged) {
        expect(edge.tag).toBe('vertical');
      }
    });

    it('should tag edges by position', () => {
      const box = MeshOperations.createBoxWithSharedVertices(2, 2, 2);

      // Tag edges at the top (Y = 1)
      const tagged = box.tagEdges((edge, mesh) => {
        const mid = mesh.getEdgeMidpoint(edge);
        return mid.y > 0.9;  // Top edges
      }, 'top');

      // A box has 4 edges at the top
      expect(tagged.length).toBe(4);
    });

    it('should retrieve tagged edges by tag name', () => {
      const box = MeshOperations.createBoxWithSharedVertices(2, 2, 2);

      // Tag vertical edges
      box.tagEdges((edge, mesh) => {
        const dir = mesh.getEdgeDirection(edge);
        return Math.abs(dir.y) > 0.9;
      }, 'vertical');

      // Tag top edges
      box.tagEdges((edge, mesh) => {
        const mid = mesh.getEdgeMidpoint(edge);
        return mid.y > 0.9;
      }, 'top');

      // Retrieve by tag
      const verticalEdges = box.getEdgesByTag('vertical');
      const topEdges = box.getEdgesByTag('top');
      const nonExistent = box.getEdgesByTag('nonexistent');

      expect(verticalEdges.length).toBe(4);
      expect(topEdges.length).toBe(4);
      expect(nonExistent.length).toBe(0);
    });
  });

  describe('edge utility methods', () => {
    it('getEdgeMidpoint should return center of edge', () => {
      const box = MeshOperations.createBoxWithSharedVertices(2, 2, 2);
      const edges = box.getEdges();

      // Find an edge and verify midpoint
      const edge = edges[0];
      const midpoint = box.getEdgeMidpoint(edge);
      const a = box.vertices[edge.vertexA].position;
      const b = box.vertices[edge.vertexB].position;

      expect(midpoint.x).toBeCloseTo((a.x + b.x) / 2);
      expect(midpoint.y).toBeCloseTo((a.y + b.y) / 2);
      expect(midpoint.z).toBeCloseTo((a.z + b.z) / 2);
    });

    it('getEdgeDirection should return normalized direction', () => {
      const box = MeshOperations.createBoxWithSharedVertices(2, 2, 2);
      const edges = box.getEdges();

      for (const edge of edges) {
        const dir = box.getEdgeDirection(edge);
        const length = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
        expect(length).toBeCloseTo(1.0);
      }
    });

    it('getEdgeLength should return correct length', () => {
      const box = MeshOperations.createBoxWithSharedVertices(2, 3, 4);
      const edges = box.getEdges();

      // All edges should have length 2, 3, or 4
      for (const edge of edges) {
        const length = box.getEdgeLength(edge);
        expect([2, 3, 4]).toContain(Math.round(length));
      }
    });
  });

  describe('sphere edges', () => {
    it('should have smooth edges on a sphere', () => {
      const sphere = MeshOperations.createSphere(1, 8, 8);

      // Sphere edges are smooth (small angle between adjacent faces)
      // Using a 45 degree threshold should find very few sharp edges
      const threshold45 = Math.PI / 4;
      const sharpEdges = sphere.getSharpEdges(threshold45);

      // Most sphere edges should be smooth
      const allEdges = sphere.getEdges();
      expect(sharpEdges.length).toBeLessThan(allEdges.length / 2);
    });
  });
});
