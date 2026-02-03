/**
 * Billboard Primitive Tests (G7-001)
 *
 * Tests for billboard geometry and instancing.
 */

import { describe, it, expect } from '@jest/globals';
import { createBillboardQuad, BillboardCommandHandler } from '../../generation/builder/commands/BillboardCommand';
import { executeBuilder } from '../../generation/builder/YamlBuilderExecutor';
import type { YamlBuilderDefinition } from '../../generation/builder/YamlBuilderTypes';

describe('Billboard Primitives (G7-001)', () => {
  describe('createBillboardQuad', () => {
    it('should create a quad with 4 vertices', () => {
      const mesh = createBillboardQuad(1, 1);

      expect(mesh.vertices.length).toBe(4);
    });

    it('should create 2 faces (front and back)', () => {
      const mesh = createBillboardQuad(1, 1);

      expect(mesh.faces.length).toBe(2);
    });

    it('should have correct dimensions for center pivot', () => {
      const width = 2;
      const height = 3;
      const mesh = createBillboardQuad(width, height, 'center');

      // Find bounding box
      const xs = mesh.vertices.map(v => v.position.x);
      const ys = mesh.vertices.map(v => v.position.y);

      expect(Math.min(...xs)).toBeCloseTo(-width / 2);
      expect(Math.max(...xs)).toBeCloseTo(width / 2);
      expect(Math.min(...ys)).toBeCloseTo(-height / 2);
      expect(Math.max(...ys)).toBeCloseTo(height / 2);
    });

    it('should have correct dimensions for bottom pivot', () => {
      const width = 2;
      const height = 3;
      const mesh = createBillboardQuad(width, height, 'bottom');

      // Find bounding box
      const ys = mesh.vertices.map(v => v.position.y);

      // Bottom should be at 0, top at height
      expect(Math.min(...ys)).toBeCloseTo(0);
      expect(Math.max(...ys)).toBeCloseTo(height);
    });

    it('should have UVs for texturing', () => {
      const mesh = createBillboardQuad(1, 1);

      // All vertices should have UVs
      for (const vertex of mesh.vertices) {
        expect(vertex.attributes.uv).toBeDefined();
        expect(vertex.attributes.uv).toHaveLength(2);
      }
    });

    it('should have UV corners at [0,0], [1,0], [1,1], [0,1]', () => {
      const mesh = createBillboardQuad(1, 1);

      const uvSet = new Set<string>();
      for (const vertex of mesh.vertices) {
        const [u, v] = vertex.attributes.uv!;
        uvSet.add(`${u},${v}`);
      }

      expect(uvSet.has('0,0')).toBe(true);
      expect(uvSet.has('1,0')).toBe(true);
      expect(uvSet.has('1,1')).toBe(true);
      expect(uvSet.has('0,1')).toBe(true);
    });

    it('should be in XY plane (Z = 0)', () => {
      const mesh = createBillboardQuad(1, 1);

      for (const vertex of mesh.vertices) {
        expect(vertex.position.z).toBe(0);
      }
    });
  });

  describe('BillboardCommandHandler', () => {
    it('should have commandKey "billboard"', () => {
      const handler = new BillboardCommandHandler();
      expect(handler.commandKey).toBe('billboard');
    });
  });

  describe('Billboard in YAML builder', () => {
    it('should create billboard via geometry command', async () => {
      const builder: YamlBuilderDefinition = {
        version: '1.0',
        name: 'TestBillboard',
        geometry: [
          {
            billboard: {
              name: 'test',
              center: { x: 0, y: 1, z: 0 },
              width: 1,
              height: 2
            }
          }
        ]
      };

      const result = await executeBuilder(builder, { seed: 42 });

      expect(result.validation.vertexCount).toBe(4);
      expect(result.validation.faceCount).toBe(2);
    });

    it('should position billboard at specified center', async () => {
      const builder: YamlBuilderDefinition = {
        version: '1.0',
        name: 'TestBillboard',
        geometry: [
          {
            billboard: {
              name: 'positioned',
              center: { x: 5, y: 10, z: -3 },
              width: 1,
              height: 1
            }
          }
        ]
      };

      const result = await executeBuilder(builder, { seed: 42 });

      // Check trace for position
      const trace = result.traces.get('billboard:positioned');
      expect(trace).toBeDefined();
      expect(trace?.details.center).toEqual({ x: 5, y: 10, z: -3 });
    });

    it('should trace billboard metadata including facing mode', async () => {
      const builder: YamlBuilderDefinition = {
        version: '1.0',
        name: 'TestBillboard',
        geometry: [
          {
            billboard: {
              name: 'axis_y_bill',
              center: { x: 0, y: 0, z: 0 },
              width: 2,
              height: 3,
              facing: 'axis_y',
              pivot: 'bottom'
            }
          }
        ]
      };

      const result = await executeBuilder(builder, { seed: 42 });

      const trace = result.traces.get('billboard:axis_y_bill');
      expect(trace).toBeDefined();
      expect(trace?.details.width).toBe(2);
      expect(trace?.details.height).toBe(3);
      expect(trace?.details.facing).toBe('axis_y');
      expect(trace?.details.pivot).toBe('bottom');
      expect(trace?.details.type).toBe('billboard');
    });

    it('should support expression values for dimensions', async () => {
      const builder: YamlBuilderDefinition = {
        version: '1.0',
        name: 'TestBillboard',
        geometry: [
          {
            billboard: {
              name: 'expr_test',
              center: { x: 0, y: 0, z: 0 },
              width: '1 + 1',
              height: '4 / 2'
            }
          }
        ]
      };

      const result = await executeBuilder(builder, { seed: 42 });

      const trace = result.traces.get('billboard:expr_test');
      expect(trace?.details.width).toBe(2);
      expect(trace?.details.height).toBe(2);  // 4 / 2
    });

    it('should default facing to "camera"', async () => {
      const builder: YamlBuilderDefinition = {
        version: '1.0',
        name: 'TestBillboard',
        geometry: [
          {
            billboard: {
              name: 'default_facing',
              center: { x: 0, y: 0, z: 0 },
              width: 1,
              height: 1
            }
          }
        ]
      };

      const result = await executeBuilder(builder, { seed: 42 });

      const trace = result.traces.get('billboard:default_facing');
      expect(trace?.details.facing).toBe('camera');
    });

    it('should support color assignment', async () => {
      const builder: YamlBuilderDefinition = {
        version: '1.0',
        name: 'TestBillboard',
        geometry: [
          {
            billboard: {
              name: 'colored',
              center: { x: 0, y: 0, z: 0 },
              width: 1,
              height: 1,
              color: '#ff0000'
            }
          }
        ]
      };

      const result = await executeBuilder(builder, { seed: 42 });

      // Check that faces have color
      const mesh = result.mesh;
      expect(mesh.faces.length).toBe(2);
      for (const face of mesh.faces) {
        expect(face.color).toBeDefined();
        expect(face.color!.r).toBe(1);  // Red
      }
    });
  });

  describe('Billboard instancing (scatter)', () => {
    it('should efficiently create multiple billboards via repeat', async () => {
      const builder: YamlBuilderDefinition = {
        version: '1.0',
        name: 'BillboardScatter',
        geometry: [
          {
            billboard: {
              name: 'grass_0',
              center: { x: 0, y: 0, z: 0 },
              width: 0.5,
              height: 1,
              facing: 'axis_y',
              pivot: 'bottom'
            }
          },
          {
            billboard: {
              name: 'grass_1',
              center: { x: 2, y: 0, z: 0 },
              width: 0.5,
              height: 1,
              facing: 'axis_y',
              pivot: 'bottom'
            }
          },
          {
            billboard: {
              name: 'grass_2',
              center: { x: 4, y: 0, z: 0 },
              width: 0.5,
              height: 1,
              facing: 'axis_y',
              pivot: 'bottom'
            }
          }
        ]
      };

      const result = await executeBuilder(builder, { seed: 42 });

      // 3 billboards * 4 vertices each
      expect(result.validation.vertexCount).toBe(12);
      // 3 billboards * 2 faces each
      expect(result.validation.faceCount).toBe(6);

      // Check traces exist for all billboards
      expect(result.traces.has('billboard:grass_0')).toBe(true);
      expect(result.traces.has('billboard:grass_1')).toBe(true);
      expect(result.traces.has('billboard:grass_2')).toBe(true);
    });
  });
});
