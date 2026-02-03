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
 * - Access to offers from SharedContext (B5-002)
 */

import { evaluate as mathEvaluate } from '../../platform/math/MathService';
import { TracedBuilder } from './TracedBuilder';
import type { SpatialOffer } from './SharedContext';
import type { StyleDefinition } from './StyleResolver';

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
  /** Offers from SharedContext (B5-002) */
  offers?: Map<string, SpatialOffer>;
  /** Active style (F2-001) */
  style?: StyleDefinition;
}

/**
 * Build a complete evaluation context from a builder and decision values
 */
export function buildEvaluationContext(
  builder: TracedBuilder,
  decisionValues: Map<string, any>,
  offers?: Map<string, SpatialOffer>,
  style?: StyleDefinition
): EvaluationContext {
  return {
    decisions: decisionValues,
    measurements: builder.context.toObject(),
    constraints: builder.getConstraints(),
    offers,
    style
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

  // B5-002: Add offer data with __offer_ prefix (accessible as $offer.reqId.field)
  if (ctx.offers) {
    for (const [reqId, offer] of ctx.offers) {
      if (offer.elevation !== undefined) {
        variables[`__offer_${reqId}_elevation`] = offer.elevation;
      }
      if (offer.slope !== undefined) {
        variables[`__offer_${reqId}_slope`] = offer.slope;
      }
      if (offer.slopeDirection !== undefined) {
        variables[`__offer_${reqId}_slope_direction`] = offer.slopeDirection;
      }
      if (offer.position) {
        variables[`__offer_${reqId}_x`] = offer.position.x;
        variables[`__offer_${reqId}_y`] = offer.position.y;
        variables[`__offer_${reqId}_z`] = offer.position.z;
      }
      variables[`__offer_${reqId}_fulfilled`] = offer.fulfilled ? 1 : 0;
      // Add any custom data fields
      if (offer.data) {
        for (const [key, value] of Object.entries(offer.data)) {
          if (typeof value === 'number') {
            variables[`__offer_${reqId}_${key}`] = value;
          } else if (typeof value === 'boolean') {
            variables[`__offer_${reqId}_${key}`] = value ? 1 : 0;
          }
        }
      }
    }
  }

  // F2-001: Add style data with __style_ prefix (accessible as $style.<property>)
  if (ctx.style) {
    // Add decision defaults
    if (ctx.style.decision_defaults) {
      for (const [name, value] of Object.entries(ctx.style.decision_defaults)) {
        if (typeof value === 'number') {
          variables[`__style_decision_${name}`] = value;
        } else if (typeof value === 'boolean') {
          variables[`__style_decision_${name}`] = value ? 1 : 0;
        } else if (typeof value === 'string') {
          variables[`__style_decision_${name}`] = value;
        }
      }
    }

    // Add material palette properties (accessible as $style.palette.<role>.<property>)
    if (ctx.style.material_palette) {
      for (const [role, mat] of Object.entries(ctx.style.material_palette)) {
        if (mat.roughness !== undefined) {
          variables[`__style_palette_${role}_roughness`] = mat.roughness;
        }
        if (mat.metalness !== undefined) {
          variables[`__style_palette_${role}_metalness`] = mat.metalness;
        }
        if (mat.rgb) {
          variables[`__style_palette_${role}_r`] = mat.rgb[0];
          variables[`__style_palette_${role}_g`] = mat.rgb[1];
          variables[`__style_palette_${role}_b`] = mat.rgb[2];
        }
      }
    }

    // Add pattern preferences
    if (ctx.style.pattern_preferences) {
      const prefs = ctx.style.pattern_preferences;
      if (prefs.symmetry) {
        variables['__style_symmetry'] = prefs.symmetry;
      }
      if (prefs.repetition) {
        variables['__style_repetition'] = prefs.repetition;
      }
      if (prefs.ornamentation) {
        variables['__style_ornamentation'] = prefs.ornamentation;
      }
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

  // Transform @ prefix to __constraint_ and $offer. to __offer_
  let transformedExpr = expr.replace(/@(\w+)/g, '__constraint_$1');
  // Transform $offer.reqId.field to __offer_reqId_field
  transformedExpr = transformedExpr.replace(/\$offer\.(\w+)\.(\w+)/g, '__offer_$1_$2');
  // F2-001: Transform $style.palette.role.prop to __style_palette_role_prop
  transformedExpr = transformedExpr.replace(/\$style\.palette\.(\w+)\.(\w+)/g, '__style_palette_$1_$2');
  // Transform $style.decision.name to __style_decision_name
  transformedExpr = transformedExpr.replace(/\$style\.decision\.(\w+)/g, '__style_decision_$1');
  // Transform $style.symmetry etc. to __style_symmetry
  transformedExpr = transformedExpr.replace(/\$style\.(symmetry|repetition|ornamentation)/g, '__style_$1');

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
  let transformedCondition = cleanCondition.replace(/@(\w+)/g, '__constraint_$1');
  // Transform $offer.reqId.field to __offer_reqId_field
  transformedCondition = transformedCondition.replace(/\$offer\.(\w+)\.(\w+)/g, '__offer_$1_$2');
  // F2-001: Transform $style.palette.role.prop to __style_palette_role_prop
  transformedCondition = transformedCondition.replace(/\$style\.palette\.(\w+)\.(\w+)/g, '__style_palette_$1_$2');
  // Transform $style.decision.name to __style_decision_name
  transformedCondition = transformedCondition.replace(/\$style\.decision\.(\w+)/g, '__style_decision_$1');
  // Transform $style.symmetry etc. to __style_symmetry
  transformedCondition = transformedCondition.replace(/\$style\.(symmetry|repetition|ornamentation)/g, '__style_$1');

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
  decisionValues: Map<string, any>,
  offers?: Map<string, SpatialOffer>
): EvaluationContext {
  return buildEvaluationContext(builder, decisionValues, offers);
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
