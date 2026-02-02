/**
 * GeometryCommandHandler Tests
 *
 * Tests for the command handler pattern and individual command handlers.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { GeometryCommandRegistry } from '../../generation/builder/GeometryCommandHandler';
import { createStandardRegistry, BoxCommandHandler, BevelCommandHandler, VertexCommandHandler } from '../../generation/builder/commands';
import { TracedBuilder } from '../../generation/builder/TracedBuilder';
import type { GeometryCommandContext } from '../../generation/builder/GeometryCommandHandler';

describe('GeometryCommandHandler', () => {
  describe('GeometryCommandRegistry', () => {
    it('should register and find handlers', () => {
      const registry = new GeometryCommandRegistry();
      const boxHandler = new BoxCommandHandler();

      registry.register(boxHandler);

      expect(registry.size).toBe(1);
      expect(registry.findHandler({ box: { name: 'test', center: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } } })).toBe(boxHandler);
    });

    it('should return undefined for unknown commands', () => {
      const registry = new GeometryCommandRegistry();

      expect(registry.findHandler({ unknown: 'test' } as any)).toBeUndefined();
    });

    it('should list all registered handlers', () => {
      const registry = createStandardRegistry();

      expect(registry.size).toBe(17);
      const keys = registry.getHandlers().map(h => h.commandKey);

      // Primitive geometry
      expect(keys).toContain('box');
      expect(keys).toContain('vertex');
      expect(keys).toContain('circle');
      expect(keys).toContain('loop');
      expect(keys).toContain('face');
      expect(keys).toContain('loft');
      expect(keys).toContain('cap');

      // Advanced geometry
      expect(keys).toContain('lathe');
      expect(keys).toContain('sweep');
      expect(keys).toContain('subdivide');
      expect(keys).toContain('bevel');
      expect(keys).toContain('radialArray');
      expect(keys).toContain('extrude2d');

      // Control flow
      expect(keys).toContain('when');
      expect(keys).toContain('if');
      expect(keys).toContain('repeat');

      // Deformers
      expect(keys).toContain('displace');
    });
  });

  describe('BoxCommandHandler', () => {
    let builder: TracedBuilder;
    let context: GeometryCommandContext;

    beforeEach(() => {
      builder = new TracedBuilder('test');
      context = {
        builder,
        decisionValues: new Map(),
        materials: new Map(),
        processGeometry: async () => {},
        evaluateExpression: (expr: string | number) => typeof expr === 'number' ? expr : parseFloat(expr) || 0,
        interpolateName: (name: string) => name
      };
    });

    it('should handle box commands', () => {
      const handler = new BoxCommandHandler();
      expect(handler.commandKey).toBe('box');
      expect(handler.handles({ box: { name: 'test', center: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } } })).toBe(true);
      expect(handler.handles({ vertex: 'test', position: { x: 0, y: 0, z: 0 } } as any)).toBe(false);
    });

    it('should create 8 vertices and 6 faces for a box', async () => {
      const handler = new BoxCommandHandler();

      await handler.execute(
        { box: { name: 'cube', center: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 } } },
        context
      );

      // Box creates 8 vertices
      expect(builder.getMesh().vertices.length).toBe(8);
      // Box creates 6 faces
      expect(builder.getMesh().faces.length).toBe(6);
    });
  });

  describe('VertexCommandHandler', () => {
    let builder: TracedBuilder;
    let context: GeometryCommandContext;

    beforeEach(() => {
      builder = new TracedBuilder('test');
      context = {
        builder,
        decisionValues: new Map(),
        materials: new Map(),
        processGeometry: async () => {},
        evaluateExpression: (expr: string | number) => typeof expr === 'number' ? expr : parseFloat(expr) || 0,
        interpolateName: (name: string) => name
      };
    });

    it('should handle vertex commands', () => {
      const handler = new VertexCommandHandler();
      expect(handler.commandKey).toBe('vertex');
      expect(handler.handles({ vertex: 'test', position: { x: 0, y: 0, z: 0 } } as any)).toBe(true);
    });

    it('should place a vertex at the specified position', async () => {
      const handler = new VertexCommandHandler();

      await handler.execute(
        { vertex: 'point1', position: { x: 1, y: 2, z: 3 } } as any,
        context
      );

      // Vertex should be placed
      const mesh = builder.getMesh();
      expect(mesh.vertices.length).toBe(1);
      expect(mesh.vertices[0].position.x).toBeCloseTo(1);
      expect(mesh.vertices[0].position.y).toBeCloseTo(2);
      expect(mesh.vertices[0].position.z).toBeCloseTo(3);
    });
  });

  describe('BevelCommandHandler', () => {
    it('should handle bevel commands', () => {
      const handler = new BevelCommandHandler();
      expect(handler.commandKey).toBe('bevel');
      expect(handler.handles({ bevel: 'test', mesh: 'cube', width: 0.1 } as any)).toBe(true);
    });
  });
});
