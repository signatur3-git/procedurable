/**
 * Tests for SharedContext (P2-M2d-003)
 */

import { SharedContext } from '../../generation/builder/SharedContext';

describe('SharedContext', () => {
  describe('Basic operations', () => {
    it('should create empty context', () => {
      const ctx = new SharedContext();
      expect(ctx.size()).toBe(0);
      expect(ctx.keys()).toEqual([]);
    });

    it('should create context with initial state', () => {
      const ctx = new SharedContext({
        theme: { style: 'modern', wood: 'oak' },
        count: 5
      });

      expect(ctx.size()).toBe(2);
      expect(ctx.get('theme')).toEqual({ style: 'modern', wood: 'oak' });
      expect(ctx.get('count')).toBe(5);
    });

    it('should set and get values', () => {
      const ctx = new SharedContext();

      ctx.set('width', 5.0);
      ctx.set('theme', { style: 'modern' });

      expect(ctx.get('width')).toBe(5.0);
      expect(ctx.get('theme')).toEqual({ style: 'modern' });
    });

    it('should check key existence', () => {
      const ctx = new SharedContext({ foo: 'bar' });

      expect(ctx.has('foo')).toBe(true);
      expect(ctx.has('baz')).toBe(false);
    });

    it('should return undefined for missing keys', () => {
      const ctx = new SharedContext();
      expect(ctx.get('missing')).toBeUndefined();
    });
  });

  describe('Multiple operations', () => {
    it('should get multiple keys at once', () => {
      const ctx = new SharedContext({
        a: 1,
        b: 2,
        c: 3
      });

      const result = ctx.getMultiple(['a', 'c']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should handle missing keys in getMultiple', () => {
      const ctx = new SharedContext({ a: 1 });

      const result = ctx.getMultiple(['a', 'b', 'c']);
      expect(result).toEqual({ a: 1 });
    });

    it('should set multiple values at once', () => {
      const ctx = new SharedContext();

      ctx.setMultiple({ x: 10, y: 20, z: 30 });

      expect(ctx.get('x')).toBe(10);
      expect(ctx.get('y')).toBe(20);
      expect(ctx.get('z')).toBe(30);
    });
  });

  describe('State management', () => {
    it('should convert to object', () => {
      const ctx = new SharedContext({
        width: 5,
        height: 3,
        theme: { style: 'modern' }
      });

      const obj = ctx.toObject();
      expect(obj).toEqual({
        width: 5,
        height: 3,
        theme: { style: 'modern' }
      });
    });

    it('should create snapshot', () => {
      const ctx = new SharedContext({ a: 1, b: 2 });
      ctx.set('c', 3);

      const snapshot = ctx.snapshot();
      expect(snapshot).toEqual({
        a: 1,
        b: 2,
        c: 3,
        __requirements__: [],
        __offers__: []
      });
    });

    it('should reset to initial state', () => {
      const ctx = new SharedContext({ initial: 'value' });

      ctx.set('added', 'later');
      ctx.set('initial', 'modified');

      expect(ctx.size()).toBe(2);

      ctx.reset();

      expect(ctx.size()).toBe(1);
      expect(ctx.get('initial')).toBe('value');
      expect(ctx.get('added')).toBeUndefined();
    });

    it('should delete keys', () => {
      const ctx = new SharedContext({ a: 1, b: 2 });

      expect(ctx.delete('a')).toBe(true);
      expect(ctx.has('a')).toBe(false);
      expect(ctx.delete('nonexistent')).toBe(false);
    });
  });

  describe('Cross-builder communication scenario', () => {
    it('should allow builders to share state', () => {
      // Scene creates shared context
      const ctx = new SharedContext({
        theme: { style: 'modern', wood: 'oak' },
        layout: { spacing: 0.5 }
      });

      // Builder 1 reads theme and writes size
      const theme = ctx.get('theme');
      expect(theme).toEqual({ style: 'modern', wood: 'oak' });

      ctx.set('table_width', 2.0);
      ctx.set('table_height', 0.75);

      // Builder 2 reads table dimensions
      const tableWidth = ctx.get<number>('table_width');
      const tableHeight = ctx.get<number>('table_height');

      expect(tableWidth).toBe(2.0);
      expect(tableHeight).toBe(0.75);

      // Builder 2 calculates chair position based on table
      const chairOffset = tableWidth! / 2 + 0.3;
      ctx.set('chair_offset', chairOffset);

      // Builder 3 reads chair offset
      expect(ctx.get('chair_offset')).toBe(1.3);
    });

    it('should handle nested object updates', () => {
      const ctx = new SharedContext({
        occupied_zones: []
      });

      // Builder 1 reports occupied zone
      const zones = ctx.get<any[]>('occupied_zones') || [];
      zones.push({ x: 0, y: 0, width: 2, depth: 1 });
      ctx.set('occupied_zones', zones);

      // Builder 2 reads zones
      const readZones = ctx.get<any[]>('occupied_zones');
      expect(readZones).toHaveLength(1);
      expect(readZones![0]).toEqual({ x: 0, y: 0, width: 2, depth: 1 });
    });
  });

  describe('Type safety', () => {
    it('should support generic type parameter', () => {
      const ctx = new SharedContext({
        count: 5,
        name: 'test',
        config: { enabled: true }
      });

      const count: number | undefined = ctx.get<number>('count');
      const name: string | undefined = ctx.get<string>('name');
      const config: { enabled: boolean } | undefined = ctx.get<{ enabled: boolean }>('config');

      expect(count).toBe(5);
      expect(name).toBe('test');
      expect(config).toEqual({ enabled: true });
    });
  });

  // B5-002: Requirements and Offers Tests
  describe('Requirements/Offers (B5-002)', () => {
    it('should publish and retrieve requirements', () => {
      const ctx = new SharedContext();

      ctx.publishRequirement({
        id: 'house_pad',
        publisher: 'HouseBuilder',
        type: 'terrain_clearance',
        shape: 'rectangle',
        position: { x: 10, z: 20 },
        width: 15,
        depth: 12,
        maxSlope: 0.05
      });

      const req = ctx.getRequirement('house_pad');
      expect(req).toBeDefined();
      expect(req?.type).toBe('terrain_clearance');
      expect(req?.publisher).toBe('HouseBuilder');
      expect(req?.position).toEqual({ x: 10, z: 20 });
    });

    it('should get requirements by type', () => {
      const ctx = new SharedContext();

      ctx.publishRequirement({
        id: 'house1',
        publisher: 'House1',
        type: 'terrain_clearance',
        shape: 'rectangle',
        position: { x: 0, z: 0 }
      });

      ctx.publishRequirement({
        id: 'road1',
        publisher: 'Road1',
        type: 'road_access',
        shape: 'rectangle',
        position: { x: 50, z: 0 }
      });

      ctx.publishRequirement({
        id: 'house2',
        publisher: 'House2',
        type: 'terrain_clearance',
        shape: 'rectangle',
        position: { x: 100, z: 0 }
      });

      const terrainReqs = ctx.getRequirementsByType('terrain_clearance');
      expect(terrainReqs.length).toBe(2);
    });

    it('should publish and retrieve offers', () => {
      const ctx = new SharedContext();

      ctx.publishOffer({
        requirementId: 'house_pad',
        publisher: 'TerrainBuilder',
        fulfilled: true,
        elevation: 42.5,
        slope: 0.02,
        boundaryLoop: 'house_pad_boundary'
      });

      const offer = ctx.getOffer('house_pad');
      expect(offer).toBeDefined();
      expect(offer?.fulfilled).toBe(true);
      expect(offer?.elevation).toBe(42.5);
      expect(offer?.boundaryLoop).toBe('house_pad_boundary');
    });

    it('should check if requirement is fulfilled', () => {
      const ctx = new SharedContext();

      ctx.publishOffer({
        requirementId: 'fulfilled_req',
        publisher: 'Terrain',
        fulfilled: true
      });

      ctx.publishOffer({
        requirementId: 'unfulfilled_req',
        publisher: 'Terrain',
        fulfilled: false
      });

      expect(ctx.isRequirementFulfilled('fulfilled_req')).toBe(true);
      expect(ctx.isRequirementFulfilled('unfulfilled_req')).toBe(false);
      expect(ctx.isRequirementFulfilled('nonexistent')).toBe(false);
    });

    it('should reset requirements and offers', () => {
      const ctx = new SharedContext();

      ctx.publishRequirement({
        id: 'req1',
        publisher: 'Builder1',
        type: 'test',
        shape: 'rectangle',
        position: { x: 0, z: 0 }
      });

      ctx.publishOffer({
        requirementId: 'req1',
        publisher: 'Terrain',
        fulfilled: true
      });

      expect(ctx.getAllRequirements().length).toBe(1);
      expect(ctx.getAllOffers().length).toBe(1);

      ctx.reset();

      expect(ctx.getAllRequirements().length).toBe(0);
      expect(ctx.getAllOffers().length).toBe(0);
    });

    it('should include requirements and offers in snapshot', () => {
      const ctx = new SharedContext();

      ctx.publishRequirement({
        id: 'req1',
        publisher: 'Builder',
        type: 'test',
        shape: 'circle',
        position: { x: 0, z: 0 }
      });

      ctx.publishOffer({
        requirementId: 'req1',
        publisher: 'Terrain',
        fulfilled: true,
        elevation: 10
      });

      const snapshot = ctx.snapshot();
      expect(snapshot.__requirements__.length).toBe(1);
      expect(snapshot.__offers__.length).toBe(1);
      expect(snapshot.__requirements__[0].id).toBe('req1');
      expect(snapshot.__offers__[0].elevation).toBe(10);
    });

    it('should provide negotiation stats', () => {
      const ctx = new SharedContext();

      ctx.publishRequirement({
        id: 'req1',
        publisher: 'B1',
        type: 'test',
        shape: 'rectangle',
        position: { x: 0, z: 0 }
      });

      ctx.publishRequirement({
        id: 'req2',
        publisher: 'B2',
        type: 'test',
        shape: 'rectangle',
        position: { x: 0, z: 0 }
      });

      ctx.publishOffer({
        requirementId: 'req1',
        publisher: 'Terrain',
        fulfilled: true
      });

      const stats = ctx.negotiationStats();
      expect(stats.requirements).toBe(2);
      expect(stats.offers).toBe(1);
      expect(stats.fulfilled).toBe(1);
    });
  });
});
