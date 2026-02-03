/**
 * Constraint Integration Tests (F1-002)
 *
 * Tests for constraint evaluation integrated with YAML builders.
 */

import { describe, it, expect } from '@jest/globals';
import { parseAndExecuteBuilder, parseYamlWithLibrary } from '../../generation/builder/YamlBuilderParser';
import { ConstraintSchema } from '../../generation/validation/ConstraintEvaluator';

// Simple constraint schemas for testing
const rangeConstraint: ConstraintSchema = {
  name: 'dimension_range',
  description: 'Dimensions must be within reasonable bounds',
  variables: {
    width: { type: 'number' },
    height: { type: 'number' }
  },
  rules: [
    { type: 'range', target: 'width', min: 0.1, max: 2.0 },
    { type: 'range', target: 'height', min: 0.1, max: 2.0 }
  ]
};

const expressionConstraint: ConstraintSchema = {
  name: 'proportion_check',
  description: 'Height must be greater than width',
  variables: {
    w: { type: 'number' },
    h: { type: 'number' }
  },
  rules: [
    { type: 'expression', expression: 'h > w' }
  ]
};

// Mock constraint resolver
function createConstraintResolver(schemas: Record<string, ConstraintSchema>) {
  return (key: string): ConstraintSchema | null => {
    return schemas[key] || null;
  };
}

describe('Constraint Integration (F1-002)', () => {
  const simpleBuilder = `
version: "1.0"
name: ConstrainedBox
description: A box with constraint validation

measurements:
  box_width:
    value: 0.5
  box_height:
    value: 0.8

constraints:
  - schema: dimension_range
    bindings:
      width: box_width
      height: box_height
    description: "Box dimensions must be reasonable"

geometry:
  - box:
      name: main_box
      center: { x: 0, y: 0.4, z: 0 }
      size: { x: box_width, y: box_height, z: 0.3 }
`;

  it('should pass constraints when values are valid', async () => {
    const yaml = await parseYamlWithLibrary(simpleBuilder);
    const output = await parseAndExecuteBuilder(yaml, {
      seed: 42,
      constraintResolver: createConstraintResolver({
        'dimension_range': rangeConstraint
      })
    });

    // Should have constraint results
    expect(output.constraintResults).toBeDefined();
    expect(output.constraintResults!.length).toBe(1);
    expect(output.constraintResults![0].passed).toBe(true);
    expect(output.constraintResults![0].schema).toBe('dimension_range');

    // No constraint errors in validation issues
    const constraintErrors = output.validation.issues.filter(i =>
      i.message.includes('Constraint')
    );
    expect(constraintErrors.length).toBe(0);
  });

  it('should fail constraints when values are out of range', async () => {
    const builderWithBadValues = `
version: "1.0"
name: BadBox
measurements:
  box_width:
    value: 5.0
  box_height:
    value: 0.5
constraints:
  - schema: dimension_range
    bindings:
      width: box_width
      height: box_height
geometry:
  - box:
      name: main_box
      center: { x: 0, y: 0, z: 0 }
      size: { x: box_width, y: box_height, z: 0.3 }
`;

    const yaml = await parseYamlWithLibrary(builderWithBadValues);
    const output = await parseAndExecuteBuilder(yaml, {
      seed: 42,
      constraintResolver: createConstraintResolver({
        'dimension_range': rangeConstraint
      })
    });

    // Should have failed constraint results
    expect(output.constraintResults).toBeDefined();
    expect(output.constraintResults!.length).toBe(1);
    expect(output.constraintResults![0].passed).toBe(false);

    // Should have error in validation issues
    const constraintErrors = output.validation.issues.filter(i =>
      i.message.includes('Constraint') && i.severity === 'error'
    );
    expect(constraintErrors.length).toBeGreaterThan(0);
  });

  it('should support warning severity for soft constraints', async () => {
    const builderWithWarning = `
version: "1.0"
name: WarnBox
measurements:
  box_width:
    value: 3.0
  box_height:
    value: 0.5
constraints:
  - schema: dimension_range
    bindings:
      width: box_width
      height: box_height
    severity: warning
geometry:
  - box:
      name: main_box
      center: { x: 0, y: 0, z: 0 }
      size: { x: box_width, y: box_height, z: 0.3 }
`;

    const yaml = await parseYamlWithLibrary(builderWithWarning);
    const output = await parseAndExecuteBuilder(yaml, {
      seed: 42,
      constraintResolver: createConstraintResolver({
        'dimension_range': rangeConstraint
      })
    });

    // Should have warning severity
    expect(output.constraintResults![0].severity).toBe('warning');

    // Should have warning (not error) in validation issues
    const constraintWarnings = output.validation.issues.filter(i =>
      i.message.includes('Constraint') && i.severity === 'warning'
    );
    expect(constraintWarnings.length).toBeGreaterThan(0);
  });

  it('should handle missing constraint schema gracefully', async () => {
    const builderWithMissingSchema = `
version: "1.0"
name: MissingSchema
measurements:
  x:
    value: 1.0
constraints:
  - schema: nonexistent_schema
    bindings:
      x: x
geometry:
  - box:
      name: main_box
      center: { x: 0, y: 0, z: 0 }
      size: { x: 1, y: 1, z: 1 }
`;

    const yaml = await parseYamlWithLibrary(builderWithMissingSchema);
    const output = await parseAndExecuteBuilder(yaml, {
      seed: 42,
      constraintResolver: createConstraintResolver({})
    });

    // Should have error about missing schema
    const missingSchemaErrors = output.validation.issues.filter(i =>
      i.message.includes('not found')
    );
    expect(missingSchemaErrors.length).toBe(1);
  });

  it('should evaluate expression constraints', async () => {
    const builderWithExpression = `
version: "1.0"
name: ProportionBox
measurements:
  width:
    value: 0.4
  height:
    value: 0.8
constraints:
  - schema: proportion_check
    bindings:
      w: width
      h: height
geometry:
  - box:
      name: main_box
      center: { x: 0, y: 0.4, z: 0 }
      size: { x: width, y: height, z: 0.3 }
`;

    const yaml = await parseYamlWithLibrary(builderWithExpression);
    const output = await parseAndExecuteBuilder(yaml, {
      seed: 42,
      constraintResolver: createConstraintResolver({
        'proportion_check': expressionConstraint
      })
    });

    // Height (0.8) > Width (0.4), so should pass
    expect(output.constraintResults![0].passed).toBe(true);
  });

  it('should skip constraint evaluation when no resolver provided', async () => {
    const yaml = await parseYamlWithLibrary(simpleBuilder);
    const output = await parseAndExecuteBuilder(yaml, { seed: 42 });

    // No constraint results when resolver not provided
    expect(output.constraintResults).toEqual([]);
  });

  it('should trace constraint evaluation', async () => {
    const yaml = await parseYamlWithLibrary(simpleBuilder);
    const output = await parseAndExecuteBuilder(yaml, {
      seed: 42,
      constraintResolver: createConstraintResolver({
        'dimension_range': rangeConstraint
      })
    });

    // Should have trace entry for constraint
    const constraintTrace = output.traces.get('constraint:dimension_range');
    expect(constraintTrace).toBeDefined();
    expect(constraintTrace!.details.passed).toBe(true);
  });
});
