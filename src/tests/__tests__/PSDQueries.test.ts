/**
 * PSD Scene Query Tests (B2-003)
 *
 * Tests for PSD scene querying functionality.
 */

import { describe, it, expect } from '@jest/globals';
import {
  PSDScene,
  PSDMeshPrim,
  PSDXformPrim,
  PSDMaterial,
  PSD_IDENTITY_TRANSFORM,
  collectAggregatedTags,
  queryByTag,
  getPrimBounds,
  getPrimCenter,
  getRootPrims,
  listPrimsHierarchy,
  getOverview,
  inspectPrim,
  getMaterialAssignments,
  calculateDistance,
  findPrimsWithin
} from '../../generation/builder/PSD';

// ============================================================================
// Test Helpers
// ============================================================================

function makeTestScene(): PSDScene {
  const materials: PSDMaterial[] = [
    { name: 'wood', color: [0.6, 0.4, 0.2], roughness: 0.7, metalness: 0.0 },
    { name: 'metal', color: [0.8, 0.8, 0.8], roughness: 0.3, metalness: 1.0 }
  ];

  const scene: PSDScene = {
    version: '0.1',
    name: 'TestScene',
    generator: 'TestScene seed=42',
    materials,
    prims: {
      '/Root': {
        path: '/Root',
        type: 'Xform',
        parent: null,
        transform: { ...PSD_IDENTITY_TRANSFORM },
        tags: ['scene'],
        bounds: { min: [-2, 0, -2], max: [2, 2, 2] },
        children: ['/Root/table', '/Root/chair']
      } as PSDXformPrim,
      '/Root/table': {
        path: '/Root/table',
        type: 'Xform',
        parent: '/Root',
        transform: { ...PSD_IDENTITY_TRANSFORM },
        tags: ['furniture', 'table'],
        bounds: { min: [-1, 0, -0.5], max: [1, 0.8, 0.5] },
        children: ['/Root/table/top', '/Root/table/legs']
      } as PSDXformPrim,
      '/Root/table/top': {
        path: '/Root/table/top',
        type: 'Mesh',
        parent: '/Root/table',
        transform: { ...PSD_IDENTITY_TRANSFORM },
        tags: ['tabletop'],
        bounds: { min: [-1, 0.75, -0.5], max: [1, 0.8, 0.5] },
        children: [],
        geometry: {
          vertices: [-1, 0.75, -0.5, 1, 0.75, -0.5, 1, 0.75, 0.5, -1, 0.75, 0.5],
          normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
          indices: [0, 1, 2, 0, 2, 3]
        },
        materialSlots: [0, 0],  // 2 triangles, both wood
        skeleton: undefined,
        jointWeights: []
      } as PSDMeshPrim,
      '/Root/table/legs': {
        path: '/Root/table/legs',
        type: 'Xform',
        parent: '/Root/table',
        transform: { ...PSD_IDENTITY_TRANSFORM },
        tags: ['legs', 'structural'],
        bounds: { min: [-0.9, 0, -0.4], max: [0.9, 0.75, 0.4] },
        children: []
      } as PSDXformPrim,
      '/Root/chair': {
        path: '/Root/chair',
        type: 'Mesh',
        parent: '/Root',
        transform: {
          position: [1.5, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        },
        tags: ['furniture', 'seating'],
        bounds: { min: [1, 0, -0.3], max: [2, 1.2, 0.3] },
        children: [],
        geometry: {
          vertices: [1, 0, -0.3, 2, 0, -0.3, 2, 0, 0.3],
          normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
          indices: [0, 1, 2]
        },
        materialSlots: [1],  // 1 triangle, metal
        skeleton: undefined,
        jointWeights: []
      } as PSDMeshPrim
    }
  };

  return scene;
}

// ============================================================================
// Tests
// ============================================================================

describe('PSD Scene Queries (B2-003)', () => {
  describe('collectAggregatedTags', () => {
    it('should collect tags from prim and descendants', () => {
      const scene = makeTestScene();
      const tags = collectAggregatedTags(scene, '/Root/table');

      expect(tags).toContain('furniture');
      expect(tags).toContain('table');
      expect(tags).toContain('tabletop');
      expect(tags).toContain('legs');
      expect(tags).toContain('structural');
    });

    it('should return only own tags for leaf prim', () => {
      const scene = makeTestScene();
      const tags = collectAggregatedTags(scene, '/Root/table/top');

      expect(tags).toEqual(['tabletop']);
    });

    it('should return empty for non-existent prim', () => {
      const scene = makeTestScene();
      const tags = collectAggregatedTags(scene, '/NotExist');

      expect(tags).toEqual([]);
    });
  });

  describe('queryByTag', () => {
    it('should find prims with matching tag', () => {
      const scene = makeTestScene();
      const results = queryByTag(scene, 'furniture');

      expect(results).toContain('/Root/table');
      expect(results).toContain('/Root/chair');
      // Root should also be found since it has furniture descendants
      expect(results).toContain('/Root');
    });

    it('should find prims with descendant tag', () => {
      const scene = makeTestScene();
      const results = queryByTag(scene, 'tabletop');

      expect(results).toContain('/Root/table/top');
      expect(results).toContain('/Root/table');  // parent of tabletop
      expect(results).toContain('/Root');  // ancestor of tabletop
    });

    it('should return empty for non-existent tag', () => {
      const scene = makeTestScene();
      const results = queryByTag(scene, 'nonexistent');

      expect(results).toHaveLength(0);
    });
  });

  describe('getPrimBounds', () => {
    it('should return bounds for existing prim', () => {
      const scene = makeTestScene();
      const bounds = getPrimBounds(scene, '/Root/chair');

      expect(bounds).not.toBeNull();
      expect(bounds!.min).toEqual([1, 0, -0.3]);
      expect(bounds!.max).toEqual([2, 1.2, 0.3]);
    });

    it('should return null for non-existent prim', () => {
      const scene = makeTestScene();
      const bounds = getPrimBounds(scene, '/NotExist');

      expect(bounds).toBeNull();
    });
  });

  describe('getPrimCenter', () => {
    it('should calculate center correctly', () => {
      const bounds = { min: [0, 0, 0] as [number, number, number], max: [2, 4, 6] as [number, number, number] };
      const center = getPrimCenter(bounds);

      expect(center).toEqual([1, 2, 3]);
    });
  });

  describe('getRootPrims', () => {
    it('should return root prims', () => {
      const scene = makeTestScene();
      const roots = getRootPrims(scene);

      expect(roots).toEqual(['/Root']);
    });
  });

  describe('listPrimsHierarchy', () => {
    it('should list all prims with depth', () => {
      const scene = makeTestScene();
      const hierarchy = listPrimsHierarchy(scene);

      expect(hierarchy.length).toBe(5);

      const root = hierarchy.find(h => h.path === '/Root');
      expect(root?.depth).toBe(0);
      expect(root?.childCount).toBe(2);

      const tableTop = hierarchy.find(h => h.path === '/Root/table/top');
      expect(tableTop?.depth).toBe(2);
      expect(tableTop?.childCount).toBe(0);
    });
  });

  describe('getOverview', () => {
    it('should return overview of root prims', () => {
      const scene = makeTestScene();
      const overview = getOverview(scene);

      expect(overview.length).toBe(1);
      const root = overview[0];

      expect(root.path).toBe('/Root');
      expect(root.childCount).toBe(2);
      expect(root.descendantCount).toBe(4);  // table, top, legs, chair
      expect(root.aggregatedTags).toContain('scene');
      expect(root.aggregatedTags).toContain('furniture');
    });

    it('should combine bounds from descendants', () => {
      const scene = makeTestScene();
      const overview = getOverview(scene);
      const root = overview[0];

      // Combined bounds should include chair at x=1.5
      expect(root.combinedBounds.max[0]).toBeGreaterThanOrEqual(2);
    });
  });

  describe('inspectPrim', () => {
    it('should return prim details with children', () => {
      const scene = makeTestScene();
      const inspection = inspectPrim(scene, '/Root/table');

      expect(inspection).not.toBeNull();
      expect(inspection!.path).toBe('/Root/table');
      expect(inspection!.type).toBe('Xform');
      expect(inspection!.tags).toContain('furniture');
      expect(inspection!.children.length).toBe(2);
    });

    it('should include mesh-specific details for mesh prim', () => {
      const scene = makeTestScene();
      const inspection = inspectPrim(scene, '/Root/table/top');

      expect(inspection).not.toBeNull();
      expect(inspection!.type).toBe('Mesh');
      expect(inspection!.triangleCount).toBe(2);
    });

    it('should return null for non-existent prim', () => {
      const scene = makeTestScene();
      const inspection = inspectPrim(scene, '/NotExist');

      expect(inspection).toBeNull();
    });
  });

  describe('getMaterialAssignments', () => {
    it('should track material usage across prims', () => {
      const scene = makeTestScene();
      const assignments = getMaterialAssignments(scene);

      expect(assignments.length).toBe(2);

      const wood = assignments[0];
      expect(wood.material.name).toBe('wood');
      expect(wood.usedBy).toContain('/Root/table/top');
      expect(wood.triangleCount).toBe(2);

      const metal = assignments[1];
      expect(metal.material.name).toBe('metal');
      expect(metal.usedBy).toContain('/Root/chair');
      expect(metal.triangleCount).toBe(1);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distances between prims', () => {
      const scene = makeTestScene();
      const distance = calculateDistance(scene, '/Root/table', '/Root/chair');

      expect(distance).not.toBeNull();
      expect(distance!.centerToCenter).toBeGreaterThan(0);
      expect(distance!.surfaceToSurface).toBeGreaterThanOrEqual(0);
    });

    it('should return null for non-existent prim', () => {
      const scene = makeTestScene();
      const distance = calculateDistance(scene, '/Root/table', '/NotExist');

      expect(distance).toBeNull();
    });
  });

  describe('findPrimsWithin', () => {
    it('should find prims within radius', () => {
      const scene = makeTestScene();
      // Chair is at x=1.5, table is at x=0
      const nearby = findPrimsWithin(scene, '/Root/table', 3);

      // Should find chair and other nearby prims
      expect(nearby).toContain('/Root/chair');
    });

    it('should not find prims outside radius', () => {
      const scene = makeTestScene();
      const nearby = findPrimsWithin(scene, '/Root/table', 0.1);

      // Very small radius should not find chair at x=1.5
      expect(nearby).not.toContain('/Root/chair');
    });

    it('should return empty for non-existent center', () => {
      const scene = makeTestScene();
      const nearby = findPrimsWithin(scene, '/NotExist', 10);

      expect(nearby).toEqual([]);
    });
  });
});
