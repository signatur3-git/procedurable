/**
 * ExpressionService Tests
 *
 * Ensures unified expression evaluation works consistently
 * across all contexts (derived, when, compose, geometry)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  evaluateNumeric,
  evaluateCondition,
  evaluatePosition,
  EvaluationContext
} from '../../builder/ExpressionService';

describe('ExpressionService', () => {
  let ctx: EvaluationContext;

  beforeEach(() => {
    ctx = {
      decisions: new Map<string, any>([
        ['is_round', true],
        ['has_legs', false],
        ['leg_count', 4],
        ['style', 'modern'],
        ['size', 'medium'],
        ['taper_ratio', 0.8]
      ]),
      measurements: {
        width: 1.0,
        height: 0.5,
        depth: 0.8,
        seat_width: 0.45,
        half_width: 0.225
      },
      constraints: {
        max_width: 1.5,
        max_height: 2.0,
        min_width: 0.3
      }
    };
  });

  describe('evaluateNumeric', () => {
    it('should evaluate simple arithmetic', () => {
      expect(evaluateNumeric('2 + 3', ctx)).toBe(5);
      expect(evaluateNumeric('width * 2', ctx)).toBe(2.0);
      expect(evaluateNumeric('width + height', ctx)).toBe(1.5);
    });

    it('should access measurements', () => {
      expect(evaluateNumeric('seat_width', ctx)).toBe(0.45);
      expect(evaluateNumeric('half_width * 2', ctx)).toBeCloseTo(0.45);
    });

    it('should access numeric decisions', () => {
      expect(evaluateNumeric('leg_count', ctx)).toBe(4);
      expect(evaluateNumeric('taper_ratio * 100', ctx)).toBe(80);
    });

    it('should handle boolean decisions as 0/1', () => {
      expect(evaluateNumeric('is_round', ctx)).toBe(1);
      expect(evaluateNumeric('has_legs', ctx)).toBe(0);
    });

    it('should access constraints with @ prefix', () => {
      expect(evaluateNumeric('@max_width', ctx)).toBe(1.5);
      expect(evaluateNumeric('min(width, @max_width)', ctx)).toBe(1.0);
    });

    it('should use default constraint values', () => {
      // max_depth not set, should default to 999
      expect(evaluateNumeric('@max_depth', ctx)).toBe(999);
      // min_depth not set, should default to 0
      expect(evaluateNumeric('@min_depth', ctx)).toBe(0);
    });

    it('should evaluate if() expressions', () => {
      expect(evaluateNumeric('if(is_round, 0.5, 0.4)', ctx)).toBe(0.5);
      expect(evaluateNumeric('if(has_legs, 4, 0)', ctx)).toBe(0);
    });

    it('should evaluate eq() for string comparison', () => {
      expect(evaluateNumeric("eq(style, 'modern')", ctx)).toBe(1);
      expect(evaluateNumeric("eq(style, 'classic')", ctx)).toBe(0);
    });

    it('should evaluate nested if() with eq()', () => {
      const expr = "if(eq(size, 'small'), 0.7, if(eq(size, 'large'), 1.4, 1.0))";
      expect(evaluateNumeric(expr, ctx)).toBe(1.0); // size is 'medium'

      ctx.decisions.set('size', 'small');
      expect(evaluateNumeric(expr, ctx)).toBe(0.7);

      ctx.decisions.set('size', 'large');
      expect(evaluateNumeric(expr, ctx)).toBe(1.4);
    });

    it('should handle math functions', () => {
      expect(evaluateNumeric('sin(0)', ctx)).toBe(0);
      expect(evaluateNumeric('cos(0)', ctx)).toBe(1);
      expect(evaluateNumeric('sqrt(4)', ctx)).toBe(2);
      expect(evaluateNumeric('min(width, height)', ctx)).toBe(0.5);
      expect(evaluateNumeric('max(width, height)', ctx)).toBe(1.0);
    });
  });

  describe('evaluateCondition', () => {
    describe('boolean decisions', () => {
      it('should evaluate truthy boolean decisions', () => {
        expect(evaluateCondition('is_round', ctx)).toBe(true);
      });

      it('should evaluate falsy boolean decisions', () => {
        expect(evaluateCondition('has_legs', ctx)).toBe(false);
      });

      it('should handle $ prefix', () => {
        expect(evaluateCondition('$is_round', ctx)).toBe(true);
      });
    });

    describe('string equality', () => {
      it('should handle == with unquoted value', () => {
        expect(evaluateCondition('style == modern', ctx)).toBe(true);
        expect(evaluateCondition('style == classic', ctx)).toBe(false);
      });

      it('should handle == with single-quoted value', () => {
        expect(evaluateCondition("style == 'modern'", ctx)).toBe(true);
        expect(evaluateCondition("size == 'medium'", ctx)).toBe(true);
      });

      it('should handle == with double-quoted value', () => {
        expect(evaluateCondition('style == "modern"', ctx)).toBe(true);
      });

      it('should handle eq() function', () => {
        expect(evaluateCondition("eq(style, 'modern')", ctx)).toBe(true);
        expect(evaluateCondition("eq(style, 'classic')", ctx)).toBe(false);
      });
    });

    describe('string inequality', () => {
      it('should handle != operator', () => {
        expect(evaluateCondition('style != classic', ctx)).toBe(true);
        expect(evaluateCondition('style != modern', ctx)).toBe(false);
      });
    });

    describe('numeric comparisons', () => {
      it('should handle > operator', () => {
        expect(evaluateCondition('leg_count > 2', ctx)).toBe(true);
        expect(evaluateCondition('leg_count > 5', ctx)).toBe(false);
      });

      it('should handle >= operator', () => {
        expect(evaluateCondition('leg_count >= 4', ctx)).toBe(true);
        expect(evaluateCondition('leg_count >= 5', ctx)).toBe(false);
      });

      it('should handle < operator', () => {
        expect(evaluateCondition('leg_count < 5', ctx)).toBe(true);
        expect(evaluateCondition('leg_count < 4', ctx)).toBe(false);
      });

      it('should handle <= operator', () => {
        expect(evaluateCondition('leg_count <= 4', ctx)).toBe(true);
        expect(evaluateCondition('leg_count <= 3', ctx)).toBe(false);
      });

      it('should work with measurements', () => {
        expect(evaluateCondition('width > 0.5', ctx)).toBe(true);
        expect(evaluateCondition('height < 1', ctx)).toBe(true);
      });
    });

    describe('complex conditions via MathService', () => {
      it('should evaluate if() as condition', () => {
        expect(evaluateCondition("if(eq(size, 'medium'), 1, 0)", ctx)).toBe(true);
        expect(evaluateCondition("if(eq(size, 'small'), 1, 0)", ctx)).toBe(false);
      });

      it('should evaluate numeric expressions as boolean', () => {
        expect(evaluateCondition('leg_count - 4', ctx)).toBe(false); // 0 = false
        expect(evaluateCondition('leg_count - 3', ctx)).toBe(true);  // 1 = true
      });
    });
  });

  describe('evaluatePosition', () => {
    it('should return numbers directly', () => {
      expect(evaluatePosition(1.5, ctx)).toBe(1.5);
      expect(evaluatePosition(0, ctx)).toBe(0);
    });

    it('should evaluate expression strings', () => {
      expect(evaluatePosition('width / 2', ctx)).toBe(0.5);
      expect(evaluatePosition('-half_width', ctx)).toBe(-0.225);
    });

    it('should access decisions in position expressions', () => {
      expect(evaluatePosition('width * taper_ratio', ctx)).toBe(0.8);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined decision in condition', () => {
      expect(evaluateCondition('nonexistent', ctx)).toBe(false);
    });

    it('should handle empty string condition', () => {
      expect(evaluateCondition('', ctx)).toBe(false);
    });

    it('should handle whitespace in conditions', () => {
      expect(evaluateCondition('  is_round  ', ctx)).toBe(true);
      expect(evaluateCondition('style  ==  modern', ctx)).toBe(true);
    });

    it('should throw on invalid expression', () => {
      expect(() => evaluateNumeric('invalid + +', ctx)).toThrow();
    });
  });
});
