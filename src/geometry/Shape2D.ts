/**
 * Shape2D - 2D Shape Primitives
 *
 * Foundation for extrusion and 2D boolean operations.
 * Represents closed 2D shapes as arrays of points.
 */

import { Vec3 } from '../core/Vec3';
import { Path2D as Path2DType, pathToPolygon } from './Path2D';

/**
 * 2D Point in XZ plane (Y=0)
 */
export interface Point2D {
  x: number;
  z: number;
}

/**
 * 2D Shape type
 */
export type Shape2DType = 'rect' | 'circle' | 'polygon' | 'ellipse' | 'path';

/**
 * Rectangle definition
 */
export interface RectDef {
  type: 'rect';
  width: number;
  height: number;
  center?: Point2D;
}

/**
 * Circle definition
 */
export interface CircleDef {
  type: 'circle';
  radius: number;
  segments?: number;
  center?: Point2D;
}

/**
 * Polygon definition (explicit points)
 */
export interface PolygonDef {
  type: 'polygon';
  points: Point2D[];
}

/**
 * Ellipse definition
 */
export interface EllipseDef {
  type: 'ellipse';
  radiusX: number;
  radiusZ: number;
  segments?: number;
  center?: Point2D;
}

/**
 * Path definition (bezier curves) - true vector graphics
 */
export interface PathDef {
  type: 'path';
  path: Path2DType;
  curveSegments?: number;  // Tessellation resolution (default: 10)
}

/**
 * Shape2D definition union
 */
export type Shape2DDef = RectDef | CircleDef | PolygonDef | EllipseDef | PathDef;

/**
 * 2D Shape - closed loop of points
 */
export class Shape2D {
  public readonly points: Point2D[];
  public readonly type: Shape2DType;

  constructor(points: Point2D[], type: Shape2DType = 'polygon') {
    this.points = points;
    this.type = type;
  }

  /**
   * Create rectangle shape
   */
  static rect(width: number, height: number, center: Point2D = { x: 0, z: 0 }): Shape2D {
    const hw = width / 2;
    const hh = height / 2;
    const points: Point2D[] = [
      { x: center.x - hw, z: center.z - hh },
      { x: center.x + hw, z: center.z - hh },
      { x: center.x + hw, z: center.z + hh },
      { x: center.x - hw, z: center.z + hh }
    ];
    return new Shape2D(points, 'rect');
  }

  /**
   * Create circle shape
   */
  static circle(radius: number, segments: number = 32, center: Point2D = { x: 0, z: 0 }): Shape2D {
    const points: Point2D[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: center.x + Math.cos(angle) * radius,
        z: center.z + Math.sin(angle) * radius
      });
    }
    return new Shape2D(points, 'circle');
  }

  /**
   * Create polygon from explicit points
   */
  static polygon(points: Point2D[]): Shape2D {
    if (points.length < 3) {
      throw new Error('Polygon must have at least 3 points');
    }
    // Deep copy points to avoid shared references
    const pointsCopy = points.map(p => ({ x: p.x, z: p.z }));
    return new Shape2D(pointsCopy, 'polygon');
  }

  /**
   * Create shape from a Path2D (with bezier curves)
   * This tessellates the curves into a polygon for use with existing extrusion
   *
   * @param path The Path2D with curves
   * @param curveSegments Number of line segments per curve (higher = smoother)
   */
  static fromPath(path: Path2DType, curveSegments: number = 10): Shape2D {
    const points = pathToPolygon(path, curveSegments);
    if (points.length < 3) {
      throw new Error('Path must generate at least 3 points');
    }
    // Convert Path2DPoint to Shape2D Point2D (same structure, but ensures compatibility)
    const shapePoints: Point2D[] = points.map(p => ({ x: p.x, z: p.z }));
    return new Shape2D(shapePoints, 'path');
  }

  /**
   * Create ellipse shape
   */
  static ellipse(radiusX: number, radiusZ: number, segments: number = 32, center: Point2D = { x: 0, z: 0 }): Shape2D {
    const points: Point2D[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: center.x + Math.cos(angle) * radiusX,
        z: center.z + Math.sin(angle) * radiusZ
      });
    }
    return new Shape2D(points, 'ellipse');
  }

  /**
   * Create shape from definition object
   */
  static fromDef(def: Shape2DDef): Shape2D {
    switch (def.type) {
      case 'rect':
        return Shape2D.rect(def.width, def.height, def.center);
      case 'circle':
        return Shape2D.circle(def.radius, def.segments || 32, def.center);
      case 'polygon':
        return Shape2D.polygon(def.points);
      case 'ellipse':
        return Shape2D.ellipse(def.radiusX, def.radiusZ, def.segments || 32, def.center);
      default:
        throw new Error(`Unknown shape type: ${(def as any).type}`);
    }
  }

  /**
   * Convert 2D points to 3D vertices (in XZ plane at Y=0)
   */
  to3D(y: number = 0): Vec3[] {
    return this.points.map(p => new Vec3(p.x, y, p.z));
  }

  /**
   * Get bounds of shape
   */
  getBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    if (this.points.length === 0) {
      return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    }

    let minX = this.points[0].x;
    let maxX = this.points[0].x;
    let minZ = this.points[0].z;
    let maxZ = this.points[0].z;

    for (const p of this.points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }

    return { minX, maxX, minZ, maxZ };
  }

  /**
   * Calculate area of 2D shape using shoelace formula
   */
  getArea(): number {
    if (this.points.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < this.points.length; i++) {
      const p1 = this.points[i];
      const p2 = this.points[(i + 1) % this.points.length];
      area += p1.x * p2.z - p2.x * p1.z;
    }
    return Math.abs(area) / 2;
  }

  /**
   * Check if shape is clockwise
   */
  isClockwise(): boolean {
    let sum = 0;
    for (let i = 0; i < this.points.length; i++) {
      const p1 = this.points[i];
      const p2 = this.points[(i + 1) % this.points.length];
      sum += (p2.x - p1.x) * (p2.z + p1.z);
    }
    return sum > 0;
  }

  /**
   * Reverse point order (flip winding)
   */
  reverse(): Shape2D {
    const reversedPoints = [...this.points].reverse().map(p => ({ x: p.x, z: p.z }));
    return new Shape2D(reversedPoints, this.type);
  }

  /**
   * Translate shape by offset
   */
  translate(dx: number, dz: number): Shape2D {
    const points = this.points.map(p => ({ x: p.x + dx, z: p.z + dz }));
    return new Shape2D(points, this.type);
  }

  /**
   * Scale shape by factor
   */
  scale(sx: number, sz: number = sx): Shape2D {
    const points = this.points.map(p => ({ x: p.x * sx, z: p.z * sz }));
    return new Shape2D(points, this.type);
  }

  /**
   * Rotate shape around center point
   */
  rotate(angleRadians: number, center: Point2D = { x: 0, z: 0 }): Shape2D {
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);

    const points = this.points.map(p => {
      const dx = p.x - center.x;
      const dz = p.z - center.z;
      return {
        x: center.x + dx * cos - dz * sin,
        z: center.z + dx * sin + dz * cos
      };
    });

    return new Shape2D(points, this.type);
  }

  /**
   * Clone shape
   */
  clone(): Shape2D {
    // Deep copy points array
    const pointsCopy = this.points.map(p => ({ x: p.x, z: p.z }));
    return new Shape2D(pointsCopy, this.type);
  }
}
