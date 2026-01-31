/**
 * Error Context Tests
 *
 * Verify that errors include YAML path for easier debugging
 */

import { describe, it, expect } from '@jest/globals';
import { parseAndExecuteBuilder } from '../../generation/builder/YamlBuilderParser';

describe('YamlBuilderParser - Error Context', () => {
  describe('Decision errors', () => {
    it('should include path when decision has invalid constraints', async () => {
      const yaml: any = {
        version: '1.0',
        name: 'TestBuilder',
        decisions: {
          bad_number: {
            type: 'number',
            min: 10,
            max: 5  // min > max
          }
        }
      };

      await expect(async () => {
        await parseAndExecuteBuilder(yaml, { seed: 1 });
      }).rejects.toThrow(/decisions\.bad_number/);
    });
  });

  describe('Measurement errors', () => {
    it('should include path when measurement has no value', async () => {
      const yaml: any = {
        version: '1.0',
        name: 'TestBuilder',
        measurements: {
          bad_measurement: {
            source: 'Missing value'
            // No value or base
          }
        }
      };

      await expect(async () => {
        await parseAndExecuteBuilder(yaml, { seed: 1 });
      }).rejects.toThrow(/measurements\.bad_measurement/);
    });

    it('should include path when expression fails', async () => {
      const yaml: any = {
        version: '1.0',
        name: 'TestBuilder',
        measurements: {
          good: { value: 1.0 },
          bad_expr: {
            value: 'undefined_var * 2'
          }
        }
      };

      await expect(async () => {
        await parseAndExecuteBuilder(yaml, { seed: 1 });
      }).rejects.toThrow(/measurements\.bad_expr/);
    });
  });

  describe('Derived value errors', () => {
    it('should include path when derived expression fails', async () => {
      const yaml: any = {
        version: '1.0',
        name: 'TestBuilder',
        measurements: {
          base: { value: 1.0 }
        },
        derived: {
          bad_derived: 'undefined_var + 1'
        }
      };

      await expect(async () => {
        await parseAndExecuteBuilder(yaml, { seed: 1 });
      }).rejects.toThrow(/derived\.bad_derived/);
    });
  });

  describe('Geometry errors', () => {
    it('should include path and command index for geometry errors', async () => {
      const yaml: any = {
        version: '1.0',
        name: 'TestBuilder',
        geometry: [
          {
            vertex: 'v1',
            position: { x: 'bad_expression +', y: 0, z: 0 }
          }
        ]
      };

      await expect(async () => {
        await parseAndExecuteBuilder(yaml, { seed: 1 });
      }).rejects.toThrow(/geometry/);
    });
  });

  describe('Composition errors', () => {
    it('should include path when composed builder not found', async () => {
      const yaml: any = {
        version: '1.0',
        name: 'TestBuilder',
        compose: {
          sub_instance: {
            builder: 'NonExistentBuilder',
            offset: { x: 0, y: 0, z: 0 }
          }
        }
      };

      await expect(async () => {
        await parseAndExecuteBuilder(yaml, {
          seed: 1,
          builderResolver: () => null
        });
      }).rejects.toThrow(/compose\.sub_instance/);
    });
  });

  describe('Nested errors', () => {
    it('should show full path for errors in nested structures', async () => {
      const yaml: any = {
        version: '1.0',
        name: 'TestBuilder',
        decisions: {
          style: {
            type: 'choice',
            options: ['a', 'b']
          }
        },
        measurements: {
          size: { value: 1.0 }
        },
        derived: {
          calculated: 'size * 2',
          nested_bad: 'nonexistent_var'
        }
      };

      await expect(async () => {
        await parseAndExecuteBuilder(yaml, { seed: 1 });
      }).rejects.toThrow(/derived\.nested_bad/);
    });
  });
});

