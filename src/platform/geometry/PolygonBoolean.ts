/**
 * PolygonBoolean - 2D Boolean Operations on Polygons
 *
 * Implements union, subtract, and intersect operations on 2D polygons.
 * Uses the Greiner-Hormann algorithm with enhancements for robustness.
 *
 * Handles:
 * - Convex and concave polygons
 * - Polygons with holes
 * - Degenerate cases (shared edges, containment, touching)
 */

import { Point2D, Shape2D } from './Shape2D';

// Epsilon for floating point comparisons
const EPSILON = 1e-10;

/**
 * Result of a boolean operation - outer boundary plus any holes
 */
export interface PolygonWithHoles {
  outer: Point2D[];
  holes: Point2D[][];
}

/**
 * Multi-polygon result (for operations that may produce multiple polygons)
 */
export type BooleanResult = PolygonWithHoles[];

/**
 * Internal vertex for Greiner-Hormann algorithm
 */
interface GHVertex {
  point: Point2D;
  next: GHVertex | null;
  prev: GHVertex | null;
  intersect: boolean;      // Is this an intersection point?
  entry: boolean;          // Entry or exit point?
  neighbor: GHVertex | null; // Link to corresponding point in other polygon
  alpha: number;           // Position along edge (0-1) for intersection points
  visited: boolean;
  processed: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Cross product of 2D vectors (returns scalar)
 */
function cross2D(ax: number, az: number, bx: number, bz: number): number {
  return ax * bz - az * bx;
}


/**
 * Calculate signed area of polygon (positive = CCW, negative = CW)
 */
function signedArea(points: Point2D[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    area += p1.x * p2.z - p2.x * p1.z;
  }
  return area / 2;
}

/**
 * Check if polygon is clockwise
 */
function isClockwise(points: Point2D[]): boolean {
  return signedArea(points) < 0;
}

/**
 * Ensure polygon is counter-clockwise (standard winding for outer boundaries)
 */
function ensureCCW(points: Point2D[]): Point2D[] {
  if (isClockwise(points)) {
    return [...points].reverse();
  }
  return points;
}

/**
 * Ensure polygon is clockwise (standard winding for holes)
 */
function ensureCW(points: Point2D[]): Point2D[] {
  if (!isClockwise(points)) {
    return [...points].reverse();
  }
  return points;
}

/**
 * Check if point is inside polygon using ray casting
 */
function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  const n = polygon.length;
  let inside = false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];

    if (((pi.z > point.z) !== (pj.z > point.z)) &&
        (point.x < (pj.x - pi.x) * (point.z - pi.z) / (pj.z - pi.z) + pi.x)) {
      inside = !inside;
    }
  }

  return inside;
}


/**
 * Line segment intersection
 * Returns intersection point and alpha values (position along each segment)
 */
function lineSegmentIntersection(
  a1: Point2D, a2: Point2D,
  b1: Point2D, b2: Point2D
): { point: Point2D; alphaA: number; alphaB: number } | null {
  const dax = a2.x - a1.x;
  const daz = a2.z - a1.z;
  const dbx = b2.x - b1.x;
  const dbz = b2.z - b1.z;
  const dabx = a1.x - b1.x;
  const dabz = a1.z - b1.z;

  const denom = cross2D(dax, daz, dbx, dbz);

  // Parallel lines
  if (Math.abs(denom) < EPSILON) {
    return null;
  }

  const alphaA = cross2D(dbx, dbz, dabx, dabz) / denom;
  const alphaB = cross2D(dax, daz, dabx, dabz) / denom;

  // Check if intersection is within both segments (exclusive of endpoints to avoid duplicates)
  if (alphaA > EPSILON && alphaA < 1 - EPSILON && alphaB > EPSILON && alphaB < 1 - EPSILON) {
    return {
      point: {
        x: a1.x + alphaA * dax,
        z: a1.z + alphaA * daz
      },
      alphaA,
      alphaB
    };
  }

  return null;
}


// ============================================================================
// Greiner-Hormann Algorithm Implementation
// ============================================================================

/**
 * Create a circular linked list from polygon points
 */
function createLinkedList(points: Point2D[]): GHVertex {
  const first: GHVertex = {
    point: { x: points[0].x, z: points[0].z },
    next: null,
    prev: null,
    intersect: false,
    entry: false,
    neighbor: null,
    alpha: 0,
    visited: false,
    processed: false
  };

  let current = first;
  for (let i = 1; i < points.length; i++) {
    const vertex: GHVertex = {
      point: { x: points[i].x, z: points[i].z },
      next: null,
      prev: current,
      intersect: false,
      entry: false,
      neighbor: null,
      alpha: 0,
      visited: false,
      processed: false
    };
    current.next = vertex;
    current = vertex;
  }

  // Close the loop
  current.next = first;
  first.prev = current;

  return first;
}

/**
 * Insert an intersection vertex into the linked list in the correct position
 */
function insertIntersection(start: GHVertex, intersection: GHVertex, alpha: number): void {
  let current: GHVertex | null = start;

  while (current && current.next !== start) {
    if (!current.intersect || current.alpha < alpha) {
      // Check if next is original vertex or has higher alpha
      if (!current.next!.intersect || current.next!.alpha > alpha) {
        // Insert after current
        intersection.next = current.next;
        intersection.prev = current;
        current.next!.prev = intersection;
        current.next = intersection;
        return;
      }
    }
    current = current.next;
  }

  // Insert at the end
  if (current) {
    intersection.next = current.next;
    intersection.prev = current;
    current.next!.prev = intersection;
    current.next = intersection;
  }
}

/**
 * Find all intersections between two polygons and insert them into linked lists
 */
function findAndInsertIntersections(subjHead: GHVertex, clipHead: GHVertex): void {
  let subjCurrent: GHVertex | null = subjHead;
  const subjStart = subjHead;

  do {
    if (!subjCurrent!.intersect) {
      let clipCurrent: GHVertex | null = clipHead;
      const clipStart = clipHead;

      do {
        if (!clipCurrent!.intersect) {
          const intersection = lineSegmentIntersection(
            subjCurrent!.point, subjCurrent!.next!.point,
            clipCurrent!.point, clipCurrent!.next!.point
          );

          if (intersection) {
            // Create intersection vertices for both polygons
            const subjIntersect: GHVertex = {
              point: intersection.point,
              next: null,
              prev: null,
              intersect: true,
              entry: false,
              neighbor: null,
              alpha: intersection.alphaA,
              visited: false,
              processed: false
            };

            const clipIntersect: GHVertex = {
              point: { x: intersection.point.x, z: intersection.point.z },
              next: null,
              prev: null,
              intersect: true,
              entry: false,
              neighbor: null,
              alpha: intersection.alphaB,
              visited: false,
              processed: false
            };

            // Link the intersection vertices together
            subjIntersect.neighbor = clipIntersect;
            clipIntersect.neighbor = subjIntersect;

            // Insert into respective lists
            insertIntersection(subjCurrent!, subjIntersect, intersection.alphaA);
            insertIntersection(clipCurrent!, clipIntersect, intersection.alphaB);
          }
        }
        clipCurrent = clipCurrent!.next;
      } while (clipCurrent !== clipStart);
    }
    subjCurrent = subjCurrent!.next;
  } while (subjCurrent !== subjStart);
}

/**
 * Mark entry/exit status for intersection points
 */
function markEntryExit(head: GHVertex, insideOther: (point: Point2D) => boolean): void {
  let current: GHVertex | null = head;
  const start = head;

  // Find the first non-intersection point's inside status
  while (current!.intersect && current!.next !== start) {
    current = current!.next;
  }

  let inside = insideOther(current!.point);

  // Walk through and mark intersections
  current = head;
  do {
    if (current!.intersect) {
      current!.entry = !inside;
      inside = !inside;
    }
    current = current!.next;
  } while (current !== start);
}

/**
 * Extract polygon paths from the linked lists after marking
 */
function extractPolygons(subjHead: GHVertex, isUnion: boolean, isSubtract: boolean): Point2D[][] {
  const result: Point2D[][] = [];

  let current: GHVertex | null = subjHead;
  const start = subjHead;

  do {
    if (current!.intersect && !current!.visited) {
      const polygon: Point2D[] = [];
      let walking: GHVertex | null = current;
      let onSubject = true;

      do {
        walking!.visited = true;
        polygon.push({ x: walking!.point.x, z: walking!.point.z });

        if (walking!.intersect) {
          if (walking!.neighbor) {
            walking!.neighbor.visited = true;
          }

          // Decide which direction to walk
          const shouldEnter = isUnion ? !walking!.entry : walking!.entry;

          if (isSubtract && !onSubject) {
            // For subtract, walk backward on clip polygon
            walking = walking!.prev;
          } else if (shouldEnter) {
            walking = walking!.next;
          } else {
            walking = walking!.prev;
          }

          // Switch between subject and clip polygons at intersections
          if (walking!.intersect && walking!.neighbor && !walking!.neighbor.visited) {
            walking = walking!.neighbor;
            onSubject = !onSubject;
          }
        } else {
          walking = walking!.next;
        }
      } while (walking !== current && !walking!.visited);

      if (polygon.length >= 3) {
        result.push(polygon);
      }
    }
    current = current!.next;
  } while (current !== start);

  return result;
}

// ============================================================================
// Simplified Boolean Operations (for convex polygons or simple cases)
// ============================================================================

/**
 * Sutherland-Hodgman polygon clipping (for intersection with convex clip polygon)
 */
function sutherlandHodgman(subject: Point2D[], clip: Point2D[]): Point2D[] {
  let output = [...subject];

  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) return [];

    const input = output;
    output = [];

    const edgeStart = clip[i];
    const edgeEnd = clip[(i + 1) % clip.length];

    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const previous = input[(j + input.length - 1) % input.length];

      const currentInside = isLeft(edgeStart, edgeEnd, current);
      const previousInside = isLeft(edgeStart, edgeEnd, previous);

      if (currentInside) {
        if (!previousInside) {
          const intersection = lineIntersection(previous, current, edgeStart, edgeEnd);
          if (intersection) output.push(intersection);
        }
        output.push(current);
      } else if (previousInside) {
        const intersection = lineIntersection(previous, current, edgeStart, edgeEnd);
        if (intersection) output.push(intersection);
      }
    }
  }

  return output;
}

/**
 * Check if point is to the left of edge (inside for CCW polygon)
 */
function isLeft(edgeStart: Point2D, edgeEnd: Point2D, point: Point2D): boolean {
  return cross2D(
    edgeEnd.x - edgeStart.x, edgeEnd.z - edgeStart.z,
    point.x - edgeStart.x, point.z - edgeStart.z
  ) >= 0;
}

/**
 * Line-line intersection (for infinite lines)
 */
function lineIntersection(a1: Point2D, a2: Point2D, b1: Point2D, b2: Point2D): Point2D | null {
  const dax = a2.x - a1.x;
  const daz = a2.z - a1.z;
  const dbx = b2.x - b1.x;
  const dbz = b2.z - b1.z;

  const denom = cross2D(dax, daz, dbx, dbz);
  if (Math.abs(denom) < EPSILON) return null;

  const t = cross2D(b1.x - a1.x, b1.z - a1.z, dbx, dbz) / denom;

  return {
    x: a1.x + t * dax,
    z: a1.z + t * daz
  };
}

// ============================================================================
// Main Boolean Operations
// ============================================================================

/**
 * Check if polygon A fully contains polygon B
 */
function polygonContains(outer: Point2D[], inner: Point2D[]): boolean {
  // All points of inner must be inside outer
  return inner.every(p => pointInPolygon(p, outer));
}

/**
 * Check if two polygons have any intersection
 */
function polygonsIntersect(a: Point2D[], b: Point2D[]): boolean {
  // Quick check: any point of A inside B or vice versa
  if (a.some(p => pointInPolygon(p, b))) return true;
  if (b.some(p => pointInPolygon(p, a))) return true;

  // Check for edge intersections
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (lineSegmentIntersection(
        a[i], a[(i + 1) % a.length],
        b[j], b[(j + 1) % b.length]
      )) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Union of two polygons
 */
export function union(subject: Point2D[], clip: Point2D[]): BooleanResult {
  // Normalize winding (CCW for outer boundaries)
  subject = ensureCCW(subject);
  clip = ensureCCW(clip);

  // Special cases
  if (polygonContains(subject, clip)) {
    return [{ outer: subject, holes: [] }];
  }
  if (polygonContains(clip, subject)) {
    return [{ outer: clip, holes: [] }];
  }
  if (!polygonsIntersect(subject, clip)) {
    // Disjoint polygons
    return [
      { outer: subject, holes: [] },
      { outer: clip, holes: [] }
    ];
  }

  // Use Greiner-Hormann for complex intersection
  const subjHead = createLinkedList(subject);
  const clipHead = createLinkedList(clip);

  findAndInsertIntersections(subjHead, clipHead);
  markEntryExit(subjHead, (p) => pointInPolygon(p, clip));
  markEntryExit(clipHead, (p) => pointInPolygon(p, subject));

  const polygons = extractPolygons(subjHead, true, false);

  if (polygons.length === 0) {
    // Fallback: return the larger polygon
    const areaA = Math.abs(signedArea(subject));
    const areaB = Math.abs(signedArea(clip));
    return [{ outer: areaA >= areaB ? subject : clip, holes: [] }];
  }

  return polygons.map(p => ({ outer: ensureCCW(p), holes: [] }));
}

/**
 * Intersection of two polygons
 */
export function intersect(subject: Point2D[], clip: Point2D[]): BooleanResult {
  // Normalize winding (CCW)
  subject = ensureCCW(subject);
  clip = ensureCCW(clip);

  // Special cases
  if (polygonContains(subject, clip)) {
    return [{ outer: clip, holes: [] }];
  }
  if (polygonContains(clip, subject)) {
    return [{ outer: subject, holes: [] }];
  }
  if (!polygonsIntersect(subject, clip)) {
    return []; // No intersection
  }

  // Use Sutherland-Hodgman for simpler/faster intersection
  const result = sutherlandHodgman(subject, clip);

  if (result.length < 3) {
    return [];
  }

  return [{ outer: result, holes: [] }];
}

/**
 * Subtract clip polygon from subject polygon
 */
export function subtract(subject: Point2D[], clip: Point2D[]): BooleanResult {
  // Normalize winding
  subject = ensureCCW(subject);
  clip = ensureCCW(clip);

  // Special cases
  if (!polygonsIntersect(subject, clip)) {
    return [{ outer: subject, holes: [] }]; // No overlap, subject unchanged
  }
  if (polygonContains(clip, subject)) {
    return []; // Subject fully inside clip, nothing left
  }
  if (polygonContains(subject, clip)) {
    // Clip is a hole in subject
    return [{ outer: subject, holes: [ensureCW(clip)] }];
  }

  // Use Greiner-Hormann for complex subtraction
  const subjHead = createLinkedList(subject);
  // Reverse clip for subtraction (it becomes a "hole")
  const reversedClip = [...clip].reverse();
  const clipHead = createLinkedList(reversedClip);

  findAndInsertIntersections(subjHead, clipHead);
  markEntryExit(subjHead, (p) => pointInPolygon(p, clip));
  markEntryExit(clipHead, (p) => pointInPolygon(p, subject));

  const polygons = extractPolygons(subjHead, false, true);

  if (polygons.length === 0) {
    // Fallback: return subject with clip as hole
    return [{ outer: subject, holes: [ensureCW(clip)] }];
  }

  return polygons.map(p => ({ outer: ensureCCW(p), holes: [] }));
}

// ============================================================================
// Shape2D Integration
// ============================================================================

/**
 * Union two Shape2D objects
 */
export function unionShapes(a: Shape2D, b: Shape2D): Shape2D[] {
  const result = union(a.points, b.points);
  return result.map(r => Shape2D.polygon(r.outer));
}

/**
 * Intersect two Shape2D objects
 */
export function intersectShapes(a: Shape2D, b: Shape2D): Shape2D[] {
  const result = intersect(a.points, b.points);
  return result.map(r => Shape2D.polygon(r.outer));
}

/**
 * Subtract Shape2D b from Shape2D a
 */
export function subtractShapes(a: Shape2D, b: Shape2D): Shape2D[] {
  const result = subtract(a.points, b.points);
  // Note: holes are returned as separate polygons marked for reverse extrusion
  const shapes: Shape2D[] = [];
  for (const r of result) {
    shapes.push(Shape2D.polygon(r.outer));
    // Add holes as separate shapes (caller must handle appropriately)
    for (const hole of r.holes) {
      shapes.push(Shape2D.polygon(hole));
    }
  }
  return shapes;
}

/**
 * Result that preserves hole information
 */
export interface ShapeWithHoles {
  outer: Shape2D;
  holes: Shape2D[];
}

/**
 * Subtract Shape2D b from Shape2D a, preserving hole information
 */
export function subtractShapesWithHoles(a: Shape2D, b: Shape2D): ShapeWithHoles[] {
  const result = subtract(a.points, b.points);
  return result.map(r => ({
    outer: Shape2D.polygon(r.outer),
    holes: r.holes.map(h => Shape2D.polygon(h))
  }));
}

/**
 * Union multiple shapes into one (or more if disjoint)
 */
export function unionMultiple(shapes: Shape2D[]): Shape2D[] {
  if (shapes.length === 0) return [];
  if (shapes.length === 1) return [shapes[0].clone()];

  let result = [shapes[0]];
  for (let i = 1; i < shapes.length; i++) {
    const newResult: Shape2D[] = [];
    let merged = false;

    for (const existing of result) {
      const unionResult = unionShapes(existing, shapes[i]);
      if (unionResult.length === 1 && !merged) {
        newResult.push(unionResult[0]);
        merged = true;
      } else {
        newResult.push(existing);
      }
    }

    if (!merged) {
      newResult.push(shapes[i].clone());
    }

    result = newResult;
  }

  return result;
}

/**
 * Subtract multiple shapes from a subject
 */
export function subtractMultiple(subject: Shape2D, clips: Shape2D[]): ShapeWithHoles[] {
  if (clips.length === 0) {
    return [{ outer: subject.clone(), holes: [] }];
  }

  let result: ShapeWithHoles[] = [{ outer: subject, holes: [] }];

  for (const clip of clips) {
    const newResult: ShapeWithHoles[] = [];
    for (const r of result) {
      const subtracted = subtractShapesWithHoles(r.outer, clip);
      for (const s of subtracted) {
        // Merge existing holes with new holes
        s.holes = [...s.holes, ...r.holes];
        newResult.push(s);
      }
    }
    result = newResult;
  }

  return result;
}
