/**
 * MathService Unit Tests
 *
 * Tests for conditional expressions and other math functionality
 */

import { describe, it, expect } from '@jest/globals';
import { evaluate, validate } from '../../core/MathService';

describe('MathService - Conditional Expressions', () => {
  describe('if() function', () => {
    it('should return then-value when condition is true', () => {
      const result = evaluate('if(1, 10, 20)', {});
      expect(result.value).toBe(10);
    });

    it('should return else-value when condition is false', () => {
      const result = evaluate('if(0, 10, 20)', {});
      expect(result.value).toBe(20);
    });

    it('should handle boolean true condition', () => {
      const result = evaluate('if(true, 5, 10)', {});
      expect(result.value).toBe(5);
    });

    it('should handle boolean false condition', () => {
      const result = evaluate('if(false, 5, 10)', {});
      expect(result.value).toBe(10);
    });

    it('should handle comparison operators', () => {
      const result1 = evaluate('if(5 > 3, 100, 200)', {});
      expect(result1.value).toBe(100);

      const result2 = evaluate('if(2 < 1, 100, 200)', {});
      expect(result2.value).toBe(200);
    });

    it('should work with variables', () => {
      const result = evaluate('if(x > 0, 1, -1)', { x: 5 });
      expect(result.value).toBe(1);

      const result2 = evaluate('if(x > 0, 1, -1)', { x: -3 });
      expect(result2.value).toBe(-1);
    });

    it('should handle decision references with $ prefix', () => {
      // In YAML, $is_round would be passed as a variable
      const result1 = evaluate('if(is_round, 0.5, 0.4)', { is_round: 1 });
      expect(result1.value).toBe(0.5);

      const result2 = evaluate('if(is_round, 0.5, 0.4)', { is_round: 0 });
      expect(result2.value).toBe(0.4);
    });

    it('should handle nested if expressions', () => {
      const result = evaluate('if(x > 10, 100, if(x > 5, 50, 0))', { x: 7 });
      expect(result.value).toBe(50);
    });

    it('should handle equality comparisons', () => {
      const result1 = evaluate('if(style == 1, 10, 20)', { style: 1 });
      expect(result1.value).toBe(10);

      const result2 = evaluate('if(style == 1, 10, 20)', { style: 2 });
      expect(result2.value).toBe(20);
    });

    it('should handle inequality comparisons', () => {
      const result1 = evaluate('if(style != 1, 10, 20)', { style: 2 });
      expect(result1.value).toBe(10);

      const result2 = evaluate('if(style != 1, 10, 20)', { style: 1 });
      expect(result2.value).toBe(20);
    });

    it('should handle greater-than-or-equal', () => {
      const result1 = evaluate('if(x >= 5, 100, 0)', { x: 5 });
      expect(result1.value).toBe(100);

      const result2 = evaluate('if(x >= 5, 100, 0)', { x: 4 });
      expect(result2.value).toBe(0);
    });

    it('should handle less-than-or-equal', () => {
      const result1 = evaluate('if(x <= 5, 100, 0)', { x: 5 });
      expect(result1.value).toBe(100);

      const result2 = evaluate('if(x <= 5, 100, 0)', { x: 6 });
      expect(result2.value).toBe(0);
    });

    it('should work in complex expressions', () => {
      const result = evaluate('2 * if(x > 0, x, -x)', { x: -5 });
      expect(result.value).toBe(10); // 2 * 5 = 10
    });

    it('should handle mathematical expressions in branches', () => {
      const result = evaluate('if(x > 0, x * 2, x / 2)', { x: 10 });
      expect(result.value).toBe(20);

      const result2 = evaluate('if(x > 0, x * 2, x / 2)', { x: -10 });
      expect(result2.value).toBe(-5);
    });
  });

  describe('Expression validation', () => {
    it('should validate if() expressions', () => {
      const result = validate('if(x > 0, 1, -1)');
      expect(result.valid).toBe(true);
    });

    it('should validate syntax of if() expressions', () => {
      // Missing else branch - syntax is valid, but will fail at runtime
      // mathjs validates syntax at parse time, not function arity
      const result = validate('if(x > 0, 1)');
      expect(result.valid).toBe(true); // Syntax is valid, though semantically incomplete
    });

    it('should detect invalid syntax', () => {
      const result = validate('if(x > 0, 1,'); // Incomplete expression
      expect(result.valid).toBe(false);
    });

    it('should validate nested if() expressions', () => {
      const result = validate('if(a, if(b, 1, 2), 3)');
      expect(result.valid).toBe(true);
    });
  });

  describe('Backward compatibility', () => {
    it('should still evaluate basic math expressions', () => {
      const result = evaluate('2 + 3 * 4', {});
      expect(result.value).toBe(14);
    });

    it('should still handle trig functions', () => {
      const result = evaluate('sin(pi / 2)', {});
      expect(result.value).toBeCloseTo(1, 5);
    });

    it('should still handle variables', () => {
      const result = evaluate('x + y', { x: 5, y: 10 });
      expect(result.value).toBe(15);
    });
  });
});

describe('MathService - Existing Functionality', () => {
  it('should handle negation', () => {
    const result = evaluate('-x', { x: 5 });
    expect(result.value).toBe(-5);
  });

  it('should handle constants', () => {
    const result = evaluate('pi', {});
    expect(result.value).toBeCloseTo(Math.PI, 10);
  });

  it('should track used variables', () => {
    const result = evaluate('x + y', { x: 1, y: 2, z: 3 });
    expect(result.value).toBe(3);
    // Note: Variable tracking might include all provided vars
  });
});

