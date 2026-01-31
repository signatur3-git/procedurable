/**
 * Transform - Encapsulates position, rotation, and scale
 *
 * Provides a clean interface for transforming geometry.
 * Rotation is stored as Euler angles (in radians) for simplicity.
 */

import { Vec3 } from './Vec3';
import { Mat4 } from './Mat4';

export class Transform {
  public position: Vec3;
  public rotation: Vec3;  // Euler angles in radians (X, Y, Z)
  public scale: Vec3;

  constructor(
    position: Vec3 = Vec3.zero(),
    rotation: Vec3 = Vec3.zero(),
    scale: Vec3 = new Vec3(1, 1, 1)
  ) {
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
  }

  /**
   * Create an identity transform
   */
  static identity(): Transform {
    return new Transform();
  }

  /**
   * Create a transform with just translation
   */
  static fromPosition(x: number, y: number, z: number): Transform {
    return new Transform(new Vec3(x, y, z));
  }

  /**
   * Create a transform with just rotation (Euler angles in radians)
   */
  static fromRotation(x: number, y: number, z: number): Transform {
    return new Transform(Vec3.zero(), new Vec3(x, y, z));
  }

  /**
   * Clone this transform
   */
  clone(): Transform {
    return new Transform(
      this.position.clone(),
      this.rotation.clone(),
      this.scale.clone()
    );
  }

  /**
   * Get the transformation matrix (Scale -> Rotate -> Translate)
   */
  getMatrix(): Mat4 {
    return Mat4.compose(this.position, this.rotation, this.scale);
  }

  /**
   * Combine this transform with another: this * other
   * Result represents applying other first, then this
   */
  combine(other: Transform): Transform {
    // For a proper combine, we'd need quaternions
    // This is a simplified version that works for hierarchical positioning
    const matrix = this.getMatrix().multiply(other.getMatrix());

    // Extract position from matrix (column 3)
    const position = new Vec3(matrix.data[12], matrix.data[13], matrix.data[14]);

    // For now, just add rotations (not technically correct but works for small angles)
    const rotation = this.rotation.add(other.rotation);

    // Multiply scales
    const scale = new Vec3(
      this.scale.x * other.scale.x,
      this.scale.y * other.scale.y,
      this.scale.z * other.scale.z
    );

    return new Transform(position, rotation, scale);
  }

  /**
   * Transform a point
   */
  transformPoint(point: Vec3): Vec3 {
    return this.getMatrix().transformPoint(point);
  }

  /**
   * Transform a direction (ignores translation)
   */
  transformDirection(dir: Vec3): Vec3 {
    return this.getMatrix().transformDirection(dir);
  }

  /**
   * Set position
   */
  setPosition(x: number, y: number, z: number): Transform {
    this.position = new Vec3(x, y, z);
    return this;
  }

  /**
   * Translate by offset
   */
  translate(x: number, y: number, z: number): Transform {
    this.position = this.position.add(new Vec3(x, y, z));
    return this;
  }

  /**
   * Set rotation (Euler angles in radians)
   */
  setRotation(x: number, y: number, z: number): Transform {
    this.rotation = new Vec3(x, y, z);
    return this;
  }

  /**
   * Rotate by angles (additive)
   */
  rotate(x: number, y: number, z: number): Transform {
    this.rotation = this.rotation.add(new Vec3(x, y, z));
    return this;
  }

  /**
   * Set uniform scale
   */
  setUniformScale(s: number): Transform {
    this.scale = new Vec3(s, s, s);
    return this;
  }

  /**
   * Human-readable string
   */
  toString(): string {
    return `Transform(pos: ${this.position.toString()}, rot: ${this.rotation.toString()}, scale: ${this.scale.toString()})`;
  }
}

