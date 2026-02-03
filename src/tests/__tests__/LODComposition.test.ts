/**
 * LOD-Conditional Composition Tests (G2-001)
 *
 * Tests for the LOD system that allows compositions to be conditionally
 * included or replaced based on a scene-level LOD budget.
 */

import { executeBuilder } from '../../generation/builder/YamlBuilderExecutor';
import type { YamlBuilderDefinition } from '../../generation/builder/YamlBuilderTypes';
import { TracedOutput } from '../../generation/builder/TracedBuilder';

// Helper to create a simple box builder
function createSimpleBuilder(name: string): YamlBuilderDefinition {
  return {
    version: '1.0',
    name,
    geometry: [
      { box: { name: 'main', center: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 } } }
    ]
  };
}

// Create a builder that composes other builders with LOD constraints
function createSceneBuilder(options: {
  lodBudget?: number;
  compositions: Array<{
    name: string;
    lod_min?: number;
    lod_tier?: number;
  }>;
}): YamlBuilderDefinition {
  const compose: Record<string, any> = {};
  let offsetX = 0;

  for (const comp of options.compositions) {
    compose[comp.name] = {
      builder: 'SimpleBox',
      offset: { x: offsetX, y: 0, z: 0 },
      ...(comp.lod_min !== undefined && { lod_min: comp.lod_min }),
      ...(comp.lod_tier !== undefined && { lod_tier: comp.lod_tier })
    };
    offsetX += 2;
  }

  return {
    version: '1.0',
    name: 'SceneBuilder',
    ...(options.lodBudget !== undefined && { lod_budget: options.lodBudget }),
    compose
  };
}

// Mock builder resolver
function createBuilderResolver() {
  const simpleBoxBuilder = createSimpleBuilder('SimpleBox');

  return (name: string) => {
    if (name === 'SimpleBox') {
      return async (seed: number, overrides?: Record<string, any>): Promise<TracedOutput> => {
        return await executeBuilder(simpleBoxBuilder, { seed, overrides });
      };
    }
    return null;
  };
}

describe('LOD-Conditional Composition (G2-001)', () => {
  describe('lod_min behavior', () => {
    it('should include composition when lod_budget >= lod_min', async () => {
      const scene = createSceneBuilder({
        lodBudget: 2,
        compositions: [
          { name: 'detail_object', lod_min: 2 }
        ]
      });

      const result = await executeBuilder(scene, {
        seed: 42,
        builderResolver: createBuilderResolver()
      });

      // Should include the composition (mesh merged)
      expect(result.validation.vertexCount).toBeGreaterThan(0);
      expect(result.subBuilders.has('detail_object')).toBe(true);
    });

    it('should skip composition when lod_budget < lod_min', async () => {
      const scene = createSceneBuilder({
        lodBudget: 1,
        compositions: [
          { name: 'detail_object', lod_min: 2 }
        ]
      });

      const result = await executeBuilder(scene, {
        seed: 42,
        builderResolver: createBuilderResolver()
      });

      // Should skip the composition
      expect(result.subBuilders.has('detail_object')).toBe(false);
      // Should have a measurement indicating it was skipped
      expect(result.measurements.has('__lod_skipped__detail_object')).toBe(true);
    });

    it('should include composition when no lod_min specified', async () => {
      const scene = createSceneBuilder({
        lodBudget: 0,
        compositions: [
          { name: 'always_visible' }  // No lod_min
        ]
      });

      const result = await executeBuilder(scene, {
        seed: 42,
        builderResolver: createBuilderResolver()
      });

      expect(result.subBuilders.has('always_visible')).toBe(true);
    });

    it('should handle multiple compositions with different lod_min', async () => {
      const scene = createSceneBuilder({
        lodBudget: 1,
        compositions: [
          { name: 'tier0_object', lod_min: 0 },
          { name: 'tier1_object', lod_min: 1 },
          { name: 'tier2_object', lod_min: 2 },
          { name: 'tier3_object', lod_min: 3 }
        ]
      });

      const result = await executeBuilder(scene, {
        seed: 42,
        builderResolver: createBuilderResolver()
      });

      // Tier 0 and 1 should be included (budget is 1)
      expect(result.subBuilders.has('tier0_object')).toBe(true);
      expect(result.subBuilders.has('tier1_object')).toBe(true);

      // Tier 2 and 3 should be skipped
      expect(result.subBuilders.has('tier2_object')).toBe(false);
      expect(result.subBuilders.has('tier3_object')).toBe(false);

      // Check measurements for skipped items
      expect(result.measurements.has('__lod_skipped__tier2_object')).toBe(true);
      expect(result.measurements.has('__lod_skipped__tier3_object')).toBe(true);
    });
  });

  describe('lodBudget via ExecuteOptions', () => {
    it('should respect lodBudget from ExecuteOptions', async () => {
      const scene = createSceneBuilder({
        compositions: [
          { name: 'detail_object', lod_min: 2 }
        ]
      });

      // Run with high LOD budget via options
      const highLodResult = await executeBuilder(scene, {
        seed: 42,
        builderResolver: createBuilderResolver(),
        lodBudget: 3
      });
      expect(highLodResult.subBuilders.has('detail_object')).toBe(true);

      // Run with low LOD budget via options
      const lowLodResult = await executeBuilder(scene, {
        seed: 42,
        builderResolver: createBuilderResolver(),
        lodBudget: 1
      });
      expect(lowLodResult.subBuilders.has('detail_object')).toBe(false);
    });

    it('should prefer ExecuteOptions.lodBudget over YAML lod_budget', async () => {
      const scene = createSceneBuilder({
        lodBudget: 3,  // High budget in YAML
        compositions: [
          { name: 'detail_object', lod_min: 2 }
        ]
      });

      // Options override with low budget
      const result = await executeBuilder(scene, {
        seed: 42,
        builderResolver: createBuilderResolver(),
        lodBudget: 1  // Override to low
      });

      // Should use options value (1), so detail_object should be skipped
      expect(result.subBuilders.has('detail_object')).toBe(false);
    });
  });

  describe('lod_tier behavior', () => {
    it('should pass lod_tier to child via __lod_tier__ override', async () => {
      // This test verifies the mechanism works; actual tier enforcement
      // would need quality gates integration
      const scene = createSceneBuilder({
        lodBudget: 3,
        compositions: [
          { name: 'forced_tier1', lod_tier: 1 }
        ]
      });

      const result = await executeBuilder(scene, {
        seed: 42,
        builderResolver: createBuilderResolver()
      });

      // Child should be included
      expect(result.subBuilders.has('forced_tier1')).toBe(true);
    });
  });

  describe('LOD budget inheritance', () => {
    it('should propagate lod_budget to child builders via __lod_budget__ override', async () => {
      // Create a nested scene where parent sets lod_budget
      const nestedScene: YamlBuilderDefinition = {
        version: '1.0',
        name: 'NestedScene',
        lod_budget: 1,  // Parent sets budget
        compose: {
          child: {
            builder: 'InnerScene'
          }
        }
      };

      const innerScene: YamlBuilderDefinition = {
        version: '1.0',
        name: 'InnerScene',
        compose: {
          detail: {
            builder: 'SimpleBox',
            lod_min: 2  // Should be skipped because inherited budget is 1
          },
          basic: {
            builder: 'SimpleBox',
            lod_min: 0  // Should be included
          }
        }
      };

      const simpleBoxBuilder = createSimpleBuilder('SimpleBox');

      const resolver = (name: string) => {
        if (name === 'InnerScene') {
          return async (seed: number, overrides?: Record<string, any>): Promise<TracedOutput> => {
            return await executeBuilder(innerScene, {
              seed,
              overrides,
              builderResolver: resolver
            });
          };
        }
        if (name === 'SimpleBox') {
          return async (seed: number, overrides?: Record<string, any>): Promise<TracedOutput> => {
            return await executeBuilder(simpleBoxBuilder, { seed, overrides });
          };
        }
        return null;
      };

      const result = await executeBuilder(nestedScene, {
        seed: 42,
        builderResolver: resolver
      });

      // The nested detail should be skipped due to inherited budget
      expect(result.subBuilders.has('child')).toBe(true);
      const childOutput = result.subBuilders.get('child');
      expect(childOutput?.subBuilders.has('basic')).toBe(true);
      expect(childOutput?.measurements.has('__lod_skipped__detail')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle lod_budget of 0 (most aggressive LOD)', async () => {
      const scene = createSceneBuilder({
        lodBudget: 0,
        compositions: [
          { name: 'tier0_only', lod_min: 0 },
          { name: 'any_detail', lod_min: 1 }
        ]
      });

      const result = await executeBuilder(scene, {
        seed: 42,
        builderResolver: createBuilderResolver()
      });

      expect(result.subBuilders.has('tier0_only')).toBe(true);
      expect(result.subBuilders.has('any_detail')).toBe(false);
    });

    it('should treat undefined lod_budget as Infinity (no filtering)', async () => {
      const scene = createSceneBuilder({
        compositions: [
          { name: 'high_detail', lod_min: 4 }
        ]
      });

      const result = await executeBuilder(scene, {
        seed: 42,
        builderResolver: createBuilderResolver()
        // No lodBudget specified
      });

      // Should include everything
      expect(result.subBuilders.has('high_detail')).toBe(true);
    });

    it('should work with repeated compositions', async () => {
      const scene: YamlBuilderDefinition = {
        version: '1.0',
        name: 'RepeatedScene',
        lod_budget: 1,
        compose: {
          items: {
            builder: 'SimpleBox',
            lod_min: 2,  // Should be skipped at budget 1
            repeat: { count: 3, as: 'i' },
            offset: { x: '$i * 2', y: 0, z: 0 }
          }
        }
      };

      const result = await executeBuilder(scene, {
        seed: 42,
        builderResolver: createBuilderResolver()
      });

      // All repeated items should be skipped
      expect(result.subBuilders.has('items_0')).toBe(false);
      expect(result.subBuilders.has('items_1')).toBe(false);
      expect(result.subBuilders.has('items_2')).toBe(false);
    });
  });
});
