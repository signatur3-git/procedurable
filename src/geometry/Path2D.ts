/**
 * Path2D - True Vector Graphics with Bezier Curves
 *
 * Represents 2D paths with straight lines and curves.
 * This is the proper way to do vector graphics - not polygon approximation.
 */

export interface Point2D {
  x: number;
  z: number;
}

/**
 * Path segment types
 */
export type PathSegment =
  | { type: 'moveTo'; point: Point2D }
  | { type: 'lineTo'; point: Point2D }
  | { type: 'quadraticCurveTo'; control: Point2D; end: Point2D }
  | { type: 'cubicCurveTo'; control1: Point2D; control2: Point2D; end: Point2D }
  | { type: 'closePath' };

/**
 * A 2D path with curves
 */
export interface Path2D {
  segments: PathSegment[];
  closed: boolean;
}

export interface TessellationOptions {
  segments?: number;
  tolerance?: number;
  maxSegments?: number;
}

export type TessellationInput = number | TessellationOptions;

/**
 * Contour with hole information (for fonts/SVG)
 */
export interface Path2DContour {
  path: Path2D;
  isHole: boolean;  // True if this contour represents a hole (inside letters like O, A, P)
}

/**
 * Multi-contour path (e.g., letter with hole)
 */
export interface MultiPath2D {
  contours: Path2DContour[];
  bounds: {
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
  };
}

/**
 * Tessellate a bezier curve into line segments
 * @param segments Number of subdivisions (higher = smoother)
 */
export function tessellateQuadraticCurve(
  start: Point2D,
  control: Point2D,
  end: Point2D,
  segments: TessellationInput = 10
): Point2D[] {
  const options = normalizeTessellationOptions(segments);
  if (options.tolerance !== undefined) {
    return tessellateQuadraticCurveAdaptive(start, control, end, options);
  }

  const points: Point2D[] = [];

  const segmentCount = options.segments ?? 10;
  for (let i = 0; i <= segmentCount; i++) {
    const t = i / segmentCount;
    const t1 = 1 - t;

    // Quadratic bezier formula: B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
    const x = t1 * t1 * start.x + 2 * t1 * t * control.x + t * t * end.x;
    const z = t1 * t1 * start.z + 2 * t1 * t * control.z + t * t * end.z;

    points.push({ x, z });
  }

  return points;
}

/**
 * Tessellate a cubic bezier curve into line segments
 */
export function tessellateCubicCurve(
  start: Point2D,
  control1: Point2D,
  control2: Point2D,
  end: Point2D,
  segments: TessellationInput = 10
): Point2D[] {
  const options = normalizeTessellationOptions(segments);
  if (options.tolerance !== undefined) {
    return tessellateCubicCurveAdaptive(start, control1, control2, end, options);
  }

  const points: Point2D[] = [];

  const segmentCount = options.segments ?? 10;
  for (let i = 0; i <= segmentCount; i++) {
    const t = i / segmentCount;
    const t1 = 1 - t;

    // Cubic bezier formula: B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
    const x = t1 * t1 * t1 * start.x +
              3 * t1 * t1 * t * control1.x +
              3 * t1 * t * t * control2.x +
              t * t * t * end.x;

    const z = t1 * t1 * t1 * start.z +
              3 * t1 * t1 * t * control1.z +
              3 * t1 * t * t * control2.z +
              t * t * t * end.z;

    points.push({ x, z });
  }

  return points;
}

/**
 * Convert a path to a polygon (tessellate all curves)
 * This is for extrusion - we need triangles for 3D mesh
 */
export function pathToPolygon(path: Path2D, curveSegments: TessellationInput = 10): Point2D[] {
  const options = normalizeTessellationOptions(curveSegments);
  const points: Point2D[] = [];
  let currentPoint: Point2D = { x: 0, z: 0 };

  for (const segment of path.segments) {
    switch (segment.type) {
      case 'moveTo':
        currentPoint = segment.point;
        points.push(currentPoint);
        break;

      case 'lineTo':
        currentPoint = segment.point;
        points.push(currentPoint);
        break;

      case 'quadraticCurveTo':
        const quadPoints = tessellateQuadraticCurve(
          currentPoint,
          segment.control,
          segment.end,
          options
        );
        // Skip first point (already in array)
        points.push(...quadPoints.slice(1));
        currentPoint = segment.end;
        break;

      case 'cubicCurveTo':
        const cubicPoints = tessellateCubicCurve(
          currentPoint,
          segment.control1,
          segment.control2,
          segment.end,
          options
        );
        // Skip first point (already in array)
        points.push(...cubicPoints.slice(1));
        currentPoint = segment.end;
        break;

      case 'closePath':
        // Path is closed, don't add duplicate first point
        break;
    }
  }

  return points;
}

/**
 * Calculate bounds of a path
 */
export function calculatePathBounds(path: Path2D, curveSegments: TessellationInput = 10): {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
} {
  const points = pathToPolygon(path, curveSegments);

  let xMin = Infinity;
  let xMax = -Infinity;
  let zMin = Infinity;
  let zMax = -Infinity;

  for (const point of points) {
    xMin = Math.min(xMin, point.x);
    xMax = Math.max(xMax, point.x);
    zMin = Math.min(zMin, point.z);
    zMax = Math.max(zMax, point.z);
  }

  return { xMin, xMax, zMin, zMax };
}

/**
 * Create a simple rectangular path
 */
export function createRectPath(width: number, height: number, center: Point2D = { x: 0, z: 0 }): Path2D {
  const halfW = width / 2;
  const halfH = height / 2;

  return {
    segments: [
      { type: 'moveTo', point: { x: center.x - halfW, z: center.z - halfH } },
      { type: 'lineTo', point: { x: center.x + halfW, z: center.z - halfH } },
      { type: 'lineTo', point: { x: center.x + halfW, z: center.z + halfH } },
      { type: 'lineTo', point: { x: center.x - halfW, z: center.z + halfH } },
      { type: 'closePath' }
    ],
    closed: true
  };
}

/**
 * Create a circle path using cubic bezier approximation
 * A circle can be approximated with 4 cubic bezier curves
 */
export function createCirclePath(radius: number, center: Point2D = { x: 0, z: 0 }): Path2D {
  // Magic constant for approximating circle with cubic bezier
  // This gives the best approximation: k ≈ 0.5522847498
  const k = 0.5522847498;
  const r = radius;
  const kr = k * r;

  const cx = center.x;
  const cz = center.z;

  return {
    segments: [
      // Start at right (3 o'clock)
      { type: 'moveTo', point: { x: cx + r, z: cz } },

      // Right to bottom (3 to 6 o'clock)
      {
        type: 'cubicCurveTo',
        control1: { x: cx + r, z: cz - kr },
        control2: { x: cx + kr, z: cz - r },
        end: { x: cx, z: cz - r }
      },

      // Bottom to left (6 to 9 o'clock)
      {
        type: 'cubicCurveTo',
        control1: { x: cx - kr, z: cz - r },
        control2: { x: cx - r, z: cz - kr },
        end: { x: cx - r, z: cz }
      },

      // Left to top (9 to 12 o'clock)
      {
        type: 'cubicCurveTo',
        control1: { x: cx - r, z: cz + kr },
        control2: { x: cx - kr, z: cz + r },
        end: { x: cx, z: cz + r }
      },

      // Top to right (12 to 3 o'clock)
      {
        type: 'cubicCurveTo',
        control1: { x: cx + kr, z: cz + r },
        control2: { x: cx + r, z: cz + kr },
        end: { x: cx + r, z: cz }
      },

      { type: 'closePath' }
    ],
    closed: true
  };
}

function normalizeTessellationOptions(input: TessellationInput): TessellationOptions {
  if (typeof input === 'number') {
    return { segments: input };
  }
  return { ...input };
}

function midPoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

function distancePointToLine(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dz = lineEnd.z - lineStart.z;
  const numerator = Math.abs(dz * point.x - dx * point.z + lineEnd.x * lineStart.z - lineEnd.z * lineStart.x);
  const denominator = Math.sqrt(dx * dx + dz * dz);
  if (denominator === 0) {
    return Math.hypot(point.x - lineStart.x, point.z - lineStart.z);
  }
  return numerator / denominator;
}

function tessellateQuadraticCurveAdaptive(
  start: Point2D,
  control: Point2D,
  end: Point2D,
  options: TessellationOptions
): Point2D[] {
  const tolerance = options.tolerance ?? 0;
  const maxSegments = options.maxSegments ?? options.segments ?? 64;
  const points: Point2D[] = [{ x: start.x, z: start.z }];
  let segmentCount = 0;
  let pendingSegments = 1;
  const stack: Array<{ p0: Point2D; p1: Point2D; p2: Point2D }> = [{ p0: start, p1: control, p2: end }];

  while (stack.length > 0) {
    const segment = stack.pop();
    if (!segment) {
      break;
    }
    pendingSegments -= 1;

    const flatness = distancePointToLine(segment.p1, segment.p0, segment.p2);
    const canSplit = flatness > tolerance && (segmentCount + pendingSegments + 2) <= maxSegments;

    if (canSplit) {
      const p01 = midPoint(segment.p0, segment.p1);
      const p12 = midPoint(segment.p1, segment.p2);
      const p012 = midPoint(p01, p12);

      stack.push({ p0: p012, p1: p12, p2: segment.p2 });
      stack.push({ p0: segment.p0, p1: p01, p2: p012 });
      pendingSegments += 2;
      continue;
    }

    points.push({ x: segment.p2.x, z: segment.p2.z });
    segmentCount += 1;
  }

  return points;
}

function tessellateCubicCurveAdaptive(
  start: Point2D,
  control1: Point2D,
  control2: Point2D,
  end: Point2D,
  options: TessellationOptions
): Point2D[] {
  const tolerance = options.tolerance ?? 0;
  const maxSegments = options.maxSegments ?? options.segments ?? 64;
  const points: Point2D[] = [{ x: start.x, z: start.z }];
  let segmentCount = 0;
  let pendingSegments = 1;
  const stack: Array<{ p0: Point2D; p1: Point2D; p2: Point2D; p3: Point2D }> = [
    { p0: start, p1: control1, p2: control2, p3: end }
  ];

  while (stack.length > 0) {
    const segment = stack.pop();
    if (!segment) {
      break;
    }
    pendingSegments -= 1;

    const flatness = Math.max(
      distancePointToLine(segment.p1, segment.p0, segment.p3),
      distancePointToLine(segment.p2, segment.p0, segment.p3)
    );

    const canSplit = flatness > tolerance && (segmentCount + pendingSegments + 2) <= maxSegments;

    if (canSplit) {
      const p01 = midPoint(segment.p0, segment.p1);
      const p12 = midPoint(segment.p1, segment.p2);
      const p23 = midPoint(segment.p2, segment.p3);
      const p012 = midPoint(p01, p12);
      const p123 = midPoint(p12, p23);
      const p0123 = midPoint(p012, p123);

      stack.push({ p0: p0123, p1: p123, p2: p23, p3: segment.p3 });
      stack.push({ p0: segment.p0, p1: p01, p2: p012, p3: p0123 });
      pendingSegments += 2;
      continue;
    }

    points.push({ x: segment.p3.x, z: segment.p3.z });
    segmentCount += 1;
  }

  return points;
}
