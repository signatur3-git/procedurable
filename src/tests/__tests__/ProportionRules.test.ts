/**
 * ProportionRuleEvaluator Tests (F4-001)
 *
 * Tests for cross-builder proportion constraint evaluation
 */

import { describe, it, expect } from '@jest/globals';
import {
  extractVariablePaths,
  evaluateProportionRule,
  evaluateProportionRules,
  collectCrossBuilderMeasurements,
  CrossBuilderMeasurements
} from '../../generation/validation/ProportionRuleEvaluator';

describe('ProportionRuleEvaluator (F4-001)', () => {
  describe('extractVariablePaths', () => {
    it('should extract simple paths', () => {
      const paths = extractVariablePaths('table.height / chair.seat_height');
      expect(paths).toContain('table.height');
      expect(paths).toContain('chair.seat_height');
    });

    it('should extract paths with underscores', () => {
      const paths = extractVariablePaths('dining_table.total_height >= 0.75');
      expect(paths).toContain('dining_table.total_height');
    });

    it('should return unique paths only', () => {
      const paths = extractVariablePaths('table.height + table.height > 1.0');
      expect(paths).toHaveLength(1);
      expect(paths).toContain('table.height');
    });

    it('should return empty array for expressions without paths', () => {
      const paths = extractVariablePaths('2 + 2 == 4');
      expect(paths).toHaveLength(0);
    });
  });

  describe('evaluateProportionRule', () => {
    const measurements: CrossBuilderMeasurements = {
      'table.height': 0.75,
      'chair.seat_height': 0.45,
      'chair.total_height': 0.85,
      'table.width': 1.2
    };

    it('should evaluate >= comparisons', () => {
      const result = evaluateProportionRule(
        'table.height / chair.seat_height >= 1.5',
        measurements
      );
      expect(result.passed).toBe(true);
      expect(result.value).toBeCloseTo(1.667, 2);
    });

    it('should evaluate <= comparisons', () => {
      const result = evaluateProportionRule(
        'table.height / chair.seat_height <= 2.0',
        measurements
      );
      expect(result.passed).toBe(true);
    });

    it('should fail when rule is not satisfied', () => {
      const result = evaluateProportionRule(
        'table.height / chair.seat_height >= 2.0',
        measurements
      );
      expect(result.passed).toBe(false);
      expect(result.value).toBeCloseTo(1.667, 2);
      expect(result.expected).toBe('>= 2');
    });

    it('should handle missing measurements', () => {
      const result = evaluateProportionRule(
        'table.height / missing.value >= 1.0',
        measurements
      );
      expect(result.passed).toBe(false);
      expect(result.error).toContain('Missing measurement: missing.value');
    });

    it('should handle complex expressions', () => {
      const result = evaluateProportionRule(
        '(table.height + chair.seat_height) / table.width >= 1.0',
        measurements
      );
      expect(result.passed).toBe(true);
      expect(result.value).toBeCloseTo(1.0, 2);
    });

    it('should report used variables', () => {
      const result = evaluateProportionRule(
        'table.height >= 0.7',
        measurements
      );
      expect(result.usedVariables).toEqual({ 'table.height': 0.75 });
    });

    it('should respect severity setting', () => {
      const rule = {
        expression: 'table.height >= 1.0',
        severity: 'error' as const
      };
      const result = evaluateProportionRule(rule, measurements);
      expect(result.passed).toBe(false);
      expect(result.severity).toBe('error');
    });
  });

  describe('evaluateProportionRules', () => {
    const measurements: CrossBuilderMeasurements = {
      'table.height': 0.75,
      'chair.seat_height': 0.45,
      'chair.total_height': 0.85
    };

    it('should evaluate multiple rules', () => {
      const rules = [
        'table.height >= 0.7',
        'chair.seat_height <= 0.5',
        'table.height / chair.seat_height >= 1.5'
      ];

      const result = evaluateProportionRules(rules, measurements);
      expect(result.total).toBe(3);
      expect(result.passedCount).toBe(3);
      expect(result.passed).toBe(true);
    });

    it('should collect warnings for failed rules', () => {
      const rules = [
        'table.height >= 1.0',  // Will fail
        'chair.seat_height <= 0.5'  // Will pass
      ];

      const result = evaluateProportionRules(rules, measurements);
      expect(result.passed).toBe(true); // Warnings don't fail
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].rule).toBe('table.height >= 1.0');
    });

    it('should collect errors for failed rules with error severity', () => {
      const rules = [
        { expression: 'table.height >= 1.0', severity: 'error' as const },
        'chair.seat_height <= 0.5'
      ];

      const result = evaluateProportionRules(rules, measurements);
      expect(result.passed).toBe(false); // Errors fail
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('collectCrossBuilderMeasurements', () => {
    it('should collect measurements from sub-builders', () => {
      const subBuilders = new Map([
        ['table', {
          measurements: new Map([
            ['height', { value: 0.75 }],
            ['width', { value: 1.2 }]
          ])
        }],
        ['chair', {
          measurements: new Map([
            ['seat_height', { value: 0.45 }],
            ['total_height', { value: 0.85 }]
          ])
        }]
      ]);

      const measurements = collectCrossBuilderMeasurements(subBuilders as any);

      expect(measurements['table.height']).toBe(0.75);
      expect(measurements['table.width']).toBe(1.2);
      expect(measurements['chair.seat_height']).toBe(0.45);
      expect(measurements['chair.total_height']).toBe(0.85);
    });

    it('should handle empty sub-builders', () => {
      const subBuilders = new Map();
      const measurements = collectCrossBuilderMeasurements(subBuilders);
      expect(Object.keys(measurements)).toHaveLength(0);
    });
  });

  describe('integration: dining room proportions', () => {
    // Simulate a dining room with realistic measurements
    const diningRoomMeasurements: CrossBuilderMeasurements = {
      'dining_table.height': 0.75,
      'dining_table.width': 1.6,
      'dining_table.length': 0.9,
      'chair_north.seat_height': 0.45,
      'chair_north.total_height': 0.85,
      'chair_south.seat_height': 0.45,
      'chair_south.total_height': 0.85
    };

    it('should validate table-to-chair height ratio', () => {
      const rules = [
        // Standard dining: table height should be ~30cm above seat
        'dining_table.height - chair_north.seat_height >= 0.25',
        'dining_table.height - chair_north.seat_height <= 0.35'
      ];

      const result = evaluateProportionRules(rules, diningRoomMeasurements);
      expect(result.passed).toBe(true);
      expect(result.passedCount).toBe(2);
    });

    it('should detect invalid proportions', () => {
      // Chair too high for table
      const badMeasurements = {
        ...diningRoomMeasurements,
        'chair_north.seat_height': 0.65  // Way too high
      };

      const rules = [
        'dining_table.height - chair_north.seat_height >= 0.25'
      ];

      const result = evaluateProportionRules(rules, badMeasurements);
      expect(result.passed).toBe(true); // Warnings don't fail
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].value).toBeCloseTo(0.1, 2); // 0.75 - 0.65 = 0.1
    });
  });
});
