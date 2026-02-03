/**
 * Extrude Tests
 */

import { extrude2D, extrudeShape } from '../../platform/geometry/Extrude';
import { Shape2D } from '../../platform/geometry/Shape2D';

describe('Extrude', () => {
  describe('Basic Extrusion', () => {
    it('should extrude a square with both caps', () => {
      const shape = Shape2D.rect(1, 1);
      const result = extrude2D(shape, { depth: 2, caps: 'both' });

      // 4 points × 2 (front + back sides) + 4 × 2 (front + back cap vertices) = 16 vertices
      // G3-001: Caps now have separate vertices with planar UVs
      expect(result.vertices.length).toBe(16);
      expect(result.normals.length).toBe(16);

      // 4 side quads (2 tris each) + 2 caps (2 tris each) = 12 triangles
      expect(result.faces.length).toBe(12);

      // Check front side vertices are at Y=0
      expect(result.vertices[0].y).toBe(0);
      expect(result.vertices[1].y).toBe(0);
      expect(result.vertices[2].y).toBe(0);
      expect(result.vertices[3].y).toBe(0);

      // Check back side vertices are at Y=2
      expect(result.vertices[4].y).toBe(2);
      expect(result.vertices[5].y).toBe(2);
      expect(result.vertices[6].y).toBe(2);
      expect(result.vertices[7].y).toBe(2);
    });

    it('should extrude a circle', () => {
      const shape = Shape2D.circle(1, 8); // 8-sided circle approximation
      const result = extrude2D(shape, { depth: 1, caps: 'both' });

      // 8 points × 2 (sides) + 8 × 2 (cap vertices) = 32 vertices
      // G3-001: Caps now have separate vertices with planar UVs
      expect(result.vertices.length).toBe(32);

      // 8 side quads (16 tris) + 2 caps (6 tris each) = 28 triangles
      expect(result.faces.length).toBe(28);

      // All faces should have 3 vertices (triangles)
      for (const face of result.faces) {
        expect(face.length).toBe(3);
      }
    });

    it('should respect offset parameter', () => {
      const shape = Shape2D.rect(1, 1);
      const result = extrude2D(shape, { depth: 1, offset: 5, caps: 'both' });

      // Front side face should be at Y=5
      expect(result.vertices[0].y).toBe(5);
      // Back side face should be at Y=6
      expect(result.vertices[4].y).toBe(6);
    });
  });

  describe('Cap Options', () => {
    it('should create no caps when caps=none', () => {
      const shape = Shape2D.rect(1, 1);
      const result = extrude2D(shape, { depth: 1, caps: 'none' });

      // 4 side quads (8 tris), no caps
      expect(result.faces.length).toBe(8);
    });

    it('should create only front cap when caps=front', () => {
      const shape = Shape2D.rect(1, 1);
      const result = extrude2D(shape, { depth: 1, caps: 'front' });

      // 4 side quads (8 tris) + front cap (2 tris) = 10 triangles
      expect(result.faces.length).toBe(10);
    });

    it('should create only back cap when caps=back', () => {
      const shape = Shape2D.rect(1, 1);
      const result = extrude2D(shape, { depth: 1, caps: 'back' });

      // 4 side quads (8 tris) + back cap (2 tris) = 10 triangles
      expect(result.faces.length).toBe(10);
    });

    it('should create both caps by default', () => {
      const shape = Shape2D.rect(1, 1);
      const result = extrude2D(shape, { depth: 1 }); // caps defaults to 'both'

      // 4 side quads (8 tris) + 2 caps (4 tris) = 12 triangles
      expect(result.faces.length).toBe(12);
    });
  });

  describe('Normals', () => {
    it('should generate normals for all vertices', () => {
      const shape = Shape2D.rect(1, 1);
      const result = extrude2D(shape, { depth: 1, caps: 'both' });

      expect(result.normals.length).toBe(result.vertices.length);

      // All normals should be unit length (or close to it)
      for (const normal of result.normals) {
        const length = normal.length();
        expect(length).toBeGreaterThan(0.99);
        expect(length).toBeLessThan(1.01);
      }
    });

    it('should have valid normals on all axes', () => {
      const shape = Shape2D.rect(2, 2);
      const result = extrude2D(shape, { depth: 1, caps: 'both' });

      // Check that we have normals pointing in various directions
      let hasPositiveX = false;
      let hasNegativeX = false;
      let hasPositiveZ = false;
      let hasNegativeZ = false;

      for (const normal of result.normals) {
        if (normal.x > 0.5) hasPositiveX = true;
        if (normal.x < -0.5) hasNegativeX = true;
        if (normal.z > 0.5) hasPositiveZ = true;
        if (normal.z < -0.5) hasNegativeZ = true;
      }

      // Box should have normals in all cardinal directions
      expect(hasPositiveX).toBe(true);
      expect(hasNegativeX).toBe(true);
      expect(hasPositiveZ).toBe(true);
      expect(hasNegativeZ).toBe(true);
    });
  });

  describe('Geometry Validation', () => {
    it('should create valid face indices', () => {
      const shape = Shape2D.circle(1, 16);
      const result = extrude2D(shape, { depth: 1, caps: 'both' });

      const vertexCount = result.vertices.length;

      // All face indices should be valid
      for (const face of result.faces) {
        for (const idx of face) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(vertexCount);
        }
      }
    });

    it('should not have degenerate faces', () => {
      const shape = Shape2D.rect(1, 1);
      const result = extrude2D(shape, { depth: 1, caps: 'both' });

      // No face should have duplicate indices
      for (const face of result.faces) {
        const unique = new Set(face);
        expect(unique.size).toBe(face.length);
      }
    });

    it('should handle various depths', () => {
      const shape = Shape2D.circle(1, 8);

      const thin = extrude2D(shape, { depth: 0.1, caps: 'both' });
      expect(thin.vertices[0].y).toBe(0);
      expect(thin.vertices[8].y).toBeCloseTo(0.1);

      const thick = extrude2D(shape, { depth: 10, caps: 'both' });
      expect(thick.vertices[0].y).toBe(0);
      expect(thick.vertices[8].y).toBe(10);
    });
  });

  describe('extrudeShape Helper', () => {
    it('should extrude rect from parameters', () => {
      const result = extrudeShape({ type: 'rect', width: 2, height: 1 }, { depth: 1, caps: 'both' });

      // 4 × 2 (sides) + 4 × 2 (caps) = 16 vertices (G3-001)
      expect(result.vertices.length).toBe(16);
      expect(result.faces.length).toBe(12);
    });

    it('should extrude circle from parameters', () => {
      const result = extrudeShape({ type: 'circle', radius: 1, segments: 12 }, { depth: 2, caps: 'both' });

      // 12 × 2 (sides) + 12 × 2 (caps) = 48 vertices (G3-001)
      expect(result.vertices.length).toBe(48);
      expect(result.faces.length).toBeGreaterThan(20); // sides + caps
    });

    it('should extrude ellipse from parameters', () => {
      const result = extrudeShape({ type: 'ellipse', radiusX: 2, radiusZ: 1, segments: 8 }, { depth: 1 });

      // 8 × 2 (sides) + 8 × 2 (caps) = 32 vertices (G3-001)
      expect(result.vertices.length).toBe(32);
    });

    it('should extrude polygon from points', () => {
      const points = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0.5, z: 1 }
      ];
      const result = extrudeShape({ type: 'polygon', points }, { depth: 1, caps: 'both' });

      // 3 × 2 (sides) + 3 × 2 (caps) = 12 vertices (G3-001)
      expect(result.vertices.length).toBe(12);
      expect(result.faces.length).toBe(8); // 3 side quads (6 tris) + 2 caps (1 tri each)
    });

    it('should throw on unknown shape type', () => {
      expect(() => {
        extrudeShape({ type: 'unknown' } as any, { depth: 1 });
      }).toThrow();
    });
  });

  describe('Complex Shapes', () => {
    it('should handle transformed shapes', () => {
      const shape = Shape2D.rect(1, 1)
        .translate(5, 3)
        .scale(2);

      const result = extrude2D(shape, { depth: 1, caps: 'both' });

      // Should still create valid geometry
      // 4 × 2 (sides) + 4 × 2 (caps) = 16 vertices (G3-001)
      expect(result.vertices.length).toBe(16);
      expect(result.faces.length).toBe(12);

      // Vertices should be transformed
      // Original rect is 1x1 centered at (0,0), so corners at (-0.5,-0.5) to (0.5,0.5)
      // After translate(5,3): (-0.5+5,-0.5+3) to (0.5+5,0.5+3) = (4.5,2.5) to (5.5,3.5)
      // After scale(2): (4.5*2, 2.5*2) to (5.5*2, 3.5*2) = (9,5) to (11,7)
      const bounds = {
        minX: Math.min(...result.vertices.map(v => v.x)),
        maxX: Math.max(...result.vertices.map(v => v.x)),
        minZ: Math.min(...result.vertices.map(v => v.z)),
        maxZ: Math.max(...result.vertices.map(v => v.z))
      };

      expect(bounds.minX).toBeCloseTo(9, 1);
      expect(bounds.maxX).toBeCloseTo(11, 1);
      expect(bounds.minZ).toBeCloseTo(5, 1);
      expect(bounds.maxZ).toBeCloseTo(7, 1);
    });

    it('should handle high-poly shapes', () => {
      const shape = Shape2D.circle(1, 64); // High detail circle
      const result = extrude2D(shape, { depth: 1, caps: 'both' });

      // 64 × 2 (sides) + 64 × 2 (caps) = 256 vertices (G3-001)
      expect(result.vertices.length).toBe(256);
      expect(result.faces.length).toBeGreaterThan(100);

      // All normals should still be valid
      for (const normal of result.normals) {
        const length = normal.length();
        expect(length).toBeGreaterThan(0.99);
        expect(length).toBeLessThan(1.01);
      }
    });
  });

  describe('Bevel & Chamfer (P2M3-003)', () => {
    it('should add chamfer with segments=1', () => {
      const shape = Shape2D.rect(2, 1);
      // Compare with caps='none' to avoid cap vertex count differences
      const plain = extrude2D(shape, { depth: 1, caps: 'none' });
      const chamfered = extrude2D(shape, {
        depth: 1,
        caps: 'none',
        bevel: { size: 0.1, segments: 1 }
      });

      // Chamfered version has more vertices (additional layers)
      expect(chamfered.vertices.length).toBeGreaterThan(plain.vertices.length);
      expect(chamfered.faces.length).toBeGreaterThan(plain.faces.length);

      // Should have at least 4 layers: front, front-bevel, back-bevel, back
      expect(chamfered.vertices.length).toBeGreaterThanOrEqual(16); // 4 × 4 points
    });

    it('should add rounded bevel with segments>1', () => {
      const shape = Shape2D.rect(2, 1);
      const chamfered = extrude2D(shape, {
        depth: 1,
        caps: 'both',
        bevel: { size: 0.1, segments: 1 }
      });
      const beveled = extrude2D(shape, {
        depth: 1,
        caps: 'both',
        bevel: { size: 0.1, segments: 3 }
      });

      // Rounded bevel has more vertices than chamfer
      expect(beveled.vertices.length).toBeGreaterThan(chamfered.vertices.length);

      // More segments = smoother bevel
      const beveledMore = extrude2D(shape, {
        depth: 1,
        caps: 'both',
        bevel: { size: 0.1, segments: 5 }
      });
      expect(beveledMore.vertices.length).toBeGreaterThan(beveled.vertices.length);
    });

    it('should clamp bevel size to depth/2', () => {
      const shape = Shape2D.rect(1, 1);

      // Bevel size larger than depth/2 should be clamped
      const result = extrude2D(shape, {
        depth: 0.2,
        caps: 'both',
        bevel: { size: 0.5, segments: 1 } // Would be too large
      });

      // Should still produce valid geometry
      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.faces.length).toBeGreaterThan(0);

      // Verify normals are valid
      for (const normal of result.normals) {
        const length = normal.length();
        expect(length).toBeGreaterThan(0.99);
        expect(length).toBeLessThan(1.01);
      }
    });

    it('should work with circular shapes', () => {
      const shape = Shape2D.circle(1, 16);
      const beveled = extrude2D(shape, {
        depth: 1,
        caps: 'both',
        bevel: { size: 0.1, segments: 2 }
      });

      // Should have vertices for each segment of the circle at each layer
      expect(beveled.vertices.length).toBeGreaterThan(16 * 2);
      expect(beveled.faces.length).toBeGreaterThan(0);

      // All vertices should have normals
      expect(beveled.normals.length).toBe(beveled.vertices.length);
    });
  });
});
