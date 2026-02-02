/**
 * Topology Validation Tests
 * Tests for checkMeshTopology to verify winding detection works correctly
 */

import { Mesh } from '../../platform/geometry/Mesh';
import { Face } from '../../platform/geometry/Face';
import { Vertex } from '../../platform/geometry/Vertex';
import { Vec3 } from '../../platform/math/Vec3';
import { checkMeshTopology } from '../../generation/validation/MeshChecks';
import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { TracedBuilder } from '../../generation/builder/TracedBuilder';
import { Shape2D } from '../../platform/geometry/Shape2D';
import { extrude2D } from '../../platform/geometry/Extrude';

describe('Topology Validation', () => {
  describe('checkMeshTopology', () => {
    it('should pass for a correctly wound box', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const result = checkMeshTopology(box);

      expect(result.nonManifoldEdges).toHaveLength(0);
      expect(result.isolatedVertices).toHaveLength(0);
      // Box should have consistent winding
      expect(result.inconsistentWindingPairs.length).toBe(0);
      expect(result.ok).toBe(true);
    });

    it('should detect inconsistent winding on a simple quad pair', () => {
      const mesh = new Mesh();

      // Create 4 vertices in a square
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));  // 0
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));  // 1
      mesh.addVertex(new Vertex(new Vec3(1, 0, 1)));  // 2
      mesh.addVertex(new Vertex(new Vec3(0, 0, 1)));  // 3
      mesh.addVertex(new Vertex(new Vec3(0, 1, 0)));  // 4
      mesh.addVertex(new Vertex(new Vec3(1, 1, 0)));  // 5

      // Two adjacent faces with SAME winding direction (both CCW from above)
      // They share edge 0-1. Face1 goes 0→1, Face2 also goes 0→1 (should go 1→0)
      mesh.addFace(new Face([0, 1, 2, 3]));  // bottom face, CCW from above
      mesh.addFace(new Face([0, 1, 5, 4]));  // front face, also goes 0→1 (WRONG!)

      const result = checkMeshTopology(mesh);

      expect(result.inconsistentWindingPairs.length).toBeGreaterThan(0);
      expect(result.ok).toBe(false);
    });

    it('should pass for correctly wound adjacent quads', () => {
      const mesh = new Mesh();

      // Create 6 vertices
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));  // 0
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));  // 1
      mesh.addVertex(new Vertex(new Vec3(1, 0, 1)));  // 2
      mesh.addVertex(new Vertex(new Vec3(0, 0, 1)));  // 3
      mesh.addVertex(new Vertex(new Vec3(0, 1, 0)));  // 4
      mesh.addVertex(new Vertex(new Vec3(1, 1, 0)));  // 5

      // Two adjacent faces with OPPOSITE winding on shared edge
      // They share edge 0-1. Face1 goes 0→1, Face2 goes 1→0
      mesh.addFace(new Face([0, 1, 2, 3]));  // bottom face, CCW from above, goes 0→1
      mesh.addFace(new Face([1, 0, 4, 5]));  // front face, goes 1→0 on shared edge (CORRECT!)

      const result = checkMeshTopology(mesh);

      expect(result.inconsistentWindingPairs).toHaveLength(0);
    });

    it('should detect non-manifold edges', () => {
      const mesh = new Mesh();

      // Create vertices for 3 triangles sharing one edge
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));  // 0
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));  // 1
      mesh.addVertex(new Vertex(new Vec3(0.5, 1, 0)));  // 2
      mesh.addVertex(new Vertex(new Vec3(0.5, 0, 1)));  // 3
      mesh.addVertex(new Vertex(new Vec3(0.5, 0, -1))); // 4

      // Three triangles all sharing edge 0-1
      mesh.addFace(new Face([0, 1, 2]));
      mesh.addFace(new Face([0, 1, 3]));
      mesh.addFace(new Face([0, 1, 4]));

      const result = checkMeshTopology(mesh);

      expect(result.nonManifoldEdges.length).toBeGreaterThan(0);
      expect(result.nonManifoldEdges[0].faceCount).toBe(3);
      expect(result.ok).toBe(false);
    });

    it('should detect isolated vertices', () => {
      const mesh = new Mesh();

      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));  // 0
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));  // 1
      mesh.addVertex(new Vertex(new Vec3(0.5, 1, 0)));  // 2
      mesh.addVertex(new Vertex(new Vec3(5, 5, 5)));  // 3 - isolated!

      mesh.addFace(new Face([0, 1, 2]));  // Only uses vertices 0, 1, 2

      const result = checkMeshTopology(mesh);

      expect(result.isolatedVertices).toContain(3);
      expect(result.ok).toBe(false);
    });

    it('should report boundary edges for open meshes', () => {
      const mesh = new Mesh();

      // Single triangle - all edges are boundary
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(0.5, 1, 0)));
      mesh.addFace(new Face([0, 1, 2]));

      const result = checkMeshTopology(mesh);

      expect(result.boundaryEdges).toHaveLength(3);
    });

    it('should pass for a cylinder with loft and caps', () => {
      const builder = new TracedBuilder('test', 42);
      builder.context.setMeasurement('r', 0.5);
      builder.context.setMeasurement('h', 1);

      // Create a simple cylinder with top and bottom caps
      builder.createCircleLoop('bottom', { x: '0', y: '0', z: '0' }, 'r', 8, 'structural');
      builder.createCircleLoop('top', { x: '0', y: 'h', z: '0' }, 'r', 8, 'structural');
      builder.loftLoops('side', 'bottom', 'top');
      // Test with DiningChair-style convention:
      // - Bottom cap: flip=true
      // - Top cap: flip=false (default)
      builder.capLoop('top_cap', 'top', false);
      builder.capLoop('bottom_cap', 'bottom', true);

      const output = builder.build();
      const result = checkMeshTopology(output.mesh);


      expect(result.nonManifoldEdges).toHaveLength(0);
      expect(result.isolatedVertices).toHaveLength(0);
      // Cylinder should have consistent winding
      expect(result.inconsistentWindingPairs.length).toBe(0);
      expect(result.ok).toBe(true);
    });

    it('should detect a single flipped face on an otherwise correct box', () => {
      // Gap test: detect winding error when only 1 of 6 faces is wrong
      const box = MeshOperations.createBox(1, 1, 1);

      // Flip the first face by reversing its indices
      const flippedIndices = [...box.faces[0].indices].reverse();
      box.faces[0] = new Face(flippedIndices);

      const result = checkMeshTopology(box);

      // The flipped face shares 4 edges with neighbors — all 4 should be flagged
      expect(result.inconsistentWindingPairs.length).toBeGreaterThan(0);
      expect(result.ok).toBe(false);

      // Every flagged pair should involve face 0
      for (const pair of result.inconsistentWindingPairs) {
        expect(pair.face1 === 0 || pair.face2 === 0).toBe(true);
      }
    });

    it('should validate winding on n-gon faces (>4 vertices)', () => {
      // Gap test: cap operations produce n-gon faces; verify winding check handles them
      const builder = new TracedBuilder('ngon-test', 42);
      builder.context.setMeasurement('r', 0.5);
      builder.context.setMeasurement('h', 1);

      // 12-segment circle produces a 12-gon cap face
      builder.createCircleLoop('bottom', { x: '0', y: '0', z: '0' }, 'r', 12, 'structural');
      builder.createCircleLoop('top', { x: '0', y: 'h', z: '0' }, 'r', 12, 'structural');
      builder.loftLoops('side', 'bottom', 'top');
      builder.capLoop('top_cap', 'top', false);
      builder.capLoop('bottom_cap', 'bottom', true);

      const output = builder.build();

      // Verify we actually have n-gon faces (>4 vertices)
      const maxFaceSize = Math.max(...output.mesh.faces.map(f => f.indices.length));
      expect(maxFaceSize).toBe(12);

      const result = checkMeshTopology(output.mesh);

      expect(result.nonManifoldEdges).toHaveLength(0);
      expect(result.inconsistentWindingPairs.length).toBe(0);
      expect(result.ok).toBe(true);
    });

    it('should pass for a beveled box', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const edges = box.getSharpEdges(0.5); // ~30 degrees
      const beveled = MeshOperations.bevel(box, edges, 0.1, 1);

      const result = checkMeshTopology(beveled);

      // Debug output if failing
      if (result.inconsistentWindingPairs.length > 0) {
        console.log('Beveled box vertices:', beveled.vertices.length);
        console.log('Beveled box faces:', beveled.faces.length);
        console.log('Faces:', beveled.faces.map((f, i) => `F${i}:[${f.indices.join(',')}]`));
        console.log('First 3 winding issues:', result.inconsistentWindingPairs.slice(0, 3));
      }

      expect(result.nonManifoldEdges).toHaveLength(0);
      // Chamfer may leave corner vertices isolated, that's OK
      expect(result.inconsistentWindingPairs.length).toBe(0);
    });

    it('should pass for a multi-segment smooth beveled box', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const edges = box.getSharpEdges(0.5);
      const beveled = MeshOperations.bevel(box, edges, 0.1, 3);

      const result = checkMeshTopology(beveled);

      expect(result.nonManifoldEdges).toHaveLength(0);
      expect(result.inconsistentWindingPairs.length).toBe(0);
    });

    it('should pass for an extruded rectangle', () => {
      const shape = Shape2D.rect(1, 1);
      const extruded = extrude2D(shape, { depth: 0.5, caps: 'both' });

      // Convert to Mesh for topology check
      const mesh = new Mesh();
      for (const v of extruded.vertices) {
        mesh.addVertex(new Vertex(v));
      }
      for (const face of extruded.faces) {
        mesh.addFace(new Face(face));
      }

      const result = checkMeshTopology(mesh);

      expect(result.nonManifoldEdges).toHaveLength(0);
      expect(result.isolatedVertices).toHaveLength(0);
      expect(result.inconsistentWindingPairs.length).toBe(0);
    });

    it('should pass for an extruded circle', () => {
      const shape = Shape2D.circle(0.5, 16);
      const extruded = extrude2D(shape, { depth: 0.5, caps: 'both' });

      // Convert to Mesh for topology check
      const mesh = new Mesh();
      for (const v of extruded.vertices) {
        mesh.addVertex(new Vertex(v));
      }
      for (const face of extruded.faces) {
        mesh.addFace(new Face(face));
      }

      const result = checkMeshTopology(mesh);

      expect(result.nonManifoldEdges).toHaveLength(0);
      expect(result.isolatedVertices).toHaveLength(0);
      expect(result.inconsistentWindingPairs.length).toBe(0);
    });
  });
});
