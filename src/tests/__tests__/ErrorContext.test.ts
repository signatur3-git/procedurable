/**
 * Error Context Tests
 *
 * Verify that errors include YAML path for easier debugging
 */

import { describe, it, expect } from '@jest/globals';
import { parseAndExecuteBuilder } from '../../builder/YamlBuilderParser';

describe('YamlBuilderParser - Error Context', () => {
  describe('Decision errors', () => {
    it('should include path when decision has invalid constraints', () => {
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

      expect(() => {
        parseAndExecuteBuilder(yaml, { seed: 1 });
      }).toThrow(/decisions\.bad_number/);
    });
  });

  describe('Measurement errors', () => {
    it('should include path when measurement has no value', () => {
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

      expect(() => {
        parseAndExecuteBuilder(yaml, { seed: 1 });
      }).toThrow(/measurements\.bad_measurement/);
    });

    it('should include path when expression fails', () => {
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

      expect(() => {
        parseAndExecuteBuilder(yaml, { seed: 1 });
      }).toThrow(/measurements\.bad_expr/);
    });
  });

  describe('Derived value errors', () => {
    it('should include path when derived expression fails', () => {
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

      expect(() => {
        parseAndExecuteBuilder(yaml, { seed: 1 });
      }).toThrow(/derived\.bad_derived/);
    });
  });

  describe('Geometry errors', () => {
    it('should include path and command index for geometry errors', () => {
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

      expect(() => {
        parseAndExecuteBuilder(yaml, { seed: 1 });
      }).toThrow(/geometry/);
    });
  });

  describe('Composition errors', () => {
    it('should include path when composed builder not found', () => {
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

      expect(() => {
        parseAndExecuteBuilder(yaml, {
          seed: 1,
          builderResolver: () => null
        });
      }).toThrow(/compose\.sub_instance/);
    });
  });

  describe('Nested errors', () => {
    it('should show full path for errors in nested structures', () => {
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

      expect(() => {
        parseAndExecuteBuilder(yaml, { seed: 1 });
      }).toThrow(/derived\.nested_bad/);
    });
  });
});

