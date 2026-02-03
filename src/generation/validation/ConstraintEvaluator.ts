/**
 * ConstraintEvaluator - Evaluates constraint schemas against variable bindings
 *
 * F1-001: Constraint Schema Definition
 *
 * Constraints extend the ExpressionService with domain-specific predicates:
 * - expression: arbitrary boolean expressions
 * - unique: no duplicates in a set/grid column
 * - range: value within min/max bounds
 * - reference: value must exist in a lookup table
 */

import { evaluateNumeric, evaluateCondition, type EvaluationContext } from '../builder/ExpressionService';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Variable types supported in constraint schemas
 */
export type ConstraintVariableType = 'number' | 'string' | 'boolean' | 'position' | 'set' | 'grid';

/**
 * Variable definition in a constraint schema
 */
export interface ConstraintVariable {
  type: ConstraintVariableType;
  description?: string;
  /** For grid type: [rows, cols] */
  dimensions?: [number, number];
  /** For grid type: type of each cell */
  cell_type?: 'number' | 'string' | 'boolean';
  /** For set type: type of elements */
  element_type?: 'number' | 'string' | 'position';
}

/**
 * Base interface for constraint rules
 */
export interface ConstraintRuleBase {
  description?: string;
}

/**
 * Expression rule: arbitrary boolean expression
 */
export interface ExpressionRule extends ConstraintRuleBase {
  type: 'expression';
  expression: string;
}

/**
 * Unique rule: no duplicates in a set or grid column
 */
export interface UniqueRule extends ConstraintRuleBase {
  type: 'unique';
  /** Variable name (must be set or grid type) */
  target: string;
  /** For grid: column/property to check for uniqueness */
  key?: string;
}

/**
 * Range rule: value within min/max bounds
 */
export interface RangeRule extends ConstraintRuleBase {
  type: 'range';
  /** Variable name to check */
  target: string;
  min?: number | string;  // Can be expression
  max?: number | string;  // Can be expression
}

/**
 * Reference rule: value must exist in a lookup table
 */
export interface ReferenceRule extends ConstraintRuleBase {
  type: 'reference';
  /** Variable name to check */
  target: string;
  /** Allowed values (literal array or variable name) */
  allowed: string[] | string;
}

/**
 * Union of all rule types
 */
export type ConstraintRule = ExpressionRule | UniqueRule | RangeRule | ReferenceRule;

/**
 * Constraint schema definition
 */
export interface ConstraintSchema {
  name: string;
  description?: string;
  variables: Record<string, ConstraintVariable>;
  rules: ConstraintRule[];
}

/**
 * Result of evaluating a single rule
 */
export interface RuleResult {
  rule: ConstraintRule;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

/**
 * Result of evaluating an entire constraint schema
 */
export interface ConstraintResult {
  schema: string;
  passed: boolean;
  results: RuleResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

// =============================================================================
// CONSTRAINT EVALUATOR
// =============================================================================

/**
 * Evaluates constraint schemas against variable bindings
 */
export class ConstraintEvaluator {
  /**
   * Validate a constraint schema definition
   */
  static validateSchema(schema: ConstraintSchema): string[] {
    const errors: string[] = [];

    if (!schema.name) {
      errors.push('Schema must have a name');
    }

    if (!schema.variables || Object.keys(schema.variables).length === 0) {
      errors.push('Schema must define at least one variable');
    }

    if (!schema.rules || schema.rules.length === 0) {
      errors.push('Schema must define at least one rule');
    }

    // Validate variable definitions
    for (const [name, variable] of Object.entries(schema.variables || {})) {
      const validTypes: ConstraintVariableType[] = ['number', 'string', 'boolean', 'position', 'set', 'grid'];
      if (!validTypes.includes(variable.type)) {
        errors.push(`Variable '${name}' has invalid type '${variable.type}'`);
      }

      if (variable.type === 'grid' && !variable.dimensions) {
        errors.push(`Grid variable '${name}' must specify dimensions`);
      }
    }

    // Validate rules
    for (let i = 0; i < (schema.rules || []).length; i++) {
      const rule = schema.rules[i];
      const ruleId = rule.description || `rule[${i}]`;

      if (rule.type === 'expression') {
        if (!rule.expression) {
          errors.push(`${ruleId}: expression rule must have 'expression' field`);
        }
      } else if (rule.type === 'unique') {
        if (!rule.target) {
          errors.push(`${ruleId}: unique rule must have 'target' field`);
        } else if (schema.variables && schema.variables[rule.target]) {
          const varType = schema.variables[rule.target].type;
          if (varType !== 'set' && varType !== 'grid') {
            errors.push(`${ruleId}: unique rule target '${rule.target}' must be set or grid type`);
          }
        }
      } else if (rule.type === 'range') {
        if (!rule.target) {
          errors.push(`${ruleId}: range rule must have 'target' field`);
        }
        if (rule.min === undefined && rule.max === undefined) {
          errors.push(`${ruleId}: range rule must have 'min' and/or 'max'`);
        }
      } else if (rule.type === 'reference') {
        if (!rule.target) {
          errors.push(`${ruleId}: reference rule must have 'target' field`);
        }
        if (!rule.allowed) {
          errors.push(`${ruleId}: reference rule must have 'allowed' field`);
        }
      } else {
        errors.push(`${ruleId}: unknown rule type '${(rule as any).type}'`);
      }
    }

    return errors;
  }

  /**
   * Evaluate a constraint schema against variable bindings
   */
  static evaluate(
    schema: ConstraintSchema,
    bindings: Record<string, any>
  ): ConstraintResult {
    const results: RuleResult[] = [];

    // Create expression context from bindings
    const context = new Map<string, any>();
    for (const [name, value] of Object.entries(bindings)) {
      context.set(name, value);
    }

    // Evaluate each rule
    for (const rule of schema.rules) {
      const result = this.evaluateRule(rule, bindings, context);
      results.push(result);
    }

    const passed = results.every(r => r.passed);
    const passedCount = results.filter(r => r.passed).length;

    return {
      schema: schema.name,
      passed,
      results,
      summary: {
        total: results.length,
        passed: passedCount,
        failed: results.length - passedCount
      }
    };
  }

  /**
   * Evaluate a single rule
   */
  private static evaluateRule(
    rule: ConstraintRule,
    bindings: Record<string, any>,
    context: Map<string, any>
  ): RuleResult {
    try {
      switch (rule.type) {
        case 'expression':
          return this.evaluateExpressionRule(rule, context);
        case 'unique':
          return this.evaluateUniqueRule(rule, bindings);
        case 'range':
          return this.evaluateRangeRule(rule, bindings, context);
        case 'reference':
          return this.evaluateReferenceRule(rule, bindings);
        default:
          return {
            rule,
            passed: false,
            message: `Unknown rule type: ${(rule as any).type}`
          };
      }
    } catch (err: any) {
      return {
        rule,
        passed: false,
        message: `Error evaluating rule: ${err.message}`
      };
    }
  }

  /**
   * Evaluate an expression rule
   */
  private static evaluateExpressionRule(
    rule: ExpressionRule,
    context: Map<string, any>
  ): RuleResult {
    // Convert Map to Record for EvaluationContext
    const measurements: Record<string, number> = {};
    for (const [key, value] of context) {
      if (typeof value === 'number') {
        measurements[key] = value;
      }
    }

    const evalCtx: EvaluationContext = {
      measurements,
      decisions: new Map(),
      constraints: {}
    };

    const passed = evaluateCondition(rule.expression, evalCtx);

    return {
      rule,
      passed,
      message: passed
        ? `Expression '${rule.expression}' is true`
        : `Expression '${rule.expression}' is false`,
      details: { expression: rule.expression }
    };
  }

  /**
   * Evaluate a uniqueness rule
   */
  private static evaluateUniqueRule(
    rule: UniqueRule,
    bindings: Record<string, any>
  ): RuleResult {
    const value = bindings[rule.target];

    if (value === undefined) {
      return {
        rule,
        passed: false,
        message: `Variable '${rule.target}' not found in bindings`
      };
    }

    // Handle set type
    if (Array.isArray(value) && !Array.isArray(value[0])) {
      const seen = new Set<any>();
      const duplicates: any[] = [];

      for (const item of value) {
        const key = rule.key ? item[rule.key] : item;
        if (seen.has(key)) {
          duplicates.push(key);
        } else {
          seen.add(key);
        }
      }

      const passed = duplicates.length === 0;
      return {
        rule,
        passed,
        message: passed
          ? `All values in '${rule.target}' are unique`
          : `Duplicates found in '${rule.target}': ${duplicates.join(', ')}`,
        details: { duplicates }
      };
    }

    // Handle grid type (2D array)
    if (Array.isArray(value) && Array.isArray(value[0])) {
      const seen = new Set<string>();
      const duplicates: string[] = [];

      for (let row = 0; row < value.length; row++) {
        for (let col = 0; col < value[row].length; col++) {
          const cell = value[row][col];
          if (cell !== null && cell !== undefined && cell !== '') {
            const key = rule.key ? `${row},${col}` : String(cell);
            if (rule.key) {
              // For grids, check that no two cells have the same position with content
              // (i.e., each position can only have one piece)
              if (seen.has(key) && cell) {
                duplicates.push(`(${row},${col})`);
              } else if (cell) {
                seen.add(key);
              }
            } else {
              // Check for duplicate values
              if (seen.has(key)) {
                duplicates.push(key);
              } else {
                seen.add(key);
              }
            }
          }
        }
      }

      const passed = duplicates.length === 0;
      return {
        rule,
        passed,
        message: passed
          ? `Grid '${rule.target}' has no duplicates`
          : `Duplicates in grid '${rule.target}': ${duplicates.join(', ')}`,
        details: { duplicates }
      };
    }

    return {
      rule,
      passed: false,
      message: `Variable '${rule.target}' is not a set or grid`
    };
  }

  /**
   * Evaluate a range rule
   */
  private static evaluateRangeRule(
    rule: RangeRule,
    bindings: Record<string, any>,
    context: Map<string, any>
  ): RuleResult {
    const value = bindings[rule.target];

    if (value === undefined) {
      return {
        rule,
        passed: false,
        message: `Variable '${rule.target}' not found in bindings`
      };
    }

    if (typeof value !== 'number') {
      return {
        rule,
        passed: false,
        message: `Variable '${rule.target}' is not a number`
      };
    }

    let min: number | undefined;
    let max: number | undefined;

    // Convert Map to Record for EvaluationContext
    const measurements: Record<string, number> = {};
    for (const [key, val] of context) {
      if (typeof val === 'number') {
        measurements[key] = val;
      }
    }

    const evalCtx: EvaluationContext = {
      measurements,
      decisions: new Map(),
      constraints: {}
    };

    if (rule.min !== undefined) {
      min = typeof rule.min === 'number' ? rule.min : evaluateNumeric(rule.min, evalCtx);
    }

    if (rule.max !== undefined) {
      max = typeof rule.max === 'number' ? rule.max : evaluateNumeric(rule.max, evalCtx);
    }

    const belowMin = min !== undefined && value < min;
    const aboveMax = max !== undefined && value > max;
    const passed = !belowMin && !aboveMax;

    let message: string;
    if (passed) {
      message = `${rule.target}=${value} is within range`;
      if (min !== undefined && max !== undefined) {
        message += ` [${min}, ${max}]`;
      } else if (min !== undefined) {
        message += ` [${min}, ∞)`;
      } else if (max !== undefined) {
        message += ` (-∞, ${max}]`;
      }
    } else if (belowMin) {
      message = `${rule.target}=${value} is below minimum ${min}`;
    } else {
      message = `${rule.target}=${value} is above maximum ${max}`;
    }

    return {
      rule,
      passed,
      message,
      details: { value, min, max }
    };
  }

  /**
   * Evaluate a reference rule
   */
  private static evaluateReferenceRule(
    rule: ReferenceRule,
    bindings: Record<string, any>
  ): RuleResult {
    const value = bindings[rule.target];

    if (value === undefined) {
      return {
        rule,
        passed: false,
        message: `Variable '${rule.target}' not found in bindings`
      };
    }

    // Get allowed values
    let allowed: any[];
    if (Array.isArray(rule.allowed)) {
      allowed = rule.allowed;
    } else if (typeof rule.allowed === 'string') {
      // Reference to another variable
      const ref = bindings[rule.allowed];
      if (!Array.isArray(ref)) {
        return {
          rule,
          passed: false,
          message: `Reference '${rule.allowed}' is not an array`
        };
      }
      allowed = ref;
    } else {
      return {
        rule,
        passed: false,
        message: `Invalid 'allowed' specification`
      };
    }

    const passed = allowed.includes(value);

    return {
      rule,
      passed,
      message: passed
        ? `${rule.target}='${value}' is in allowed set`
        : `${rule.target}='${value}' is not in allowed set [${allowed.join(', ')}]`,
      details: { value, allowed }
    };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Count occurrences of a value in a collection
 * Used in expression rules like: count(board, 'K') == 1
 */
export function countInCollection(collection: any[], value: any): number {
  if (!Array.isArray(collection)) return 0;

  // Flat array
  if (!Array.isArray(collection[0])) {
    return collection.filter(item => item === value).length;
  }

  // 2D grid
  let count = 0;
  for (const row of collection) {
    for (const cell of row) {
      if (cell === value) count++;
    }
  }
  return count;
}

/**
 * Check if a collection contains a value
 */
export function containsValue(collection: any[], value: any): boolean {
  if (!Array.isArray(collection)) return false;

  // Flat array
  if (!Array.isArray(collection[0])) {
    return collection.includes(value);
  }

  // 2D grid
  for (const row of collection) {
    if (row.includes(value)) return true;
  }
  return false;
}
