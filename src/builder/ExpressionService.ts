/**
 * ExpressionService - Unified Expression Evaluation
 *
 * Consolidates all expression evaluation logic into a single service.
 * Eliminates the fragmentation between different condition evaluators.
 *
 * Features:
 * - Full MathService expressions (sin, cos, if, eq, etc.)
 * - String comparisons via eq()
 * - Boolean conditions
 * - Numeric comparisons
 * - Access to decisions, measurements, derived values, and constraints
 */

import { evaluate as mathEvaluate } from '../core/MathService';
import { TracedBuilder } from './TracedBuilder';

/**
 * Evaluation context containing all available values
 */
export interface EvaluationContext {
  /** Decision values (string, number, boolean) */
  decisions: Map<string, any>;
  /** Measurements and derived values from builder context */
  measurements: Record<string, number>;
  /** Constraints from parent builders */
  constraints: Record<string, any>;
}

/**
 * Build a complete evaluation context from a builder and decision values
 */
export function buildEvaluationContext(
  builder: TracedBuilder,
  decisionValues: Map<string, any>
): EvaluationContext {
  return {
    decisions: decisionValues,
    measurements: builder.context.toObject(),
    constraints: builder.getConstraints()
  };
}

/**
 * Build a unified variables object for MathService evaluation
 */
export function buildVariables(ctx: EvaluationContext): Record<string, any> {
  const variables: Record<string, any> = {};

  // Add decision values (including strings for choice decisions)
  for (const [name, value] of ctx.decisions.entries()) {
    if (typeof value === 'number') {
      variables[name] = value;
    } else if (typeof value === 'boolean') {
      variables[name] = value ? 1 : 0;
    } else if (typeof value === 'string') {
      variables[name] = value;
    }
  }

  // Add measurements and derived values
  for (const [name, value] of Object.entries(ctx.measurements)) {
    variables[name] = value;
  }

  // Add constraints with __constraint_ prefix
  for (const [name, value] of Object.entries(ctx.constraints)) {
    if (typeof value === 'number') {
      variables[`__constraint_${name}`] = value;
    } else if (typeof value === 'boolean') {
      variables[`__constraint_${name}`] = value ? 1 : 0;
    }
  }

  // Add default fallbacks for common constraints
  const commonConstraints = ['max_width', 'max_depth', 'max_height', 'min_width', 'min_depth', 'min_height'];
  for (const name of commonConstraints) {
    if (variables[`__constraint_${name}`] === undefined) {
      variables[`__constraint_${name}`] = name.startsWith('max_') ? 999 : 0;
    }
  }

  return variables;
}

/**
 * Evaluate a numeric expression
 *
 * @param expr - Expression string (e.g., "width * 2", "if(eq(size, 'small'), 0.7, 1.0)")
 * @param ctx - Evaluation context
 * @returns Numeric result
 */
export function evaluateNumeric(expr: string, ctx: EvaluationContext): number {
  const variables = buildVariables(ctx);

  // Transform @ prefix to __constraint_
  const transformedExpr = expr.replace(/@(\w+)/g, '__constraint_$1');

  try {
    const result = mathEvaluate(transformedExpr, variables);
    return result.value;
  } catch (e: any) {
    throw new Error(`Failed to evaluate "${expr}": ${e.message}`);
  }
}

/**
 * Evaluate a boolean condition
 *
 * Supports:
 * - Boolean decision names: "is_round"
 * - String equality: "shape == 'circle'" or "eq(shape, 'circle')"
 * - Numeric comparisons: "width > 0.5", "count >= 3"
 * - Inequality: "style != 'modern'"
 * - MathService expressions: "if(eq(size, 'small'), 1, 0)"
 *
 * @param condition - Condition string
 * @param ctx - Evaluation context
 * @returns Boolean result
 */
export function evaluateCondition(condition: string, ctx: EvaluationContext): boolean {
  const variables = buildVariables(ctx);

  // Handle $-prefixed decision references
  let cleanCondition = condition.trim();
  if (cleanCondition.startsWith('$')) {
    cleanCondition = cleanCondition.slice(1);
  }

  // 1. Simple boolean check - just a decision/measurement name
  if (/^\w+$/.test(cleanCondition)) {
    const value = variables[cleanCondition];
    if (value !== undefined) {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') return value.length > 0;
      return Boolean(value);
    }
    return false;
  }

  // 2. Try to evaluate with MathService first (handles eq(), if(), complex expressions)
  // Transform @ prefix
  const transformedCondition = cleanCondition.replace(/@(\w+)/g, '__constraint_$1');

  try {
    const result = mathEvaluate(transformedCondition, variables);
    // Convert result to boolean
    if (typeof result.value === 'boolean') return result.value;
    if (typeof result.value === 'number') return result.value !== 0;
    return Boolean(result.value);
  } catch {
    // MathService couldn't evaluate, try regex fallbacks
  }

  // 3. Regex fallback for simple patterns that MathService might struggle with
  // Pattern: name == value or name == 'value' or name == "value"
  const eqMatch = cleanCondition.match(/^(\w+)\s*==\s*["']?([^"']+)["']?$/);
  if (eqMatch) {
    const [, name, expected] = eqMatch;
    const actual = variables[name];
    if (actual === undefined) return false;
    // String comparison
    if (typeof actual === 'string') return actual === expected;
    // Number comparison
    if (typeof actual === 'number') return actual === parseFloat(expected);
    return String(actual) === expected;
  }

  // Pattern: name != value
  const neqMatch = cleanCondition.match(/^(\w+)\s*!=\s*["']?([^"']+)["']?$/);
  if (neqMatch) {
    const [, name, expected] = neqMatch;
    const actual = variables[name];
    if (actual === undefined) return true; // undefined != anything is true
    if (typeof actual === 'string') return actual !== expected;
    if (typeof actual === 'number') return actual !== parseFloat(expected);
    return String(actual) !== expected;
  }

  // Pattern: numeric comparisons (name > num, name >= num, name < num, name <= num)
  const numericMatch = cleanCondition.match(/^(\w+)\s*(>=|<=|>|<)\s*([\d.]+)$/);
  if (numericMatch) {
    const [, name, op, numStr] = numericMatch;
    const leftValue = typeof variables[name] === 'number' ? variables[name] : 0;
    const rightValue = parseFloat(numStr);

    switch (op) {
      case '>': return leftValue > rightValue;
      case '>=': return leftValue >= rightValue;
      case '<': return leftValue < rightValue;
      case '<=': return leftValue <= rightValue;
    }
  }

  console.warn(`[ExpressionService] Could not evaluate condition: "${condition}"`);
  return false;
}

/**
 * Evaluate a position component (x, y, or z value)
 *
 * @param value - Number or expression string
 * @param ctx - Evaluation context
 * @returns Numeric position value
 */
export function evaluatePosition(value: string | number, ctx: EvaluationContext): number {
  if (typeof value === 'number') return value;
  return evaluateNumeric(value, ctx);
}

/**
 * Helper: Create context from builder and decision values
 */
export function createContext(
  builder: TracedBuilder,
  decisionValues: Map<string, any>
): EvaluationContext {
  return buildEvaluationContext(builder, decisionValues);
}

/**
 * Convenience function: Evaluate numeric expression with builder and decisions
 */
export function evalExpr(
  expr: string,
  builder: TracedBuilder,
  decisionValues: Map<string, any>
): number {
  return evaluateNumeric(expr, createContext(builder, decisionValues));
}

/**
 * Convenience function: Evaluate condition with builder and decisions
 */
export function evalCond(
  condition: string,
  builder: TracedBuilder,
  decisionValues: Map<string, any>
): boolean {
  return evaluateCondition(condition, createContext(builder, decisionValues));
}

/**
 * Convenience function: Evaluate position component with builder and decisions
 */
export function evalPos(
  value: string | number,
  builder: TracedBuilder,
  decisionValues: Map<string, any>
): number {
  return evaluatePosition(value, createContext(builder, decisionValues));
}
