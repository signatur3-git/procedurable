/**
 * Axis-Aligned Bounding Box (AABB)
 *
 * Used for:
 * - Spatial queries (overlap detection)
 * - Scene constraints (chair placement)
 * - Future: physics broad-phase, frustum culling
 *
 * Phase 2 Foundation for Phase 3 physics.
 */

import { Vec3 } from './Vec3';

export class AABB {
  constructor(
    public min: Vec3 = new Vec3(Infinity, Infinity, Infinity),
    public max: Vec3 = new Vec3(-Infinity, -Infinity, -Infinity)
  ) {}

  /**
   * Create AABB from a list of points
   */
  static fromPoints(points: Vec3[]): AABB {
    const aabb = new AABB();
    for (const p of points) {
      aabb.expandToInclude(p);
    }
    return aabb;
  }

  /**
   * Create AABB from center and half-extents
   */
  static fromCenterHalfExtents(center: Vec3, halfExtents: Vec3): AABB {
    return new AABB(
      center.sub(halfExtents),
      center.add(halfExtents)
    );
  }

  /**
   * Expand this AABB to include a point
   */
  expandToInclude(point: Vec3): void {
    this.min = new Vec3(
      Math.min(this.min.x, point.x),
      Math.min(this.min.y, point.y),
      Math.min(this.min.z, point.z)
    );
    this.max = new Vec3(
      Math.max(this.max.x, point.x),
      Math.max(this.max.y, point.y),
      Math.max(this.max.z, point.z)
    );
  }

  /**
   * Expand this AABB to include another AABB
   */
  expandToIncludeAABB(other: AABB): void {
    this.expandToInclude(other.min);
    this.expandToInclude(other.max);
  }

  /**
   * Get the center of the AABB
   */
  get center(): Vec3 {
    return this.min.add(this.max).mul(0.5);
  }

  /**
   * Get the size (dimensions) of the AABB
   */
  get size(): Vec3 {
    return this.max.sub(this.min);
  }

  /**
   * Get the half-extents (size / 2)
   */
  get halfExtents(): Vec3 {
    return this.size.mul(0.5);
  }

  /**
   * Check if this AABB is valid (has been expanded at least once)
   */
  get isValid(): boolean {
    return this.min.x <= this.max.x &&
           this.min.y <= this.max.y &&
           this.min.z <= this.max.z;
  }

  /**
   * Check if this AABB overlaps with another (3D overlap)
   */
  overlaps(other: AABB): boolean {
    return this.min.x <= other.max.x && this.max.x >= other.min.x &&
           this.min.y <= other.max.y && this.max.y >= other.min.y &&
           this.min.z <= other.max.z && this.max.z >= other.min.z;
  }

  /**
   * Check if this AABB overlaps with another in XZ plane only (for floor placement)
   */
  overlapsXZ(other: AABB): boolean {
    return this.min.x <= other.max.x && this.max.x >= other.min.x &&
           this.min.z <= other.max.z && this.max.z >= other.min.z;
  }

  /**
   * Check if a point is inside this AABB
   */
  containsPoint(point: Vec3): boolean {
    return point.x >= this.min.x && point.x <= this.max.x &&
           point.y >= this.min.y && point.y <= this.max.y &&
           point.z >= this.min.z && point.z <= this.max.z;
  }

  /**
   * Get the minimum distance between two AABBs (0 if overlapping)
   */
  distanceTo(other: AABB): number {
    const dx = Math.max(0, Math.max(this.min.x - other.max.x, other.min.x - this.max.x));
    const dy = Math.max(0, Math.max(this.min.y - other.max.y, other.min.y - this.max.y));
    const dz = Math.max(0, Math.max(this.min.z - other.max.z, other.min.z - this.max.z));
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Get the minimum distance in XZ plane only (for floor placement)
   */
  distanceToXZ(other: AABB): number {
    const dx = Math.max(0, Math.max(this.min.x - other.max.x, other.min.x - this.max.x));
    const dz = Math.max(0, Math.max(this.min.z - other.max.z, other.min.z - this.max.z));
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Create a copy of this AABB
   */
  clone(): AABB {
    return new AABB(this.min.clone(), this.max.clone());
  }

  /**
   * Create a new AABB translated by an offset
   */
  translated(offset: Vec3): AABB {
    return new AABB(this.min.add(offset), this.max.add(offset));
  }

  /**
   * Create a new AABB with padding added on all sides
   */
  padded(padding: number): AABB {
    const p = new Vec3(padding, padding, padding);
    return new AABB(this.min.sub(p), this.max.add(p));
  }

  /**
   * Get volume of the AABB (useful for physics mass estimation)
   */
  get volume(): number {
    const s = this.size;
    return s.x * s.y * s.z;
  }

  /**
   * Get the 8 corner points of the AABB
   */
  getCorners(): Vec3[] {
    return [
      new Vec3(this.min.x, this.min.y, this.min.z),
      new Vec3(this.max.x, this.min.y, this.min.z),
      new Vec3(this.min.x, this.max.y, this.min.z),
      new Vec3(this.max.x, this.max.y, this.min.z),
      new Vec3(this.min.x, this.min.y, this.max.z),
      new Vec3(this.max.x, this.min.y, this.max.z),
      new Vec3(this.min.x, this.max.y, this.max.z),
      new Vec3(this.max.x, this.max.y, this.max.z),
    ];
  }

  toString(): string {
    return `AABB(min: ${this.min}, max: ${this.max}, size: ${this.size})`;
  }
}

