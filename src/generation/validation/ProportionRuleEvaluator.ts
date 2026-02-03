/**
 * ProportionRuleEvaluator - Cross-builder proportion constraints
 *
 * F4-001: Evaluates proportion rules that span multiple sibling builders.
 * Rules reference measurements from composed children via paths like:
 *   "table.height / chair.seat_height >= 1.15"
 */

import { evaluate as mathEvaluate } from '../../platform/math/MathService';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A proportion rule - expression that should evaluate to true
 */
export interface ProportionRule {
  /** The rule expression (e.g., "table.height / chair.seat_height >= 1.15") */
  expression: string;
  /** Optional description of what this rule ensures */
  description?: string;
  /** Severity: 'warning' (default) or 'error' */
  severity?: 'warning' | 'error';
}

/**
 * Result of evaluating a single proportion rule
 */
export interface ProportionRuleResult {
  rule: string;
  passed: boolean;
  /** Actual computed value (if rule is a comparison, this is the left side) */
  value?: number;
  /** Expected value or range (if applicable) */
  expected?: string;
  /** Error message if rule failed or couldn't be evaluated */
  error?: string;
  /** Variables used in evaluation */
  usedVariables?: Record<string, number>;
  severity: 'warning' | 'error';
}

/**
 * Result of evaluating all proportion rules
 */
export interface ProportionEvaluationResult {
  passed: boolean;
  total: number;
  passedCount: number;
  failedCount: number;
  results: ProportionRuleResult[];
  warnings: ProportionRuleResult[];
  errors: ProportionRuleResult[];
}

/**
 * Measurements collected from composed builders
 * Keys are paths like "table.height" or "chair_1.seat_width"
 */
export type CrossBuilderMeasurements = Record<string, number>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract variable paths from a proportion rule expression
 * E.g., "table.height / chair.seat_height >= 1.15" -> ["table.height", "chair.seat_height"]
 */
export function extractVariablePaths(expression: string): string[] {
  // Match patterns like "name.measurement" or "name_1.measurement"
  const pathPattern = /([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*)/g;
  const matches = expression.match(pathPattern);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Convert a proportion rule expression to a form that MathService can evaluate.
 * Replaces "table.height" with "table_height" (dots to underscores)
 */
function normalizeExpression(expression: string, values: CrossBuilderMeasurements): {
  expr: string;
  variables: Record<string, number>;
} {
  const variables: Record<string, number> = {};
  let normalizedExpr = expression;

  // Replace each path with an underscore version
  for (const [path, value] of Object.entries(values)) {
    const normalized = path.replace(/\./g, '_');
    variables[normalized] = value;
    // Replace all occurrences of this path
    normalizedExpr = normalizedExpr.replace(new RegExp(path.replace('.', '\\.'), 'g'), normalized);
  }

  return { expr: normalizedExpr, variables };
}

/**
 * Parse a comparison expression and extract left side, operator, right side
 */
function parseComparison(expression: string): {
  leftExpr: string;
  operator: string;
  rightExpr: string;
} | null {
  // Match patterns like "expr >= value", "expr <= value", "expr > value", "expr < value", "expr == value"
  const match = expression.match(/^(.+?)\s*(>=|<=|>|<|==|!=)\s*(.+)$/);
  if (!match) return null;
  return {
    leftExpr: match[1].trim(),
    operator: match[2],
    rightExpr: match[3].trim()
  };
}

// =============================================================================
// MAIN EVALUATOR
// =============================================================================

/**
 * Evaluate a single proportion rule
 */
export function evaluateProportionRule(
  rule: ProportionRule | string,
  measurements: CrossBuilderMeasurements
): ProportionRuleResult {
  const ruleObj: ProportionRule = typeof rule === 'string' ? { expression: rule } : rule;
  const { expression, severity = 'warning' } = ruleObj;

  try {
    // Extract variable paths
    const paths = extractVariablePaths(expression);

    // Check all required measurements are available
    const usedVariables: Record<string, number> = {};
    for (const path of paths) {
      if (measurements[path] === undefined) {
        return {
          rule: expression,
          passed: false,
          error: `Missing measurement: ${path}`,
          severity
        };
      }
      usedVariables[path] = measurements[path];
    }

    // Normalize expression for MathService
    const { expr: normalizedExpr, variables } = normalizeExpression(expression, measurements);

    // Check if this is a comparison
    const comparison = parseComparison(normalizedExpr);

    if (comparison) {
      // Evaluate both sides
      const leftResult = mathEvaluate(comparison.leftExpr, variables);
      const rightResult = mathEvaluate(comparison.rightExpr, variables);

      const leftValue = leftResult.value;
      const rightValue = rightResult.value;

      // Perform comparison
      let passed = false;
      switch (comparison.operator) {
        case '>=': passed = leftValue >= rightValue; break;
        case '<=': passed = leftValue <= rightValue; break;
        case '>': passed = leftValue > rightValue; break;
        case '<': passed = leftValue < rightValue; break;
        case '==': passed = Math.abs(leftValue - rightValue) < 0.0001; break;
        case '!=': passed = Math.abs(leftValue - rightValue) >= 0.0001; break;
      }

      return {
        rule: expression,
        passed,
        value: leftValue,
        expected: `${comparison.operator} ${rightValue}`,
        usedVariables,
        severity
      };
    } else {
      // Not a comparison - evaluate as boolean (non-zero = true)
      const result = mathEvaluate(normalizedExpr, variables);
      return {
        rule: expression,
        passed: result.value !== 0,
        value: result.value,
        usedVariables,
        severity
      };
    }
  } catch (err) {
    return {
      rule: expression,
      passed: false,
      error: `Evaluation error: ${(err as Error).message}`,
      severity
    };
  }
}

/**
 * Evaluate all proportion rules
 */
export function evaluateProportionRules(
  rules: (ProportionRule | string)[],
  measurements: CrossBuilderMeasurements
): ProportionEvaluationResult {
  const results: ProportionRuleResult[] = [];
  const warnings: ProportionRuleResult[] = [];
  const errors: ProportionRuleResult[] = [];

  for (const rule of rules) {
    const result = evaluateProportionRule(rule, measurements);
    results.push(result);

    if (!result.passed) {
      if (result.severity === 'error') {
        errors.push(result);
      } else {
        warnings.push(result);
      }
    }
  }

  return {
    passed: errors.length === 0, // Only errors fail; warnings are advisory
    total: results.length,
    passedCount: results.filter(r => r.passed).length,
    failedCount: results.filter(r => !r.passed).length,
    results,
    warnings,
    errors
  };
}

/**
 * Collect measurements from composed builders.
 * Extracts measurements from TracedOutput.measurements for each sub-builder.
 */
export function collectCrossBuilderMeasurements(
  subBuilders: Map<string, { measurements: Map<string, { value: number }> }>
): CrossBuilderMeasurements {
  const measurements: CrossBuilderMeasurements = {};

  for (const [instanceName, output] of subBuilders) {
    if (output.measurements) {
      for (const [measurementName, measurement] of output.measurements) {
        const path = `${instanceName}.${measurementName}`;
        measurements[path] = measurement.value;
      }
    }
  }

  return measurements;
}
