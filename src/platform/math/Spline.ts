/**
 * Spline - Parametric curves for defining profiles and paths
 *
 * Supports:
 * - Catmull-Rom splines (smooth through all control points)
 * - Cubic Bézier splines (explicit tangent control)
 *
 * Used for:
 * - Body profile curves (torso silhouette)
 * - Limb paths (shoulder → elbow → wrist)
 * - Facial feature curves
 */

import { Vec3 } from './Vec3';

export type SplineType = 'catmull-rom' | 'bezier';

export interface SplinePoint {
  position: Vec3;
  tangent?: Vec3;  // For Bézier - explicit tangent
}

/**
 * Catmull-Rom spline - passes through all control points smoothly
 */
export class CatmullRomSpline {
  private points: Vec3[];
  private tension: number;

  /**
   * @param points Control points the spline passes through
   * @param tension 0 = Catmull-Rom, 0.5 = centripetal, 1 = chordal
   */
  constructor(points: Vec3[], tension: number = 0.5) {
    if (points.length < 2) {
      throw new Error('Spline requires at least 2 points');
    }
    this.points = points;
    this.tension = tension;
  }

  /**
   * Evaluate spline at parameter t ∈ [0, 1]
   * Returns position on the curve
   */
  evaluate(t: number): Vec3 {
    const n = this.points.length - 1;

    // Clamp t
    t = Math.max(0, Math.min(1, t));

    // Find which segment we're in
    const segmentT = t * n;
    const segment = Math.min(Math.floor(segmentT), n - 1);
    const localT = segmentT - segment;

    // Get 4 control points (with clamping at ends)
    const p0 = this.points[Math.max(0, segment - 1)];
    const p1 = this.points[segment];
    const p2 = this.points[Math.min(n, segment + 1)];
    const p3 = this.points[Math.min(n, segment + 2)];

    return this.catmullRomInterpolate(p0, p1, p2, p3, localT);
  }

  /**
   * Evaluate tangent (derivative) at parameter t
   */
  evaluateTangent(t: number): Vec3 {
    const n = this.points.length - 1;
    t = Math.max(0, Math.min(1, t));

    const segmentT = t * n;
    const segment = Math.min(Math.floor(segmentT), n - 1);
    const localT = segmentT - segment;

    const p0 = this.points[Math.max(0, segment - 1)];
    const p1 = this.points[segment];
    const p2 = this.points[Math.min(n, segment + 1)];
    const p3 = this.points[Math.min(n, segment + 2)];

    return this.catmullRomDerivative(p0, p1, p2, p3, localT);
  }

  /**
   * Get array of points along the spline
   * @param segments Number of segments (points = segments + 1)
   */
  getPoints(segments: number): Vec3[] {
    const points: Vec3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      points.push(this.evaluate(t));
    }
    return points;
  }

  /**
   * Get total arc length (approximate)
   */
  getLength(samples: number = 100): number {
    let length = 0;
    let prev = this.evaluate(0);

    for (let i = 1; i <= samples; i++) {
      const curr = this.evaluate(i / samples);
      length += curr.sub(prev).length();
      prev = curr;
    }

    return length;
  }

  /**
   * Catmull-Rom interpolation between p1 and p2
   * p0 and p3 are used for tangent calculation
   */
  private catmullRomInterpolate(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
    const t2 = t * t;
    const t3 = t2 * t;

    // Catmull-Rom basis matrix coefficients
    const a = this.tension;

    // Position = [1, t, t², t³] * M * [p0, p1, p2, p3]ᵀ
    // Using standard Catmull-Rom matrix with tension
    const c0 = -a * t3 + 2 * a * t2 - a * t;
    const c1 = (2 - a) * t3 + (a - 3) * t2 + 1;
    const c2 = (a - 2) * t3 + (3 - 2 * a) * t2 + a * t;
    const c3 = a * t3 - a * t2;

    return new Vec3(
      c0 * p0.x + c1 * p1.x + c2 * p2.x + c3 * p3.x,
      c0 * p0.y + c1 * p1.y + c2 * p2.y + c3 * p3.y,
      c0 * p0.z + c1 * p1.z + c2 * p2.z + c3 * p3.z
    );
  }

  /**
   * Derivative of Catmull-Rom interpolation
   */
  private catmullRomDerivative(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
    const t2 = t * t;
    const a = this.tension;

    // Derivative of position polynomial
    const c0 = -3 * a * t2 + 4 * a * t - a;
    const c1 = 3 * (2 - a) * t2 + 2 * (a - 3) * t;
    const c2 = 3 * (a - 2) * t2 + 2 * (3 - 2 * a) * t + a;
    const c3 = 3 * a * t2 - 2 * a * t;

    return new Vec3(
      c0 * p0.x + c1 * p1.x + c2 * p2.x + c3 * p3.x,
      c0 * p0.y + c1 * p1.y + c2 * p2.y + c3 * p3.y,
      c0 * p0.z + c1 * p1.z + c2 * p2.z + c3 * p3.z
    ).normalize();
  }
}

/**
 * Cubic Bézier spline - explicit control over tangents
 */
export class BezierSpline {
  private segments: Array<{
    p0: Vec3;  // Start point
    p1: Vec3;  // Start tangent control
    p2: Vec3;  // End tangent control
    p3: Vec3;  // End point
  }>;

  constructor() {
    this.segments = [];
  }

  /**
   * Add a cubic Bézier segment
   */
  addSegment(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3): this {
    this.segments.push({ p0, p1, p2, p3 });
    return this;
  }

  /**
   * Create from points with automatic tangent calculation
   */
  static fromPoints(points: Vec3[], smoothness: number = 0.3): BezierSpline {
    const spline = new BezierSpline();

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p3 = points[i + 1];

      // Calculate tangent directions
      const prevDir = i > 0
        ? points[i].sub(points[i - 1]).normalize()
        : p3.sub(p0).normalize();
      const nextDir = i < points.length - 2
        ? points[i + 2].sub(points[i + 1]).normalize()
        : p3.sub(p0).normalize();

      const segmentLen = p3.sub(p0).length();

      // Control points along tangent directions
      const p1 = p0.add(prevDir.add(p3.sub(p0).normalize()).normalize().mul(segmentLen * smoothness));
      const p2 = p3.sub(nextDir.add(p3.sub(p0).normalize()).normalize().mul(segmentLen * smoothness));

      spline.addSegment(p0, p1, p2, p3);
    }

    return spline;
  }

  /**
   * Evaluate at parameter t ∈ [0, 1]
   */
  evaluate(t: number): Vec3 {
    if (this.segments.length === 0) {
      throw new Error('Spline has no segments');
    }

    t = Math.max(0, Math.min(1, t));

    const segmentT = t * this.segments.length;
    const segmentIndex = Math.min(Math.floor(segmentT), this.segments.length - 1);
    const localT = segmentT - segmentIndex;

    const { p0, p1, p2, p3 } = this.segments[segmentIndex];
    return this.cubicBezier(p0, p1, p2, p3, localT);
  }

  /**
   * Evaluate tangent at parameter t
   */
  evaluateTangent(t: number): Vec3 {
    if (this.segments.length === 0) {
      throw new Error('Spline has no segments');
    }

    t = Math.max(0, Math.min(1, t));

    const segmentT = t * this.segments.length;
    const segmentIndex = Math.min(Math.floor(segmentT), this.segments.length - 1);
    const localT = segmentT - segmentIndex;

    const { p0, p1, p2, p3 } = this.segments[segmentIndex];
    return this.cubicBezierDerivative(p0, p1, p2, p3, localT);
  }

  /**
   * Get array of points along the spline
   */
  getPoints(segments: number): Vec3[] {
    const points: Vec3[] = [];
    for (let i = 0; i <= segments; i++) {
      points.push(this.evaluate(i / segments));
    }
    return points;
  }

  /**
   * Cubic Bézier: B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
   */
  private cubicBezier(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return new Vec3(
      mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
      mt3 * p0.z + 3 * mt2 * t * p1.z + 3 * mt * t2 * p2.z + t3 * p3.z
    );
  }

  /**
   * Derivative: B'(t) = 3(1-t)²(P₁-P₀) + 6(1-t)t(P₂-P₁) + 3t²(P₃-P₂)
   */
  private cubicBezierDerivative(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    const d0 = p1.sub(p0);
    const d1 = p2.sub(p1);
    const d2 = p3.sub(p2);

    return new Vec3(
      3 * mt2 * d0.x + 6 * mt * t * d1.x + 3 * t2 * d2.x,
      3 * mt2 * d0.y + 6 * mt * t * d1.y + 3 * t2 * d2.y,
      3 * mt2 * d0.z + 6 * mt * t * d1.z + 3 * t2 * d2.z
    ).normalize();
  }
}

/**
 * Unified Spline interface
 */
export class Spline {
  private impl: CatmullRomSpline | BezierSpline;
  readonly type: SplineType;

  private constructor(impl: CatmullRomSpline | BezierSpline, type: SplineType) {
    this.impl = impl;
    this.type = type;
  }

  static catmullRom(points: Vec3[], tension: number = 0.5): Spline {
    return new Spline(new CatmullRomSpline(points, tension), 'catmull-rom');
  }

  static bezier(points: Vec3[], smoothness: number = 0.3): Spline {
    return new Spline(BezierSpline.fromPoints(points, smoothness), 'bezier');
  }

  evaluate(t: number): Vec3 {
    return this.impl.evaluate(t);
  }

  evaluateTangent(t: number): Vec3 {
    return this.impl.evaluateTangent(t);
  }

  getPoints(segments: number): Vec3[] {
    return this.impl.getPoints(segments);
  }

  /**
   * Get a coordinate frame (position, tangent, normal, binormal) at parameter t
   * Useful for sweeping profiles along the spline
   */
  getFrame(t: number): { position: Vec3; tangent: Vec3; normal: Vec3; binormal: Vec3 } {
    const position = this.evaluate(t);
    const tangent = this.evaluateTangent(t);

    // Use Frenet-Serret frame (or approximate if curvature is zero)
    // Normal is perpendicular to tangent, in the plane of curvature
    const up = Math.abs(tangent.y) < 0.99 ? new Vec3(0, 1, 0) : new Vec3(1, 0, 0);
    const binormal = tangent.cross(up).normalize();
    const normal = binormal.cross(tangent).normalize();

    return { position, tangent, normal, binormal };
  }
}

