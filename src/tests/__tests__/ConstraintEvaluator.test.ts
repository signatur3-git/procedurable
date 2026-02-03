/**
 * ConstraintEvaluator Tests (F1-001: Constraint Schema Definition)
 *
 * Tests for the constraint schema evaluation system.
 */

import { describe, it, expect } from '@jest/globals';
import {
  ConstraintEvaluator,
  ConstraintSchema
} from '../../generation/validation/ConstraintEvaluator';

describe('ConstraintEvaluator (F1-001)', () => {
  describe('Schema Validation', () => {
    it('should reject schema without name', () => {
      const schema: ConstraintSchema = {
        name: '',
        variables: { x: { type: 'number' } },
        rules: [{ type: 'expression', expression: 'x > 0' }]
      };

      const errors = ConstraintEvaluator.validateSchema(schema);
      expect(errors).toContain('Schema must have a name');
    });

    it('should reject schema without variables', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: {},
        rules: [{ type: 'expression', expression: 'true' }]
      };

      const errors = ConstraintEvaluator.validateSchema(schema);
      expect(errors).toContain('Schema must define at least one variable');
    });

    it('should reject schema without rules', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: { x: { type: 'number' } },
        rules: []
      };

      const errors = ConstraintEvaluator.validateSchema(schema);
      expect(errors).toContain('Schema must define at least one rule');
    });

    it('should reject invalid variable types', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: { x: { type: 'invalid' as any } },
        rules: [{ type: 'expression', expression: 'true' }]
      };

      const errors = ConstraintEvaluator.validateSchema(schema);
      expect(errors.some(e => e.includes("invalid type 'invalid'"))).toBe(true);
    });

    it('should reject grid variable without dimensions', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: { board: { type: 'grid' } },
        rules: [{ type: 'expression', expression: 'true' }]
      };

      const errors = ConstraintEvaluator.validateSchema(schema);
      expect(errors.some(e => e.includes('must specify dimensions'))).toBe(true);
    });

    it('should accept valid schema', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        description: 'A test schema',
        variables: { x: { type: 'number' } },
        rules: [{ type: 'expression', expression: 'x > 0' }]
      };

      const errors = ConstraintEvaluator.validateSchema(schema);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Expression Rules', () => {
    it('should evaluate simple comparison', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: { x: { type: 'number' } },
        rules: [{ type: 'expression', expression: 'x > 5' }]
      };

      const result1 = ConstraintEvaluator.evaluate(schema, { x: 10 });
      expect(result1.passed).toBe(true);

      const result2 = ConstraintEvaluator.evaluate(schema, { x: 3 });
      expect(result2.passed).toBe(false);
    });

    it('should evaluate arithmetic expressions', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: {
          a: { type: 'number' },
          b: { type: 'number' }
        },
        rules: [{ type: 'expression', expression: 'a + b <= 10' }]
      };

      const result1 = ConstraintEvaluator.evaluate(schema, { a: 3, b: 5 });
      expect(result1.passed).toBe(true);

      const result2 = ConstraintEvaluator.evaluate(schema, { a: 7, b: 8 });
      expect(result2.passed).toBe(false);
    });

    it('should evaluate comparison with equality', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: {
          a: { type: 'number' },
          b: { type: 'number' }
        },
        rules: [{ type: 'expression', expression: 'a == b' }]
      };

      const result1 = ConstraintEvaluator.evaluate(schema, { a: 5, b: 5 });
      expect(result1.passed).toBe(true);

      const result2 = ConstraintEvaluator.evaluate(schema, { a: 5, b: 3 });
      expect(result2.passed).toBe(false);
    });
  });

  describe('Unique Rules', () => {
    it('should detect duplicates in a set', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: { items: { type: 'set', element_type: 'string' } },
        rules: [{ type: 'unique', target: 'items' }]
      };

      const result1 = ConstraintEvaluator.evaluate(schema, { items: ['a', 'b', 'c'] });
      expect(result1.passed).toBe(true);

      const result2 = ConstraintEvaluator.evaluate(schema, { items: ['a', 'b', 'a'] });
      expect(result2.passed).toBe(false);
      expect(result2.results[0].details?.duplicates).toContain('a');
    });

    it('should handle empty set', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: { items: { type: 'set', element_type: 'number' } },
        rules: [{ type: 'unique', target: 'items' }]
      };

      const result = ConstraintEvaluator.evaluate(schema, { items: [] });
      expect(result.passed).toBe(true);
    });
  });

  describe('Range Rules', () => {
    it('should check value within range', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: { x: { type: 'number' } },
        rules: [{ type: 'range', target: 'x', min: 0, max: 100 }]
      };

      const result1 = ConstraintEvaluator.evaluate(schema, { x: 50 });
      expect(result1.passed).toBe(true);

      const result2 = ConstraintEvaluator.evaluate(schema, { x: -5 });
      expect(result2.passed).toBe(false);

      const result3 = ConstraintEvaluator.evaluate(schema, { x: 150 });
      expect(result3.passed).toBe(false);
    });

    it('should handle min-only range', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: { x: { type: 'number' } },
        rules: [{ type: 'range', target: 'x', min: 0 }]
      };

      const result1 = ConstraintEvaluator.evaluate(schema, { x: 1000 });
      expect(result1.passed).toBe(true);

      const result2 = ConstraintEvaluator.evaluate(schema, { x: -1 });
      expect(result2.passed).toBe(false);
    });

    it('should handle max-only range', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: { x: { type: 'number' } },
        rules: [{ type: 'range', target: 'x', max: 100 }]
      };

      const result1 = ConstraintEvaluator.evaluate(schema, { x: -1000 });
      expect(result1.passed).toBe(true);

      const result2 = ConstraintEvaluator.evaluate(schema, { x: 101 });
      expect(result2.passed).toBe(false);
    });

    it('should handle expression-based bounds', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: {
          value: { type: 'number' },
          limit: { type: 'number' }
        },
        rules: [{ type: 'range', target: 'value', min: 0, max: 'limit' }]
      };

      const result1 = ConstraintEvaluator.evaluate(schema, { value: 50, limit: 100 });
      expect(result1.passed).toBe(true);

      const result2 = ConstraintEvaluator.evaluate(schema, { value: 50, limit: 40 });
      expect(result2.passed).toBe(false);
    });
  });

  describe('Reference Rules', () => {
    it('should check value in allowed set', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: { piece: { type: 'string' } },
        rules: [{
          type: 'reference',
          target: 'piece',
          allowed: ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']
        }]
      };

      const result1 = ConstraintEvaluator.evaluate(schema, { piece: 'king' });
      expect(result1.passed).toBe(true);

      const result2 = ConstraintEvaluator.evaluate(schema, { piece: 'dragon' });
      expect(result2.passed).toBe(false);
    });

    it('should check value against variable reference', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: {
          selected: { type: 'string' },
          options: { type: 'set', element_type: 'string' }
        },
        rules: [{
          type: 'reference',
          target: 'selected',
          allowed: 'options'
        }]
      };

      const result1 = ConstraintEvaluator.evaluate(schema, {
        selected: 'red',
        options: ['red', 'green', 'blue']
      });
      expect(result1.passed).toBe(true);

      const result2 = ConstraintEvaluator.evaluate(schema, {
        selected: 'yellow',
        options: ['red', 'green', 'blue']
      });
      expect(result2.passed).toBe(false);
    });
  });

  describe('Multiple Rules', () => {
    it('should evaluate all rules and aggregate results', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: {
          x: { type: 'number' },
          y: { type: 'number' }
        },
        rules: [
          { type: 'range', target: 'x', min: 0, max: 100 },
          { type: 'range', target: 'y', min: 0, max: 100 },
          { type: 'expression', expression: 'x + y <= 100' }
        ]
      };

      const result1 = ConstraintEvaluator.evaluate(schema, { x: 30, y: 40 });
      expect(result1.passed).toBe(true);
      expect(result1.summary.total).toBe(3);
      expect(result1.summary.passed).toBe(3);

      const result2 = ConstraintEvaluator.evaluate(schema, { x: 60, y: 60 });
      expect(result2.passed).toBe(false);
      expect(result2.summary.passed).toBe(2); // ranges pass
      expect(result2.summary.failed).toBe(1); // sum > 100
    });
  });

  describe('Error Handling', () => {
    it('should handle missing variable in bindings', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: { x: { type: 'number' } },
        rules: [{ type: 'range', target: 'x', min: 0 }]
      };

      const result = ConstraintEvaluator.evaluate(schema, {});
      expect(result.passed).toBe(false);
      expect(result.results[0].message).toContain('not found');
    });

    it('should handle invalid variable type', () => {
      const schema: ConstraintSchema = {
        name: 'test',
        variables: { x: { type: 'number' } },
        rules: [{ type: 'range', target: 'x', min: 0 }]
      };

      const result = ConstraintEvaluator.evaluate(schema, { x: 'not a number' });
      expect(result.passed).toBe(false);
      expect(result.results[0].message).toContain('not a number');
    });
  });
});
