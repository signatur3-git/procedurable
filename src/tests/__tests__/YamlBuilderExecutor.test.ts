/**
 * YamlBuilderExecutor Tests
 *
 * Tests for the new executor that uses command registry.
 * These tests must pass BEFORE we swap out the old parser.
 */

import { describe, it, expect } from '@jest/globals';
import { executeBuilder } from '../../generation/builder/YamlBuilderExecutor';

// Use loose typing for tests - the actual YAML format is more flexible than the strict types
type TestYamlDefinition = {
  name: string;
  version: string;
  decisions?: Record<string, any>;
  measurements?: Record<string, any>;
  derived?: Record<string, string>;
  geometry?: any[];
};

describe('YamlBuilderExecutor', () => {
  describe('Phase 1: Decisions', () => {
    it('should process choice decisions', async () => {
      const yaml: TestYamlDefinition = {
        name: 'TestDecisions',
        version: '1.0',
        decisions: {
          material: {
            type: 'choice',
            options: ['wood', 'metal', 'plastic']
          }
        }
      };

      const output = await executeBuilder(yaml, { seed: 42 });

      expect(output.builderName).toBe('TestDecisions');
      expect(output.decisions.has('material')).toBe(true);
      const decision = output.decisions.get('material');
      expect(['wood', 'metal', 'plastic']).toContain(decision?.value);
    });

    it('should process number decisions', async () => {
      const yaml: TestYamlDefinition = {
        name: 'TestNumber',
        version: '1.0',
        decisions: {
          height: {
            type: 'number',
            min: 0.5,
            max: 1.5
          }
        }
      };

      const output = await executeBuilder(yaml, { seed: 42 });

      const decision = output.decisions.get('height');
      expect(decision?.value).toBeGreaterThanOrEqual(0.5);
      expect(decision?.value).toBeLessThanOrEqual(1.5);
    });

    it('should process boolean decisions', async () => {
      const yaml: TestYamlDefinition = {
        name: 'TestBoolean',
        version: '1.0',
        decisions: {
          hasArms: {
            type: 'boolean',
            probability: 0.5
          }
        }
      };

      const output = await executeBuilder(yaml, { seed: 42 });

      const decision = output.decisions.get('hasArms');
      expect(typeof decision?.value).toBe('boolean');
    });

    it('should process count decisions', async () => {
      const yaml: TestYamlDefinition = {
        name: 'TestCount',
        version: '1.0',
        decisions: {
          legCount: {
            type: 'count',
            min: 3,
            max: 5
          }
        }
      };

      const output = await executeBuilder(yaml, { seed: 42 });

      const decision = output.decisions.get('legCount');
      expect(decision?.value).toBeGreaterThanOrEqual(3);
      expect(decision?.value).toBeLessThanOrEqual(5);
      expect(Number.isInteger(decision?.value)).toBe(true);
    });
  });

  describe('Phase 2: Measurements', () => {
    it('should process simple measurements', async () => {
      const yaml: TestYamlDefinition = {
        name: 'TestMeasurements',
        version: '1.0',
        measurements: {
          width: { value: 0.5 },
          height: { value: 1.0 }
        }
      };

      const output = await executeBuilder(yaml);

      expect(output.measurements.get('width')?.value).toBe(0.5);
      expect(output.measurements.get('height')?.value).toBe(1.0);
    });

    it('should process expression measurements', async () => {
      const yaml: TestYamlDefinition = {
        name: 'TestExpressions',
        version: '1.0',
        measurements: {
          width: { value: 0.5 },
          height: { value: 'width * 2' }
        }
      };

      const output = await executeBuilder(yaml);

      expect(output.measurements.get('width')?.value).toBe(0.5);
      expect(output.measurements.get('height')?.value).toBe(1.0);
    });
  });

  describe('Phase 3: Derived', () => {
    it('should process derived values', async () => {
      const yaml: TestYamlDefinition = {
        name: 'TestDerived',
        version: '1.0',
        measurements: {
          width: { value: 0.5 },
          depth: { value: 0.4 }
        },
        derived: {
          half_width: 'width / 2',
          area: 'width * depth'
        }
      };

      const output = await executeBuilder(yaml);

      expect(output.measurements.get('half_width')?.value).toBe(0.25);
      expect(output.measurements.get('area')?.value).toBeCloseTo(0.2);
    });
  });

  describe('Phase 4: Geometry', () => {
    it('should process box command', async () => {
      const yaml: TestYamlDefinition = {
        name: 'TestBox',
        version: '1.0',
        measurements: {
          size: { value: 1.0 }
        },
        geometry: [
          {
            box: {
              name: 'cube',
              center: { x: 0, y: 0.5, z: 0 },
              size: { x: 'size', y: 'size', z: 'size' }
            }
          }
        ]
      };

      const output = await executeBuilder(yaml);

      // Box should create 8 vertices and 6 faces (or 12 triangles)
      expect(output.mesh.vertices.length).toBeGreaterThan(0);
      expect(output.mesh.faces.length).toBeGreaterThan(0);
    });

    it('should process vertex command', async () => {
      const yaml: TestYamlDefinition = {
        name: 'TestVertex',
        version: '1.0',
        geometry: [
          { vertex: 'v1', position: { x: 0, y: 0, z: 0 } },
          { vertex: 'v2', position: { x: 1, y: 0, z: 0 } },
          { vertex: 'v3', position: { x: 0, y: 1, z: 0 } }
        ]
      };

      const output = await executeBuilder(yaml);

      expect(output.mesh.vertices.length).toBe(3);
    });

    it('should process bevel command', async () => {
      const yaml: TestYamlDefinition = {
        name: 'TestBevel',
        version: '1.0',
        geometry: [
          {
            box: {
              name: 'cube',
              center: { x: 0, y: 0.5, z: 0 },
              size: { x: 1, y: 1, z: 1 }
            }
          },
          {
            bevel: 'edges',
            width: 0.05,
            segments: 2
          }
        ]
      };

      const output = await executeBuilder(yaml);

      // Beveling increases vertex/face count
      expect(output.mesh.vertices.length).toBeGreaterThan(8);
    });

    it('should process conditional geometry with if', async () => {
      const yaml: TestYamlDefinition = {
        name: 'TestConditional',
        version: '1.0',
        decisions: {
          style: {
            type: 'choice',
            options: ['simple', 'fancy']
          }
        },
        geometry: [
          {
            if: 'style == "simple"',
            then: [
              { box: { name: 'simple_box', center: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 } } }
            ],
            else: [
              { box: { name: 'fancy_box', center: { x: 0, y: 0.5, z: 0 }, size: { x: 2, y: 2, z: 2 } } }
            ]
          }
        ]
      };

      const output = await executeBuilder(yaml, { seed: 42 });

      // Should have geometry from either branch
      expect(output.mesh.vertices.length).toBeGreaterThan(0);
    });

    it('should process repeat command', async () => {
      const yaml: TestYamlDefinition = {
        name: 'TestRepeat',
        version: '1.0',
        geometry: [
          {
            repeat: 4,
            as: 'i',
            geometry: [
              { vertex: 'v_${i}', position: { x: 'i * 0.5', y: 0, z: 0 } }
            ]
          }
        ]
      };

      const output = await executeBuilder(yaml);

      // Should create 4 vertices
      expect(output.mesh.vertices.length).toBe(4);
    });
  });

  describe('Determinism', () => {
    it('should produce identical output with same seed', async () => {
      const yaml: TestYamlDefinition = {
        name: 'TestDeterminism',
        version: '1.0',
        decisions: {
          value: { type: 'number', min: 0, max: 100 }
        },
        geometry: [
          { box: { name: 'cube', center: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 } } }
        ]
      };

      const output1 = await executeBuilder(yaml, { seed: 12345 });
      const output2 = await executeBuilder(yaml, { seed: 12345 });

      expect(output1.decisions.get('value')?.value).toBe(output2.decisions.get('value')?.value);
      expect(output1.mesh.vertices.length).toBe(output2.mesh.vertices.length);
    });
  });
});
