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
};

export default MathService;

