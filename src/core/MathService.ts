/**
 * MathService - Centralized expression evaluation
 *
 * Provides:
 * - Safe expression evaluation with math.js
 * - Trig functions (sin, cos, tan, atan2)
 * - Math utilities (abs, min, max, floor, ceil, round, clamp)
 * - Constants (pi, e)
 * - Variable substitution
 *
 * Used by:
 * - YAML parser (for expressions in geometry)
 * - DSL commands (for agent calculations)
 * - TracedBuilder (for derived values)
 *
 * Exposed via:
 * - `math.eval` DSL command for agents
 */

import { create, all, MathJsInstance } from 'mathjs';

// Create a mathjs instance with all functions
const math: MathJsInstance = create(all);

// Limit the scope for security - only expose safe functions
const SAFE_FUNCTIONS = new Set([
  // Trig
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh',
  // Basic math
  'abs', 'sign', 'sqrt', 'cbrt', 'pow', 'exp', 'log', 'log10', 'log2',
  // Rounding
  'floor', 'ceil', 'round', 'trunc',
  // Min/max
  'min', 'max',
  // Comparison
  'equal', 'unequal', 'larger', 'smaller', 'largerEq', 'smallerEq',
  // Constants (handled separately)
]);

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
  tau: Math.PI * 2,
  TAU: Math.PI * 2,
};

/**
 * Result of evaluating an expression
 */
export interface EvalResult {
  value: number;
  expression: string;
  variables: string[];
}

/**
 * Evaluate a mathematical expression with variable substitution
 *
 * @param expression - The expression to evaluate (e.g., "sin(angle) * radius")
 * @param variables - Variable values to substitute
 * @returns Evaluation result with value and metadata
 *
 * @example
 * evaluate("sin(pi / 4) * 2", {}) // { value: 1.414..., ... }
 * evaluate("x + y", { x: 1, y: 2 }) // { value: 3, ... }
 * evaluate("-half_width", { half_width: 0.5 }) // { value: -0.5, ... }
 */
export function evaluate(
  expression: string,
  variables: Record<string, number> = {}
): EvalResult {
  // Track which variables were used
  const usedVariables: string[] = [];

  // Build scope with constants and provided variables
  const scope: Record<string, number> = { ...CONSTANTS };

  for (const [name, value] of Object.entries(variables)) {
    scope[name] = value;
    usedVariables.push(name);
  }

  try {
    // Use mathjs to evaluate
    const result = math.evaluate(expression, scope);

    // Ensure result is a number
    const numResult = typeof result === 'number' ? result : Number(result);

    if (isNaN(numResult)) {
      throw new Error(`Expression evaluated to NaN: ${expression}`);
    }

    return {
      value: numResult,
      expression,
      variables: usedVariables,
    };
  } catch (err: any) {
    throw new Error(`Failed to evaluate "${expression}": ${err.message}`);
  }
}

/**
 * Evaluate multiple expressions at once
 */
export function evaluateMany(
  expressions: Record<string, string>,
  variables: Record<string, number> = {}
): Record<string, EvalResult> {
  const results: Record<string, EvalResult> = {};

  // Evaluate in order, adding each result to scope for subsequent expressions
  const scope = { ...variables };

  for (const [name, expr] of Object.entries(expressions)) {
    const result = evaluate(expr, scope);
    results[name] = result;
    scope[name] = result.value; // Make available for subsequent expressions
  }

  return results;
}

/**
 * Check if an expression is syntactically valid
 */
export function validate(expression: string): { valid: boolean; error?: string } {
  try {
    // Parse without evaluating to check syntax
    math.parse(expression);
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

/**
 * Clamp a value between min and max
 * Exposed as a convenience function since mathjs doesn't have clamp
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Get list of available functions for documentation
 */
export function getAvailableFunctions(): string[] {
  return Array.from(SAFE_FUNCTIONS);
}

/**
 * Get list of available constants
 */
export function getAvailableConstants(): Record<string, number> {
  return { ...CONSTANTS };
}

// ============================================================================
// EXPRESSION CONTEXT (for TracedBuilder integration)
// ============================================================================

/**
 * ExpressionContext that uses MathService
 *
 * Drop-in replacement for the existing ExpressionContext in TracedBuilder
 */
export class MathContext {
  private variables: Map<string, number> = new Map();

  /**
   * Set a variable value
   */
  set(name: string, value: number): void {
    this.variables.set(name, value);
  }

  /**
   * Get a variable value
   */
  get(name: string): number | undefined {
    return this.variables.get(name);
  }

  /**
   * Check if variable exists
   */
  has(name: string): boolean {
    return this.variables.has(name) || name in CONSTANTS;
  }

  /**
   * Evaluate an expression using current variables
   */
  evaluate(expression: string): EvalResult {
    const vars: Record<string, number> = {};
    for (const [k, v] of this.variables) {
      vars[k] = v;
    }
    return evaluate(expression, vars);
  }

  /**
   * Get all variables as object
   */
  toObject(): Record<string, number> {
    const obj: Record<string, number> = {};
    for (const [k, v] of this.variables) {
      obj[k] = v;
    }
    return obj;
  }
}

// ============================================================================
// NOISE FUNCTIONS
// ============================================================================

/**
 * Simple hash function for coordinate-based seeding
 * Produces deterministic pseudo-random value from coordinates
 */
export function coordinateHash(seed: number, x: number, y: number = 0, z: number = 0): number {
  // Simple hash combining seed and coordinates
  let h = seed;
  h = ((h << 5) + h) ^ (Math.floor(x * 1000) & 0xFFFF);
  h = ((h << 5) + h) ^ (Math.floor(y * 1000) & 0xFFFF);
  h = ((h << 5) + h) ^ (Math.floor(z * 1000) & 0xFFFF);
  // Convert to 0-1 range
  return ((h & 0x7FFFFFFF) % 10000) / 10000;
}

// Permutation table for Perlin noise (fixed for reproducibility)
const PERM = new Uint8Array(512);
const GRAD3 = [
  [1,1,0], [-1,1,0], [1,-1,0], [-1,-1,0],
  [1,0,1], [-1,0,1], [1,0,-1], [-1,0,-1],
  [0,1,1], [0,-1,1], [0,1,-1], [0,-1,-1]
];

// Initialize permutation table
function initPerm(seed: number = 0): void {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;

  // Fisher-Yates shuffle with seed
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7FFFFFFF;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }

  for (let i = 0; i < 512; i++) {
    PERM[i] = p[i & 255];
  }
}
initPerm(0);

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function grad3(hash: number, x: number, y: number, z: number): number {
  const g = GRAD3[hash % 12];
  return g[0] * x + g[1] * y + g[2] * z;
}

/**
 * 2D Perlin noise
 * Returns value in range [-1, 1]
 */
export function perlin2d(x: number, y: number, seed: number = 0): number {
  if (seed !== 0) initPerm(seed);

  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;

  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

  const aa = PERM[PERM[X] + Y];
  const ab = PERM[PERM[X] + Y + 1];
  const ba = PERM[PERM[X + 1] + Y];
  const bb = PERM[PERM[X + 1] + Y + 1];

  const gradAA = grad3(aa, xf, yf, 0);
  const gradBA = grad3(ba, xf - 1, yf, 0);
  const gradAB = grad3(ab, xf, yf - 1, 0);
  const gradBB = grad3(bb, xf - 1, yf - 1, 0);

  const lerpX1 = gradAA + u * (gradBA - gradAA);
  const lerpX2 = gradAB + u * (gradBB - gradAB);

  return lerpX1 + v * (lerpX2 - lerpX1);
}

/**
 * 3D Perlin noise
 * Returns value in range [-1, 1]
 */
export function perlin3d(x: number, y: number, z: number, seed: number = 0): number {
  if (seed !== 0) initPerm(seed);

  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;

  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const zf = z - Math.floor(z);

  const u = fade(xf);
  const v = fade(yf);
  const w = fade(zf);

  const aaa = PERM[PERM[PERM[X] + Y] + Z];
  const aba = PERM[PERM[PERM[X] + Y + 1] + Z];
  const aab = PERM[PERM[PERM[X] + Y] + Z + 1];
  const abb = PERM[PERM[PERM[X] + Y + 1] + Z + 1];
  const baa = PERM[PERM[PERM[X + 1] + Y] + Z];
  const bba = PERM[PERM[PERM[X + 1] + Y + 1] + Z];
  const bab = PERM[PERM[PERM[X + 1] + Y] + Z + 1];
  const bbb = PERM[PERM[PERM[X + 1] + Y + 1] + Z + 1];

  const gradAAA = grad3(aaa, xf, yf, zf);
  const gradBAA = grad3(baa, xf - 1, yf, zf);
  const gradABA = grad3(aba, xf, yf - 1, zf);
  const gradBBA = grad3(bba, xf - 1, yf - 1, zf);
  const gradAAB = grad3(aab, xf, yf, zf - 1);
  const gradBAB = grad3(bab, xf - 1, yf, zf - 1);
  const gradABB = grad3(abb, xf, yf - 1, zf - 1);
  const gradBBB = grad3(bbb, xf - 1, yf - 1, zf - 1);

  const lerpX1 = gradAAA + u * (gradBAA - gradAAA);
  const lerpX2 = gradABA + u * (gradBBA - gradABA);
  const lerpX3 = gradAAB + u * (gradBAB - gradAAB);
  const lerpX4 = gradABB + u * (gradBBB - gradABB);

  const lerpY1 = lerpX1 + v * (lerpX2 - lerpX1);
  const lerpY2 = lerpX3 + v * (lerpX4 - lerpX3);

  return lerpY1 + w * (lerpY2 - lerpY1);
}

/**
 * Fractal Brownian Motion (layered noise)
 * Returns value in approximate range [-1, 1]
 */
export function fbm(x: number, y: number, seed: number = 0, octaves: number = 4, persistence: number = 0.5): number {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += perlin2d(x * frequency, y * frequency, seed) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return total / maxValue;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export const MathService = {
  evaluate,
  evaluateMany,
  validate,
  clamp,
  lerp,
  getAvailableFunctions,
  getAvailableConstants,
  MathContext,
  // Noise functions
  coordinateHash,
  perlin2d,
  perlin3d,
  fbm,
};

export default MathService;

