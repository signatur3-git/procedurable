/**
 * Tests for SceneGraph (P2-M2d-005)
 */

import { SceneGraph, SceneNode } from '../../builder/SceneGraph';
import { Vec3 } from '../../core/Vec3';
import { AABB } from '../../core/AABB';

describe('SceneGraph', () => {
  describe('Basic operations', () => {
    it('should create empty scene graph', () => {
      const graph = new SceneGraph();
      expect(graph.size()).toBe(0);
      expect(graph.getAllTags()).toEqual([]);
    });

    it('should add nodes', () => {
      const graph = new SceneGraph();

      const node: SceneNode = {
        id: 'node1',
        name: 'Test Node',
        tags: ['furniture', 'table'],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1)),
        transform: {
          position: new Vec3(0, 0, 0),
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1
        },
        parent: null,
        children: [],
        builderName: 'TestBuilder'
      };

      graph.addNode(node);

      expect(graph.size()).toBe(1);
      expect(graph.getNode('node1')).toEqual(node);
    });

    it('should track parent-child relationships', () => {
      const graph = new SceneGraph();

      const parent: SceneNode = {
        id: 'parent',
        name: 'Parent',
        tags: [],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(2, 2, 2)),
        transform: {
          position: new Vec3(0, 0, 0),
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1
        },
        parent: null,
        children: []
      };

      const child: SceneNode = {
        id: 'child',
        name: 'Child',
        tags: [],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1)),
        transform: {
          position: new Vec3(1, 0, 0),
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1
        },
        parent: 'parent',
        children: []
      };

      graph.addNode(parent);
      graph.addNode(child);

      expect(graph.getParent('child')).toEqual(parent);
      expect(graph.getChildren('parent')).toHaveLength(1);
      expect(graph.getChildren('parent')[0]).toEqual(child);
    });
  });

  describe('Tag queries', () => {
    it('should find nodes by tag', () => {
      const graph = new SceneGraph();

      graph.addNode({
        id: 'table',
        name: 'Table',
        tags: ['furniture', 'table', 'surface'],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(2, 1, 1)),
        transform: { position: new Vec3(0, 0, 0), rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
        parent: null,
        children: []
      });

      graph.addNode({
        id: 'chair',
        name: 'Chair',
        tags: ['furniture', 'seating', 'chair'],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(0.5, 0.9, 0.5)),
        transform: { position: new Vec3(1, 0, 0), rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
        parent: null,
        children: []
      });

      const furniture = graph.getNodesByTag('furniture');
      expect(furniture).toHaveLength(2);

      const tables = graph.getNodesByTag('table');
      expect(tables).toHaveLength(1);
      expect(tables[0].id).toBe('table');

      const seating = graph.getNodesByTag('seating');
      expect(seating).toHaveLength(1);
      expect(seating[0].id).toBe('chair');
    });

    it('should find nodes by multiple tags (AND)', () => {
      const graph = new SceneGraph();

      graph.addNode({
        id: 'table',
        name: 'Table',
        tags: ['furniture', 'surface', 'wood'],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(2, 1, 1)),
        transform: { position: new Vec3(0, 0, 0), rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
        parent: null,
        children: []
      });

      graph.addNode({
        id: 'chair',
        name: 'Chair',
        tags: ['furniture', 'seating', 'wood'],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(0.5, 0.9, 0.5)),
        transform: { position: new Vec3(1, 0, 0), rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
        parent: null,
        children: []
      });

      // Both have 'furniture' and 'wood'
      const woodenFurniture = graph.getNodesByTags(['furniture', 'wood']);
      expect(woodenFurniture).toHaveLength(2);

      // Only table has 'surface'
      const woodenSurfaces = graph.getNodesByTags(['wood', 'surface']);
      expect(woodenSurfaces).toHaveLength(1);
      expect(woodenSurfaces[0].id).toBe('table');

      // No node has all three
      const woodenSeatingWithSurface = graph.getNodesByTags(['wood', 'seating', 'surface']);
      expect(woodenSeatingWithSurface).toHaveLength(0);
    });

    it('should find nodes by name pattern', () => {
      const graph = new SceneGraph();

      graph.addNode({
        id: 'chair1',
        name: 'Dining Chair 1',
        tags: ['furniture'],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(0.5, 0.9, 0.5)),
        transform: { position: new Vec3(0, 0, 0), rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
        parent: null,
        children: []
      });

      graph.addNode({
        id: 'chair2',
        name: 'Dining Chair 2',
        tags: ['furniture'],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(0.5, 0.9, 0.5)),
        transform: { position: new Vec3(1, 0, 0), rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
        parent: null,
        children: []
      });

      graph.addNode({
        id: 'table',
        name: 'Dining Table',
        tags: ['furniture'],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(2, 1, 1)),
        transform: { position: new Vec3(0, 0, 0), rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
        parent: null,
        children: []
      });

      const chairs = graph.findNodesByName('Chair');
      expect(chairs).toHaveLength(2);

      const diningItems = graph.findNodesByName('Dining');
      expect(diningItems).toHaveLength(3);

      const tables = graph.findNodesByName('Table');
      expect(tables).toHaveLength(1);
    });
  });

  describe('Transform hierarchy', () => {
    it('should calculate world transform', () => {
      const graph = new SceneGraph();

      const parent: SceneNode = {
        id: 'parent',
        name: 'Parent',
        tags: [],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1)),
        transform: {
          position: new Vec3(10, 0, 0),
          rotation: { x: 0, y: 0, z: 0 },
          scale: 2
        },
        parent: null,
        children: []
      };

      const child: SceneNode = {
        id: 'child',
        name: 'Child',
        tags: [],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(0.5, 0.5, 0.5)),
        transform: {
          position: new Vec3(1, 0, 0),
          rotation: { x: 0, y: 0, z: 0 },
          scale: 0.5
        },
        parent: 'parent',
        children: []
      };

      graph.addNode(parent);
      graph.addNode(child);

      const worldTransform = graph.getWorldTransform('child');

      // Child position: local (1, 0, 0) * parent_scale (2) + parent_pos (10, 0, 0) = (12, 0, 0)
      expect(worldTransform.position.x).toBe(12);
      expect(worldTransform.position.y).toBe(0);
      expect(worldTransform.position.z).toBe(0);

      // Child scale: local (0.5) * parent_scale (2) = 1
      expect(worldTransform.scale).toBe(1);
    });

    it('should calculate world bounds', () => {
      const graph = new SceneGraph();

      const node: SceneNode = {
        id: 'node',
        name: 'Node',
        tags: [],
        bounds: new AABB(new Vec3(-0.5, -0.5, -0.5), new Vec3(0.5, 0.5, 0.5)), // 1x1x1 cube
        transform: {
          position: new Vec3(10, 0, 0),
          rotation: { x: 0, y: 0, z: 0 },
          scale: 2
        },
        parent: null,
        children: []
      };

      graph.addNode(node);

      const worldBounds = graph.getWorldBounds('node');

      // Bounds scaled by 2 and translated by (10, 0, 0)
      // Min: (-0.5, -0.5, -0.5) * 2 + (10, 0, 0) = (9, -1, -1)
      // Max: (0.5, 0.5, 0.5) * 2 + (10, 0, 0) = (11, 1, 1)
      expect(worldBounds.min.x).toBe(9);
      expect(worldBounds.max.x).toBe(11);
    });
  });

  describe('Spatial queries', () => {
    it('should find nodes nearby', () => {
      const graph = new SceneGraph();

      graph.addNode({
        id: 'near',
        name: 'Near Node',
        tags: [],
        bounds: new AABB(new Vec3(0.9, 0, 0.9), new Vec3(1.1, 1, 1.1)),
        transform: { position: new Vec3(0, 0, 0), rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
        parent: null,
        children: []
      });

      graph.addNode({
        id: 'far',
        name: 'Far Node',
        tags: [],
        bounds: new AABB(new Vec3(9.9, 0, 9.9), new Vec3(10.1, 1, 10.1)),
        transform: { position: new Vec3(0, 0, 0), rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
        parent: null,
        children: []
      });

      const center = new Vec3(0, 0, 0);
      const nearbyNodes = graph.findNodesNearby(center, 2);

      expect(nearbyNodes).toHaveLength(1);
      expect(nearbyNodes[0].id).toBe('near');
    });

    it('should find nodes facing direction', () => {
      const graph = new SceneGraph();

      // Node facing +Z (forward)
      graph.addNode({
        id: 'forward',
        name: 'Forward Node',
        tags: [],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1)),
        transform: { position: new Vec3(0, 0, 0), rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
        parent: null,
        children: []
      });

      // Node facing +X (rotated 90° right)
      graph.addNode({
        id: 'right',
        name: 'Right Node',
        tags: [],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1)),
        transform: { position: new Vec3(2, 0, 0), rotation: { x: 0, y: Math.PI / 2, z: 0 }, scale: 1 },
        parent: null,
        children: []
      });

      const forwardDir = new Vec3(0, 0, 1);
      const facingForward = graph.findNodesFacing(forwardDir, Math.PI / 4); // 45° tolerance

      expect(facingForward).toHaveLength(1);
      expect(facingForward[0].id).toBe('forward');
    });
  });

  describe('Export', () => {
    it('should export to JSON', () => {
      const graph = new SceneGraph();

      graph.addNode({
        id: 'node1',
        name: 'Node 1',
        tags: ['tag1', 'tag2'],
        bounds: new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1)),
        transform: { position: new Vec3(0, 0, 0), rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
        parent: null,
        children: []
      });

      const json = graph.toJSON();

      expect(json.nodes).toHaveLength(1);
      expect(json.tags).toContain('tag1');
      expect(json.tags).toContain('tag2');
    });
  });
});
