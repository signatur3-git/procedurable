/**
 * Path2D Unit Tests
 *
 * Tests for bezier curve tessellation and path utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  tessellateQuadraticCurve,
  tessellateCubicCurve,
  pathToPolygon,
  calculatePathBounds,
  createRectPath,
  createCirclePath
} from '../../geometry/Path2D';
import type { Point2D, Path2D } from '../../geometry/Path2D';
import { Shape2D } from '../../geometry/Shape2D';

describe('Path2D', () => {
  describe('tessellateQuadraticCurve', () => {
    it('should return correct number of points', () => {
      const start: Point2D = { x: 0, z: 0 };
      const control: Point2D = { x: 0.5, z: 1 };
      const end: Point2D = { x: 1, z: 0 };

      const points = tessellateQuadraticCurve(start, control, end, 10);

      expect(points.length).toBe(11); // 10 segments = 11 points
    });

    it('should start at start point', () => {
      const start: Point2D = { x: 0, z: 0 };
      const control: Point2D = { x: 0.5, z: 1 };
      const end: Point2D = { x: 1, z: 0 };

      const points = tessellateQuadraticCurve(start, control, end, 10);

      expect(points[0].x).toBeCloseTo(0, 5);
      expect(points[0].z).toBeCloseTo(0, 5);
    });

    it('should end at end point', () => {
      const start: Point2D = { x: 0, z: 0 };
      const control: Point2D = { x: 0.5, z: 1 };
      const end: Point2D = { x: 1, z: 0 };

      const points = tessellateQuadraticCurve(start, control, end, 10);

      expect(points[points.length - 1].x).toBeCloseTo(1, 5);
      expect(points[points.length - 1].z).toBeCloseTo(0, 5);
    });

    it('should curve towards control point', () => {
      const start: Point2D = { x: 0, z: 0 };
      const control: Point2D = { x: 0.5, z: 1 };
      const end: Point2D = { x: 1, z: 0 };

      const points = tessellateQuadraticCurve(start, control, end, 10);

      // Middle point should be above the straight line (curved towards control)
      const midPoint = points[5];
      expect(midPoint.z).toBeGreaterThan(0);
      expect(midPoint.z).toBeLessThan(1); // But not as high as control
    });

    it('should handle straight line (control on line)', () => {
      const start: Point2D = { x: 0, z: 0 };
      const control: Point2D = { x: 0.5, z: 0 }; // On the line
      const end: Point2D = { x: 1, z: 0 };

      const points = tessellateQuadraticCurve(start, control, end, 10);

      // All points should be on z=0
      for (const point of points) {
        expect(point.z).toBeCloseTo(0, 5);
      }
    });

    it('should support adaptive tessellation with tolerance', () => {
      const start: Point2D = { x: 0, z: 0 };
      const control: Point2D = { x: 0.5, z: 0.1 };
      const end: Point2D = { x: 1, z: 0 };

      const points = tessellateQuadraticCurve(start, control, end, { tolerance: 1 });

      expect(points.length).toBe(2); // start + end
    });

    it('should respect maxSegments when using tolerance', () => {
      const start: Point2D = { x: 0, z: 0 };
      const control: Point2D = { x: 0.5, z: 1 };
      const end: Point2D = { x: 1, z: 0 };

      const points = tessellateQuadraticCurve(start, control, end, { tolerance: 0.001, maxSegments: 5 });

      expect(points.length).toBeLessThanOrEqual(6); // segments + start
    });
  });

  describe('tessellateCubicCurve', () => {
    it('should return correct number of points', () => {
      const start: Point2D = { x: 0, z: 0 };
      const control1: Point2D = { x: 0.25, z: 1 };
      const control2: Point2D = { x: 0.75, z: 1 };
      const end: Point2D = { x: 1, z: 0 };

      const points = tessellateCubicCurve(start, control1, control2, end, 10);

      expect(points.length).toBe(11);
    });

    it('should start at start point', () => {
      const start: Point2D = { x: 0, z: 0 };
      const control1: Point2D = { x: 0.25, z: 1 };
      const control2: Point2D = { x: 0.75, z: 1 };
      const end: Point2D = { x: 1, z: 0 };

      const points = tessellateCubicCurve(start, control1, control2, end, 10);

      expect(points[0].x).toBeCloseTo(0, 5);
      expect(points[0].z).toBeCloseTo(0, 5);
    });

    it('should end at end point', () => {
      const start: Point2D = { x: 0, z: 0 };
      const control1: Point2D = { x: 0.25, z: 1 };
      const control2: Point2D = { x: 0.75, z: 1 };
      const end: Point2D = { x: 1, z: 0 };

      const points = tessellateCubicCurve(start, control1, control2, end, 10);

      expect(points[points.length - 1].x).toBeCloseTo(1, 5);
      expect(points[points.length - 1].z).toBeCloseTo(0, 5);
    });

    it('should curve towards control points', () => {
      const start: Point2D = { x: 0, z: 0 };
      const control1: Point2D = { x: 0.25, z: 1 };
      const control2: Point2D = { x: 0.75, z: 1 };
      const end: Point2D = { x: 1, z: 0 };

      const points = tessellateCubicCurve(start, control1, control2, end, 10);

      // Middle point should be above the straight line
      const midPoint = points[5];
      expect(midPoint.z).toBeGreaterThan(0);
    });

    it('should create S-curve with opposing control points', () => {
      const start: Point2D = { x: 0, z: 0 };
      const control1: Point2D = { x: 0.25, z: 1 };  // Up
      const control2: Point2D = { x: 0.75, z: -1 }; // Down
      const end: Point2D = { x: 1, z: 0 };

      const points = tessellateCubicCurve(start, control1, control2, end, 20);

      // Early points should be above z=0, late points should be below
      expect(points[5].z).toBeGreaterThan(0);
      expect(points[15].z).toBeLessThan(0);
    });

    it('should support adaptive tessellation for cubic curves', () => {
      const start: Point2D = { x: 0, z: 0 };
      const control1: Point2D = { x: 0.25, z: 0.1 };
      const control2: Point2D = { x: 0.75, z: 0.1 };
      const end: Point2D = { x: 1, z: 0 };

      const points = tessellateCubicCurve(start, control1, control2, end, { tolerance: 1 });

      expect(points.length).toBe(2);
    });
  });

  describe('pathToPolygon', () => {
    it('should handle moveTo and lineTo only', () => {
      const path: Path2D = {
        segments: [
          { type: 'moveTo', point: { x: 0, z: 0 } },
          { type: 'lineTo', point: { x: 1, z: 0 } },
          { type: 'lineTo', point: { x: 1, z: 1 } },
          { type: 'lineTo', point: { x: 0, z: 1 } },
          { type: 'closePath' }
        ],
        closed: true
      };

      const points = pathToPolygon(path, 10);

      expect(points.length).toBe(4);
      expect(points[0]).toEqual({ x: 0, z: 0 });
      expect(points[1]).toEqual({ x: 1, z: 0 });
      expect(points[2]).toEqual({ x: 1, z: 1 });
      expect(points[3]).toEqual({ x: 0, z: 1 });
    });

    it('should tessellate quadratic curves', () => {
      const path: Path2D = {
        segments: [
          { type: 'moveTo', point: { x: 0, z: 0 } },
          { type: 'quadraticCurveTo', control: { x: 0.5, z: 1 }, end: { x: 1, z: 0 } },
          { type: 'closePath' }
        ],
        closed: true
      };

      const points = pathToPolygon(path, 10);

      // 1 moveTo + 10 curve segments = 11 points
      expect(points.length).toBe(11);
    });

    it('should tessellate cubic curves', () => {
      const path: Path2D = {
        segments: [
          { type: 'moveTo', point: { x: 0, z: 0 } },
          { type: 'cubicCurveTo', control1: { x: 0.25, z: 1 }, control2: { x: 0.75, z: 1 }, end: { x: 1, z: 0 } },
          { type: 'closePath' }
        ],
        closed: true
      };

      const points = pathToPolygon(path, 10);

      expect(points.length).toBe(11);
    });

    it('should handle mixed segments', () => {
      const path: Path2D = {
        segments: [
          { type: 'moveTo', point: { x: 0, z: 0 } },
          { type: 'lineTo', point: { x: 1, z: 0 } },
          { type: 'quadraticCurveTo', control: { x: 1.5, z: 0.5 }, end: { x: 1, z: 1 } },
          { type: 'lineTo', point: { x: 0, z: 1 } },
          { type: 'closePath' }
        ],
        closed: true
      };

      const points = pathToPolygon(path, 5);

      // 1 moveTo + 1 lineTo + 5 curve segments + 1 lineTo = 8 points
      expect(points.length).toBe(8);
    });
  });

  describe('calculatePathBounds', () => {
    it('should calculate bounds for rectangle path', () => {
      const path = createRectPath(2, 1, { x: 0, z: 0 });

      const bounds = calculatePathBounds(path);

      expect(bounds.xMin).toBeCloseTo(-1, 5);
      expect(bounds.xMax).toBeCloseTo(1, 5);
      expect(bounds.zMin).toBeCloseTo(-0.5, 5);
      expect(bounds.zMax).toBeCloseTo(0.5, 5);
    });

    it('should calculate bounds for circle path', () => {
      const path = createCirclePath(1, { x: 0, z: 0 });

      const bounds = calculatePathBounds(path, 32); // More segments for accuracy

      expect(bounds.xMin).toBeCloseTo(-1, 1);
      expect(bounds.xMax).toBeCloseTo(1, 1);
      expect(bounds.zMin).toBeCloseTo(-1, 1);
      expect(bounds.zMax).toBeCloseTo(1, 1);
    });

    it('should handle offset center', () => {
      const path = createRectPath(2, 2, { x: 5, z: 3 });

      const bounds = calculatePathBounds(path);

      expect(bounds.xMin).toBeCloseTo(4, 5);
      expect(bounds.xMax).toBeCloseTo(6, 5);
      expect(bounds.zMin).toBeCloseTo(2, 5);
      expect(bounds.zMax).toBeCloseTo(4, 5);
    });
  });

  describe('createRectPath', () => {
    it('should create rectangle at origin', () => {
      const path = createRectPath(2, 1);

      expect(path.segments.length).toBe(5); // moveTo + 3 lineTo + closePath
      expect(path.closed).toBe(true);
    });

    it('should create rectangle at specified center', () => {
      const path = createRectPath(2, 1, { x: 5, z: 3 });

      const points = pathToPolygon(path);

      // Check corners are at correct positions
      expect(points).toContainEqual({ x: 4, z: 2.5 });
      expect(points).toContainEqual({ x: 6, z: 2.5 });
      expect(points).toContainEqual({ x: 6, z: 3.5 });
      expect(points).toContainEqual({ x: 4, z: 3.5 });
    });
  });

  describe('createCirclePath', () => {
    it('should create circle with 4 cubic curves', () => {
      const path = createCirclePath(1);

      // moveTo + 4 cubicCurveTo + closePath = 6 segments
      expect(path.segments.length).toBe(6);
      expect(path.closed).toBe(true);

      // Check we have 4 cubic curves
      const cubicCount = path.segments.filter(s => s.type === 'cubicCurveTo').length;
      expect(cubicCount).toBe(4);
    });

    it('should approximate circle with high accuracy', () => {
      const path = createCirclePath(1, { x: 0, z: 0 });

      // Tessellate with high resolution
      const points = pathToPolygon(path, 32);

      // All points should be approximately distance 1 from center
      for (const point of points) {
        const distance = Math.sqrt(point.x * point.x + point.z * point.z);
        expect(distance).toBeCloseTo(1, 2); // Within 0.01 of radius
      }
    });

    it('should respect center offset', () => {
      const path = createCirclePath(1, { x: 5, z: 3 });

      const points = pathToPolygon(path, 32);

      // All points should be approximately distance 1 from (5, 3)
      for (const point of points) {
        const dx = point.x - 5;
        const dz = point.z - 3;
        const distance = Math.sqrt(dx * dx + dz * dz);
        expect(distance).toBeCloseTo(1, 2);
      }
    });
  });

  describe('Shape2D.fromPath Integration', () => {
    it('should create Shape2D from rectangle path', () => {
      const path = createRectPath(2, 1);

      const shape = Shape2D.fromPath(path);

      expect(shape.type).toBe('path');
      expect(shape.points.length).toBe(4);
    });

    it('should create Shape2D from circle path', () => {
      const path = createCirclePath(1);

      const shape = Shape2D.fromPath(path, 16); // 16 segments per curve

      expect(shape.type).toBe('path');
      // 4 cubic curves * 16 segments each = ~64 points (plus starting point)
      expect(shape.points.length).toBeGreaterThan(60);
    });

    it('should respect curveSegments parameter', () => {
      const path = createCirclePath(1);

      const lowRes = Shape2D.fromPath(path, 4);
      const highRes = Shape2D.fromPath(path, 20);

      // Higher resolution = more points
      expect(highRes.points.length).toBeGreaterThan(lowRes.points.length);
    });

    it('should create usable shape for extrusion', () => {
      const path = createRectPath(1, 1);

      const shape = Shape2D.fromPath(path);

      // Should have valid points for extrusion
      expect(shape.points.length).toBeGreaterThanOrEqual(3);

      // All points should have x and z coordinates
      for (const point of shape.points) {
        expect(typeof point.x).toBe('number');
        expect(typeof point.z).toBe('number');
        expect(isNaN(point.x)).toBe(false);
        expect(isNaN(point.z)).toBe(false);
      }
    });

    it('should preserve approximate circle shape', () => {
      const path = createCirclePath(1, { x: 0, z: 0 });

      const shape = Shape2D.fromPath(path, 32);

      // All points should be approximately distance 1 from origin
      for (const point of shape.points) {
        const distance = Math.sqrt(point.x * point.x + point.z * point.z);
        expect(distance).toBeCloseTo(1, 2);
      }
    });
  });
});
