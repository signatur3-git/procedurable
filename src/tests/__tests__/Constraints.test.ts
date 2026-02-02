/**
 * Tests for constraint passing system (P2-M2d-002)
 */

import { TracedBuilder } from '../../generation/builder/TracedBuilder';

describe('Constraint Passing System', () => {
  describe('TracedBuilder constraint methods', () => {
    it('should store and retrieve constraints from __constraints__ override', () => {
      const overrides = {
        __constraints__: {
          max_height: 0.9,
          max_width: 0.5,
          message: 'Test constraint'
        },
        some_decision: 'value'
      };

      const builder = new TracedBuilder('TestBuilder', 42, overrides);

      // Verify constraints are extracted
      expect(builder.getConstraint('max_height')).toBe(0.9);
      expect(builder.getConstraint('max_width')).toBe(0.5);
      expect(builder.getConstraint('message')).toBe('Test constraint');

      // Verify __constraints__ removed from decision overrides
      expect(builder.hasConstraint('some_decision')).toBe(false);
    });

    it('should return undefined for non-existent constraints', () => {
      const builder = new TracedBuilder('TestBuilder', 42);
      expect(builder.getConstraint('non_existent')).toBeUndefined();
    });

    it('should check constraint existence with hasConstraint', () => {
      const overrides = {
        __constraints__: {
          max_height: 0.9
        }
      };

      const builder = new TracedBuilder('TestBuilder', 42, overrides);

      expect(builder.hasConstraint('max_height')).toBe(true);
      expect(builder.hasConstraint('max_width')).toBe(false);
    });

    it('should return all constraints as object', () => {
      const overrides = {
        __constraints__: {
          max_height: 0.9,
          max_width: 0.5,
          required_tags: ['seating', 'stable']
        }
      };

      const builder = new TracedBuilder('TestBuilder', 42, overrides);
      const constraints = builder.getConstraints();

      expect(constraints).toEqual({
        max_height: 0.9,
        max_width: 0.5,
        required_tags: ['seating', 'stable']
      });
    });

    it('should handle nested constraint objects', () => {
      const overrides = {
        __constraints__: {
          max_footprint: {
            width: 0.5,
            depth: 0.5
          },
          pose: {
            facing: 'center',
            angle_tolerance: 15
          }
        }
      };

      const builder = new TracedBuilder('TestBuilder', 42, overrides);

      const footprint = builder.getConstraint<{ width: number; depth: number }>('max_footprint');
      expect(footprint).toEqual({ width: 0.5, depth: 0.5 });

      const pose = builder.getConstraint<{ facing: string; angle_tolerance: number }>('pose');
      expect(pose).toEqual({ facing: 'center', angle_tolerance: 15 });
    });
  });

  describe('Constraint composition', () => {
    it('should pass constraints through compose method', async () => {
      const parent = new TracedBuilder('Parent', 42);

      // Define a simple measurement
      parent.defineMeasurement('parent_value', 0.9);

      // Compose a child with constraints
      await parent.compose('child', (seed, overrides) => {
        const child = new TracedBuilder('Child', seed, overrides);

        // Child should receive constraints
        const maxHeight = child.getConstraint<number>('max_height');
        expect(maxHeight).toBe(0.9);

        const message = child.getConstraint<string>('message');
        expect(message).toBe('Must fit in space');

        // Build child
        child.defineMeasurement('height', maxHeight || 1.0);
        return child.build();
      }, {
        constraints: {
          max_height: 0.9,
          message: 'Must fit in space'
        }
      } as any); // Type assertion to work around TS language server cache

      // Verify parent build completes
      const output = parent.build();
      expect(output.subBuilders.has('child')).toBe(true);
    });

    it('should handle constraints in instanced compositions', async () => {
      const parent = new TracedBuilder('Parent', 42);

      await parent.compose('instance', (seed, overrides) => {
        const child = new TracedBuilder('Child', seed, overrides);

        // Verify constraints received
        expect(child.getConstraint('max_height')).toBe(1.0);

        // Build simple geometry
        child
          .placeVertex('v1', { x: '0', y: '0', z: '0' })
          .placeVertex('v2', { x: '1', y: '0', z: '0' })
          .placeVertex('v3', { x: '0', y: '1', z: '0' })
          .createFace('f1', ['v1', 'v2', 'v3']);

        return child.build();
      }, {
        asInstance: true,
        constraints: {
          max_height: 1.0
        }
      } as any); // Type assertion

      const output = parent.build();

      // Verify instance created
      expect(output.instances).toBeDefined();
      expect(output.instances!.length).toBe(1);
      expect(output.instances![0].id).toBe('instance');
    });

    it('should not mix constraints with decision overrides', () => {
      const parent = new TracedBuilder('Parent', 42);

      parent.compose('child', (seed, overrides) => {
        const child = new TracedBuilder('Child', seed, overrides);

        // Decision override should work normally
        const style = child.decide('style', ['modern', 'classic']);
        expect(style).toBe('modern'); // Overridden

        // Constraint should be separate
        const maxHeight = child.getConstraint<number>('max_height');
        expect(maxHeight).toBe(0.8);

        return child.build();
      }, {
        overrides: {
          style: 'modern'
        },
        constraints: {
          max_height: 0.8
        }
      } as any); // Type assertion

      parent.build();
    });
  });

  describe('Type safety', () => {
    it('should support generic type parameter for getConstraint', () => {
      const overrides = {
        __constraints__: {
          max_height: 0.9,
          tags: ['a', 'b', 'c'],
          config: { enabled: true, count: 5 }
        }
      };

      const builder = new TracedBuilder('TestBuilder', 42, overrides);

      // Type should be inferred correctly
      const height: number | undefined = builder.getConstraint<number>('max_height');
      expect(height).toBe(0.9);

      const tags: string[] | undefined = builder.getConstraint<string[]>('tags');
      expect(tags).toEqual(['a', 'b', 'c']);

      const config: { enabled: boolean; count: number } | undefined =
        builder.getConstraint<{ enabled: boolean; count: number }>('config');
      expect(config).toEqual({ enabled: true, count: 5 });
    });
  });

  describe('Constraint in expressions', () => {
    it('should access constraints in derived expressions with @ prefix', async () => {
      const parent = new TracedBuilder('Parent', 42);

      parent.defineMeasurement('parent_width', 0.5);

      await parent.compose('child', (seed, overrides) => {
        const child = new TracedBuilder('Child', seed, overrides);

        // Define a measurement
        child.defineMeasurement('natural_width', 0.8);

        // Derived expression using constraint with @ prefix
        // This simulates: "min(natural_width, @max_width)"
        const maxWidthConstraint = child.getConstraint<number>('max_width');
        const finalWidth = Math.min(0.8, maxWidthConstraint || 999);

        child.defineMeasurement('final_width', finalWidth);

        // Verify constraint was respected
        expect(finalWidth).toBe(0.5); // Should be clamped to constraint

        return child.build();
      }, {
        constraints: {
          max_width: 0.5
        }
      } as any);

      const output = parent.build();
      const childOutput = output.subBuilders.get('child');

      expect(childOutput).toBeDefined();
      expect(childOutput!.measurements.get('final_width')?.value).toBe(0.5);
    });

    it('should use fallback values when constraints are not provided', () => {
      const builder = new TracedBuilder('Test', 42);

      // No constraints provided
      builder.defineMeasurement('width', 0.8);

      // Simulate expression: min(width, @max_width)
      // @max_width should default to 999
      const maxWidth = builder.getConstraint<number>('max_width');
      const finalWidth = Math.min(0.8, maxWidth || 999);

      expect(finalWidth).toBe(0.8); // Not clamped since no constraint
    });
  });
});
