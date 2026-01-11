export class Vec3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}
  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }
  add(v: Vec3): Vec3 {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }
  sub(v: Vec3): Vec3 {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }
  mul(s: number): Vec3 {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }
  div(s: number): Vec3 {
    return new Vec3(this.x / s, this.y / s, this.z / s);
  }
  dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  cross(v: Vec3): Vec3 {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  normalize(): Vec3 {
    const len = this.length();
    if (len === 0) return new Vec3(0, 0, 0);
    return this.div(len);
  }
  lerp(v: Vec3, t: number): Vec3 {
    return new Vec3(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t,
      this.z + (v.z - this.z) * t
    );
  }
  distance(v: Vec3): number {
    return this.sub(v).length();
  }
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }
  static fromArray(arr: number[]): Vec3 {
    return new Vec3(arr[0] || 0, arr[1] || 0, arr[2] || 0);
  }
  static zero(): Vec3 {
    return new Vec3(0, 0, 0);
  }
  static one(): Vec3 {
    return new Vec3(1, 1, 1);
  }
}
