/**
 * Boolean Shape Integration Tests
 *
 * Tests for 2D boolean operations in YAML builders (C1-002)
 */

import { describe, it, expect } from '@jest/globals';
import { parseAndExecuteBuilder, YamlBuilderDefinition } from '../../generation/builder/YamlBuilderParser';

describe('Boolean Shapes in YAML', () => {
  describe('subtract operation', () => {
    it('should create a shape with a hole (circle minus rect)', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'BooleanSubtractTest',
        shapes: {
          outer_circle: {
            type: 'circle',
            radius: 2,
            segments: 32
          },
          inner_rect: {
            type: 'rect',
            width: 1,
            height: 1
          },
          ring: {
            type: 'boolean',
            operation: 'subtract',
            subject: 'outer_circle',
            clip: 'inner_rect'
          }
        },
        geometry: [
          {
            extrude2d: 'ring_mesh',
            shape: 'ring',
            depth: 0.5
          }
        ]
      };

      const result = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(result.mesh.vertices.length).toBeGreaterThan(0);
      expect(result.mesh.faces.length).toBeGreaterThan(0);
      // The subtraction should create a shape with fewer points than the circle
      // (the inner rect area is removed)
    });

    it('should subtract rect from rect', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'RectSubtractTest',
        shapes: {
          outer: {
            type: 'rect',
            width: 4,
            height: 4
          },
          inner: {
            type: 'rect',
            width: 2,
            height: 2
          },
          frame: {
            type: 'boolean',
            operation: 'subtract',
            subject: 'outer',
            clip: 'inner'
          }
        },
        geometry: [
          {
            extrude2d: 'frame_mesh',
            shape: 'frame',
            depth: 1
          }
        ]
      };

      const result = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(result.mesh.vertices.length).toBeGreaterThan(0);
      expect(result.mesh.faces.length).toBeGreaterThan(0);
    });
  });

  describe('union operation', () => {
    it('should union two overlapping circles', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'BooleanUnionTest',
        shapes: {
          circle_left: {
            type: 'circle',
            radius: 1,
            segments: 16,
            center: { x: -0.5, z: 0 }
          },
          circle_right: {
            type: 'circle',
            radius: 1,
            segments: 16,
            center: { x: 0.5, z: 0 }
          },
          merged: {
            type: 'boolean',
            operation: 'union',
            subject: 'circle_left',
            clip: 'circle_right'
          }
        },
        geometry: [
          {
            extrude2d: 'merged_mesh',
            shape: 'merged',
            depth: 0.3
          }
        ]
      };

      const result = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(result.mesh.vertices.length).toBeGreaterThan(0);
      expect(result.mesh.faces.length).toBeGreaterThan(0);
    });
  });

  describe('intersect operation', () => {
    it('should intersect two overlapping shapes', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'BooleanIntersectTest',
        shapes: {
          rect1: {
            type: 'rect',
            width: 2,
            height: 2
          },
          rect2: {
            type: 'rect',
            width: 2,
            height: 2,
            center: { x: 1, z: 1 }
          },
          overlap: {
            type: 'boolean',
            operation: 'intersect',
            subject: 'rect1',
            clip: 'rect2'
          }
        },
        geometry: [
          {
            extrude2d: 'overlap_mesh',
            shape: 'overlap',
            depth: 0.5
          }
        ]
      };

      const result = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(result.mesh.vertices.length).toBeGreaterThan(0);
      expect(result.mesh.faces.length).toBeGreaterThan(0);
    });
  });

  describe('nested boolean operations', () => {
    it('should support chained boolean operations', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'NestedBooleanTest',
        shapes: {
          base: {
            type: 'rect',
            width: 4,
            height: 4
          },
          hole1: {
            type: 'circle',
            radius: 0.5,
            segments: 16,
            center: { x: -1, z: 0 }
          },
          hole2: {
            type: 'circle',
            radius: 0.5,
            segments: 16,
            center: { x: 1, z: 0 }
          },
          // First subtract one hole
          step1: {
            type: 'boolean',
            operation: 'subtract',
            subject: 'base',
            clip: 'hole1'
          },
          // Then subtract another hole from the result
          step2: {
            type: 'boolean',
            operation: 'subtract',
            subject: 'step1',
            clip: 'hole2'
          }
        },
        geometry: [
          {
            extrude2d: 'plate_with_holes',
            shape: 'step2',
            depth: 0.25
          }
        ]
      };

      const result = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(result.mesh.vertices.length).toBeGreaterThan(0);
      expect(result.mesh.faces.length).toBeGreaterThan(0);
    });
  });

  describe('with expressions', () => {
    it('should work with literal numeric values', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'BooleanWithLiterals',
        shapes: {
          outer: {
            type: 'rect',
            width: 3,
            height: 3
          },
          inner: {
            type: 'circle',
            radius: 0.5,
            segments: 24
          },
          result: {
            type: 'boolean',
            operation: 'subtract',
            subject: 'outer',
            clip: 'inner'
          }
        },
        geometry: [
          {
            extrude2d: 'result_mesh',
            shape: 'result',
            depth: 0.3
          }
        ]
      };

      const result = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(result.mesh.vertices.length).toBeGreaterThan(0);
      expect(result.mesh.faces.length).toBeGreaterThan(0);
    });
  });

  describe('multiple holes support', () => {
    it('should preserve holes through chained boolean subtractions', async () => {
      // Subtract two small circles from a large rect via chaining:
      // step1 = base - hole1 (creates one hole)
      // step2 = step1 - hole2 (should preserve hole1 AND add hole2)
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'ChainedHolesTest',
        shapes: {
          base: {
            type: 'rect',
            width: 6,
            height: 6
          },
          hole1: {
            type: 'circle',
            radius: 0.5,
            segments: 16,
            center: { x: -1.5, z: 0 }
          },
          hole2: {
            type: 'circle',
            radius: 0.5,
            segments: 16,
            center: { x: 1.5, z: 0 }
          },
          step1: {
            type: 'boolean',
            operation: 'subtract',
            subject: 'base',
            clip: 'hole1'
          },
          step2: {
            type: 'boolean',
            operation: 'subtract',
            subject: 'step1',
            clip: 'hole2'
          }
        },
        geometry: [
          {
            extrude2d: 'plate_with_two_holes',
            shape: 'step2',
            depth: 0.25
          }
        ]
      };

      const result = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(result.mesh.vertices.length).toBeGreaterThan(0);
      expect(result.mesh.faces.length).toBeGreaterThan(0);

      // A plate with 2 holes should have more faces than one with 1 hole
      // (side faces for both holes + re-triangulated caps)
      // Compare against single-hole version
      const yamlSingleHole: YamlBuilderDefinition = {
        version: '1.0',
        name: 'SingleHoleTest',
        shapes: {
          base: { type: 'rect', width: 6, height: 6 },
          hole1: { type: 'circle', radius: 0.5, segments: 16, center: { x: -1.5, z: 0 } },
          result: { type: 'boolean', operation: 'subtract', subject: 'base', clip: 'hole1' }
        },
        geometry: [
          { extrude2d: 'plate_one_hole', shape: 'result', depth: 0.25 }
        ]
      };

      const singleResult = await parseAndExecuteBuilder(yamlSingleHole, { seed: 42 });

      // Two holes should produce more geometry than one hole
      expect(result.mesh.faces.length).toBeGreaterThan(singleResult.mesh.faces.length);
    });

    it('should support clips array for multiple subtractions at once', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'ClipsArrayTest',
        shapes: {
          base: {
            type: 'rect',
            width: 6,
            height: 6
          },
          hole_a: {
            type: 'circle',
            radius: 0.5,
            segments: 16,
            center: { x: -1.5, z: 0 }
          },
          hole_b: {
            type: 'circle',
            radius: 0.5,
            segments: 16,
            center: { x: 0, z: 0 }
          },
          hole_c: {
            type: 'circle',
            radius: 0.5,
            segments: 16,
            center: { x: 1.5, z: 0 }
          },
          plate: {
            type: 'boolean',
            operation: 'subtract',
            subject: 'base',
            clips: ['hole_a', 'hole_b', 'hole_c']
          } as any
        },
        geometry: [
          {
            extrude2d: 'plate_three_holes',
            shape: 'plate',
            depth: 0.25
          }
        ]
      };

      const result = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(result.mesh.vertices.length).toBeGreaterThan(0);
      expect(result.mesh.faces.length).toBeGreaterThan(0);
    });

    it('should produce equivalent results with clips array vs chained subtractions', async () => {
      // Method A: clips array
      const yamlClips: YamlBuilderDefinition = {
        version: '1.0',
        name: 'ClipsMethod',
        shapes: {
          base: { type: 'rect', width: 6, height: 6 },
          h1: { type: 'circle', radius: 0.5, segments: 16, center: { x: -1, z: 0 } },
          h2: { type: 'circle', radius: 0.5, segments: 16, center: { x: 1, z: 0 } },
          result: { type: 'boolean', operation: 'subtract', subject: 'base', clips: ['h1', 'h2'] } as any
        },
        geometry: [{ extrude2d: 'mesh', shape: 'result', depth: 0.25 }]
      };

      // Method B: chained
      const yamlChained: YamlBuilderDefinition = {
        version: '1.0',
        name: 'ChainedMethod',
        shapes: {
          base: { type: 'rect', width: 6, height: 6 },
          h1: { type: 'circle', radius: 0.5, segments: 16, center: { x: -1, z: 0 } },
          h2: { type: 'circle', radius: 0.5, segments: 16, center: { x: 1, z: 0 } },
          step1: { type: 'boolean', operation: 'subtract', subject: 'base', clip: 'h1' },
          result: { type: 'boolean', operation: 'subtract', subject: 'step1', clip: 'h2' }
        },
        geometry: [{ extrude2d: 'mesh', shape: 'result', depth: 0.25 }]
      };

      const resultClips = await parseAndExecuteBuilder(yamlClips, { seed: 42 });
      const resultChained = await parseAndExecuteBuilder(yamlChained, { seed: 42 });

      // Both methods should produce the same number of faces (same geometry)
      expect(resultClips.mesh.faces.length).toBe(resultChained.mesh.faces.length);
    });
  });

  describe('error handling', () => {
    it('should error when operation is missing', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'MissingOperationTest',
        shapes: {
          a: { type: 'rect', width: 1, height: 1 },
          b: { type: 'rect', width: 1, height: 1 },
          bad: {
            type: 'boolean',
            // operation missing
            subject: 'a',
            clip: 'b'
          } as any
        },
        geometry: [
          { extrude2d: 'test', shape: 'bad', depth: 1 }
        ]
      };

      await expect(parseAndExecuteBuilder(yaml, { seed: 42 }))
        .rejects.toThrow(/operation/i);
    });

    it('should error when subject shape not found', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'MissingSubjectTest',
        shapes: {
          clip_shape: { type: 'rect', width: 1, height: 1 },
          bad: {
            type: 'boolean',
            operation: 'subtract',
            subject: 'nonexistent',
            clip: 'clip_shape'
          }
        },
        geometry: [
          { extrude2d: 'test', shape: 'bad', depth: 1 }
        ]
      };

      await expect(parseAndExecuteBuilder(yaml, { seed: 42 }))
        .rejects.toThrow(/not found/i);
    });
  });
});
