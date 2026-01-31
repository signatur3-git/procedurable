/**
 * Mat4 - 4x4 Transformation Matrix
 *
 * Column-major order (like OpenGL/WebGL)
 * Used for combining translation, rotation, and scale transforms.
 */

import { Vec3 } from './Vec3';

export class Mat4 {
  public data: Float32Array;

  constructor(data?: number[]) {
    this.data = new Float32Array(16);
    if (data) {
      for (let i = 0; i < 16; i++) {
        this.data[i] = data[i] || 0;
      }
    } else {
      this.identity();
    }
  }

  /**
   * Set to identity matrix
   */
  identity(): Mat4 {
    this.data.fill(0);
    this.data[0] = 1;
    this.data[5] = 1;
    this.data[10] = 1;
    this.data[15] = 1;
    return this;
  }

  /**
   * Clone this matrix
   */
  clone(): Mat4 {
    return new Mat4(Array.from(this.data));
  }

  /**
   * Multiply this matrix by another: this * other
   */
  multiply(other: Mat4): Mat4 {
    const a = this.data;
    const b = other.data;
    const result = new Mat4();
    const r = result.data;

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        r[col * 4 + row] =
          a[0 * 4 + row] * b[col * 4 + 0] +
          a[1 * 4 + row] * b[col * 4 + 1] +
          a[2 * 4 + row] * b[col * 4 + 2] +
          a[3 * 4 + row] * b[col * 4 + 3];
      }
    }

    return result;
  }

  /**
   * Transform a Vec3 point by this matrix (assumes w=1)
   */
  transformPoint(v: Vec3): Vec3 {
    const d = this.data;
    const x = d[0] * v.x + d[4] * v.y + d[8] * v.z + d[12];
    const y = d[1] * v.x + d[5] * v.y + d[9] * v.z + d[13];
    const z = d[2] * v.x + d[6] * v.y + d[10] * v.z + d[14];
    const w = d[3] * v.x + d[7] * v.y + d[11] * v.z + d[15];

    if (w !== 0 && w !== 1) {
      return new Vec3(x / w, y / w, z / w);
    }
    return new Vec3(x, y, z);
  }

  /**
   * Transform a Vec3 direction by this matrix (assumes w=0, ignores translation)
   */
  transformDirection(v: Vec3): Vec3 {
    const d = this.data;
    return new Vec3(
      d[0] * v.x + d[4] * v.y + d[8] * v.z,
      d[1] * v.x + d[5] * v.y + d[9] * v.z,
      d[2] * v.x + d[6] * v.y + d[10] * v.z
    );
  }

  /**
   * Create a translation matrix
   */
  static translation(x: number, y: number, z: number): Mat4 {
    const m = new Mat4();
    m.data[12] = x;
    m.data[13] = y;
    m.data[14] = z;
    return m;
  }

  static fromTranslation(v: Vec3): Mat4 {
    return Mat4.translation(v.x, v.y, v.z);
  }

  /**
   * Create a scale matrix
   */
  static scale(x: number, y: number, z: number): Mat4 {
    const m = new Mat4();
    m.data[0] = x;
    m.data[5] = y;
    m.data[10] = z;
    return m;
  }

  static fromScale(v: Vec3): Mat4 {
    return Mat4.scale(v.x, v.y, v.z);
  }

  /**
   * Create a rotation matrix around the X axis
   */
  static rotationX(radians: number): Mat4 {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    const m = new Mat4();
    m.data[5] = c;
    m.data[6] = s;
    m.data[9] = -s;
    m.data[10] = c;
    return m;
  }

  /**
   * Create a rotation matrix around the Y axis
   */
  static rotationY(radians: number): Mat4 {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    const m = new Mat4();
    m.data[0] = c;
    m.data[2] = -s;
    m.data[8] = s;
    m.data[10] = c;
    return m;
  }

  /**
   * Create a rotation matrix around the Z axis
   */
  static rotationZ(radians: number): Mat4 {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    const m = new Mat4();
    m.data[0] = c;
    m.data[1] = s;
    m.data[4] = -s;
    m.data[5] = c;
    return m;
  }

  /**
   * Create a rotation matrix from Euler angles (XYZ order)
   */
  static fromEuler(x: number, y: number, z: number): Mat4 {
    return Mat4.rotationZ(z)
      .multiply(Mat4.rotationY(y))
      .multiply(Mat4.rotationX(x));
  }

  /**
   * Create a rotation matrix around an arbitrary axis
   */
  static fromAxisAngle(axis: Vec3, radians: number): Mat4 {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    const t = 1 - c;
    const x = axis.x, y = axis.y, z = axis.z;

    const m = new Mat4();
    m.data[0] = t * x * x + c;
    m.data[1] = t * x * y + s * z;
    m.data[2] = t * x * z - s * y;

    m.data[4] = t * x * y - s * z;
    m.data[5] = t * y * y + c;
    m.data[6] = t * y * z + s * x;

    m.data[8] = t * x * z + s * y;
    m.data[9] = t * y * z - s * x;
    m.data[10] = t * z * z + c;

    return m;
  }

  /**
   * Compose a TRS (Translation, Rotation, Scale) matrix
   */
  static compose(translation: Vec3, rotation: Vec3, scale: Vec3): Mat4 {
    return Mat4.fromTranslation(translation)
      .multiply(Mat4.fromEuler(rotation.x, rotation.y, rotation.z))
      .multiply(Mat4.fromScale(scale));
  }
}

