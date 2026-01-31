export class Random {
  private state: number;
  private readonly initialSeed: number;
  constructor(seed: number = Date.now()) {
    this.initialSeed = seed;
    this.state = seed;
  }
  reset(): void {
    this.state = this.initialSeed;
  }
  getSeed(): number {
    return this.initialSeed;
  }
  next(): number {
    this.state = this.state + 0x6D2B79F5 | 0;
    let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  boolean(): boolean {
    return this.next() < 0.5;
  }
  pick<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)];
  }
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  gaussian(mean: number = 0, stdDev: number = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }
}
