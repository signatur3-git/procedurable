/**
 * Shape2D Tests
 */

import { Shape2D, Point2D } from '../../geometry/Shape2D';
import { createRectPath } from '../../geometry/Path2D';

describe('Shape2D', () => {
  describe('Rectangle', () => {
    it('should create centered rectangle', () => {
      const shape = Shape2D.rect(2, 1, { x: 0, z: 0 });
      expect(shape.points.length).toBe(4);
      expect(shape.type).toBe('rect');

      // Check corners
      expect(shape.points[0]).toEqual({ x: -1, z: -0.5 }); // bottom-left
      expect(shape.points[1]).toEqual({ x: 1, z: -0.5 });  // bottom-right
      expect(shape.points[2]).toEqual({ x: 1, z: 0.5 });   // top-right
      expect(shape.points[3]).toEqual({ x: -1, z: 0.5 });  // top-left
    });

    it('should create offset rectangle', () => {
      const shape = Shape2D.rect(1, 1, { x: 5, z: 3 });
      expect(shape.points[0]).toEqual({ x: 4.5, z: 2.5 });
      expect(shape.points[2]).toEqual({ x: 5.5, z: 3.5 });
    });
  });

  describe('Circle', () => {
    it('should create circle with correct number of segments', () => {
      const shape = Shape2D.circle(1, 8);
      expect(shape.points.length).toBe(8);
      expect(shape.type).toBe('circle');
    });

    it('should have points at radius distance from center', () => {
      const shape = Shape2D.circle(2, 16, { x: 0, z: 0 });
      for (const p of shape.points) {
        const dist = Math.sqrt(p.x * p.x + p.z * p.z);
        expect(dist).toBeCloseTo(2, 5);
      }
    });

    it('should start at angle 0 (positive X)', () => {
      const shape = Shape2D.circle(1, 4);
      expect(shape.points[0].x).toBeCloseTo(1, 5);
      expect(shape.points[0].z).toBeCloseTo(0, 5);
    });
  });

  describe('Polygon', () => {
    it('should create polygon from points', () => {
      const points: Point2D[] = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0.5, z: 1 }
      ];
      const shape = Shape2D.polygon(points);
      expect(shape.points.length).toBe(3);
      expect(shape.type).toBe('polygon');
      expect(shape.points).toEqual(points);
    });

    it('should require at least 3 points', () => {
      expect(() => Shape2D.polygon([{ x: 0, z: 0 }, { x: 1, z: 0 }])).toThrow();
    });
  });

  describe('Ellipse', () => {
    it('should create ellipse with different radii', () => {
      const shape = Shape2D.ellipse(2, 1, 16);
      expect(shape.points.length).toBe(16);
      expect(shape.type).toBe('ellipse');

      // Check that points are at correct distances
      const p0 = shape.points[0];
      const p4 = shape.points[4];
      expect(Math.abs(p0.x)).toBeCloseTo(2, 5); // X radius
      expect(Math.abs(p4.z)).toBeCloseTo(1, 5); // Z radius
    });
  });

  describe('fromDef', () => {
    it('should create rect from definition', () => {
      const shape = Shape2D.fromDef({ type: 'rect', width: 2, height: 1 });
      expect(shape.type).toBe('rect');
      expect(shape.points.length).toBe(4);
    });

    it('should create circle from definition', () => {
      const shape = Shape2D.fromDef({ type: 'circle', radius: 1, segments: 12 });
      expect(shape.type).toBe('circle');
      expect(shape.points.length).toBe(12);
    });

    it('should create polygon from definition', () => {
      const points: Point2D[] = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 }
      ];
      const shape = Shape2D.fromDef({ type: 'polygon', points });
      expect(shape.type).toBe('polygon');
      expect(shape.points).toEqual(points);
    });

    it('should create ellipse from definition', () => {
      const shape = Shape2D.fromDef({ type: 'ellipse', radiusX: 2, radiusZ: 1, segments: 16 });
      expect(shape.type).toBe('ellipse');
      expect(shape.points.length).toBe(16);
    });

    it('should create path from definition', () => {
      const path = createRectPath(2, 1, { x: 1, z: -1 });
      const shape = Shape2D.fromDef({ type: 'path', path, curveSegments: 8 });
      expect(shape.type).toBe('path');
      expect(shape.points.length).toBeGreaterThan(3);
    });
  });

  describe('Geometry Queries', () => {
    it('should calculate bounds', () => {
      const shape = Shape2D.rect(4, 2, { x: 1, z: 0 });
      const bounds = shape.getBounds();
      expect(bounds.minX).toBeCloseTo(-1, 5);
      expect(bounds.maxX).toBeCloseTo(3, 5);
      expect(bounds.minZ).toBeCloseTo(-1, 5);
      expect(bounds.maxZ).toBeCloseTo(1, 5);
    });

    it('should calculate area of rectangle', () => {
      const shape = Shape2D.rect(4, 2);
      const area = shape.getArea();
      expect(area).toBeCloseTo(8, 5);
    });

    it('should calculate area of circle approximately', () => {
      const shape = Shape2D.circle(1, 64); // High segment count for accuracy
      const area = shape.getArea();
      expect(area).toBeCloseTo(Math.PI, 1); // Within 0.1
    });

    it('should detect clockwise winding', () => {
      // Counter-clockwise square (default)
      const ccw = Shape2D.rect(1, 1);
      expect(ccw.isClockwise()).toBe(false);

      // Reversed should be clockwise
      const cw = ccw.reverse();
      expect(cw.isClockwise()).toBe(true);
    });
  });

  describe('Transformations', () => {
    it('should translate shape', () => {
      const shape = Shape2D.rect(2, 2).translate(5, 3);
      const bounds = shape.getBounds();
      expect(bounds.minX).toBeCloseTo(4, 5);
      expect(bounds.maxX).toBeCloseTo(6, 5);
      expect(bounds.minZ).toBeCloseTo(2, 5);
      expect(bounds.maxZ).toBeCloseTo(4, 5);
    });

    it('should scale shape uniformly', () => {
      const shape = Shape2D.rect(2, 2).scale(2);
      const bounds = shape.getBounds();
      expect(bounds.maxX - bounds.minX).toBeCloseTo(4, 5);
      expect(bounds.maxZ - bounds.minZ).toBeCloseTo(4, 5);
    });

    it('should scale shape non-uniformly', () => {
      const shape = Shape2D.rect(2, 2).scale(2, 0.5);
      const bounds = shape.getBounds();
      expect(bounds.maxX - bounds.minX).toBeCloseTo(4, 5);
      expect(bounds.maxZ - bounds.minZ).toBeCloseTo(1, 5);
    });

    it('should rotate shape 90 degrees', () => {
      const shape = Shape2D.rect(2, 1).rotate(Math.PI / 2);
      const bounds = shape.getBounds();
      // After 90° rotation, width and height swap
      expect(bounds.maxX - bounds.minX).toBeCloseTo(1, 5); // Original height
      expect(bounds.maxZ - bounds.minZ).toBeCloseTo(2, 5); // Original width
    });

    it('should chain transformations', () => {
      const shape = Shape2D.rect(1, 1)
        .scale(2)
        .rotate(Math.PI / 4)
        .translate(5, 5);

      const bounds = shape.getBounds();
      expect(bounds.minX).toBeGreaterThan(3); // Rotated and translated
      expect(bounds.minZ).toBeGreaterThan(3);
    });
  });

  describe('3D Conversion', () => {
    it('should convert to 3D vertices', () => {
      const shape = Shape2D.rect(2, 1);
      const vertices = shape.to3D(0);
      expect(vertices.length).toBe(4);
      expect(vertices[0].y).toBe(0);
      expect(vertices[0].x).toBeCloseTo(-1, 5);
      expect(vertices[0].z).toBeCloseTo(-0.5, 5);
    });

    it('should convert to 3D at specific Y height', () => {
      const shape = Shape2D.circle(1, 8);
      const vertices = shape.to3D(2.5);
      expect(vertices.length).toBe(8);
      for (const v of vertices) {
        expect(v.y).toBe(2.5);
      }
    });
  });

  describe('Reverse', () => {
    it('should reverse point order', () => {
      const shape = Shape2D.polygon([
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 1, z: 1 }
      ]);
      const reversed = shape.reverse();
      expect(reversed.points[0]).toEqual({ x: 1, z: 1 });
      expect(reversed.points[1]).toEqual({ x: 1, z: 0 });
      expect(reversed.points[2]).toEqual({ x: 0, z: 0 });
    });

    it('should flip winding direction', () => {
      const shape = Shape2D.rect(1, 1);
      const original = shape.isClockwise();
      const reversed = shape.reverse();
      expect(reversed.isClockwise()).toBe(!original);
    });
  });

  describe('Clone', () => {
    it('should create independent copy', () => {
      const original = Shape2D.rect(1, 1);
      const originalFirstPoint = original.points[0];
      const originalFirstX = originalFirstPoint.x;

      const cloned = original.clone();
      const clonedFirstPoint = cloned.points[0];

      // Values should be equal
      expect(clonedFirstPoint.x).toBe(originalFirstX);
      expect(cloned.points).toEqual(original.points);
      expect(cloned.type).toBe(original.type);

      // But objects should be different
      expect(cloned.points).not.toBe(original.points);
      expect(clonedFirstPoint).not.toBe(originalFirstPoint);

      // Modify clone's point
      clonedFirstPoint.x = 999;

      // Original should be unchanged
      expect(originalFirstPoint.x).toBe(originalFirstX);
      expect(original.points[0].x).toBe(originalFirstX);
    });
  });
});
