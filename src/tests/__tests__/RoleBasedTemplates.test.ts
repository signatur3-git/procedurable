/**
 * Role-Based Scene Template Tests (F3-002)
 *
 * Tests that scene templates using roles resolve differently based on style
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { setMetadataStore, MetadataStore } from '../../storage/MetadataStore';
import { executeBuilder } from '../../generation/builder/YamlBuilderExecutor';
import {
  registerBuilderForRole,
  clearRegisteredRoles,
  clearRoleCache
} from '../../generation/builder/BuilderRoleRegistry';
import * as path from 'path';

describe('Role-Based Scene Templates (F3-002)', () => {
  beforeAll(() => {
    const store = new MetadataStore({
      rootDir: path.resolve(__dirname, '../../../metadata')
    });
    setMetadataStore(store);
  });

  beforeEach(() => {
    clearRegisteredRoles();
    clearRoleCache();
  });

  // Simple mock builders for testing
  const createMockBuilder = (name: string, styleTag: string) => {
    return (seed: number, overrides?: Record<string, any>) => {
      const { TracedBuilder } = require('../../generation/builder/TracedBuilder');
      const builder = new TracedBuilder(name, seed, overrides);

      // Add a measurement to track which builder was used
      builder.context.setMeasurement('builder_style', styleTag === 'modern' ? 1 : styleTag === 'industrial' ? 2 : 3);

      // No geometry needed for role resolution tests
      return builder.build();
    };
  };

  describe('role resolution with different styles', () => {
    it('should resolve roles to different builders based on style', async () => {
      // Register style-specific builders
      registerBuilderForRole('seating', 'ModernChair', { styles: ['modern'], priority: 10 });
      registerBuilderForRole('seating', 'IndustrialChair', { styles: ['industrial'], priority: 10 });
      registerBuilderForRole('seating', 'DefaultChair', { priority: 5 });

      // Create builder resolver that returns our mocks
      const builderResolver = (name: string) => {
        if (name === 'ModernChair') return createMockBuilder('ModernChair', 'modern');
        if (name === 'IndustrialChair') return createMockBuilder('IndustrialChair', 'industrial');
        if (name === 'DefaultChair') return createMockBuilder('DefaultChair', 'default');
        return null;
      };

      // Test with modern style
      const modernScene = {
        version: '1.0',
        name: 'TestScene',
        style: 'modern',
        compose: {
          chair: { role: 'seating' }
        },
        geometry: []
      };

      const modernResult = await executeBuilder(modernScene, {
        seed: 12345,
        builderResolver
      });

      const modernChild = modernResult.subBuilders.get('chair');
      expect(modernChild).toBeDefined();
      expect(modernChild!.builderName).toBe('ModernChair');

      // Test with industrial style
      const industrialScene = {
        ...modernScene,
        style: 'industrial'
      };

      const industrialResult = await executeBuilder(industrialScene, {
        seed: 12345,
        builderResolver
      });

      const industrialChild = industrialResult.subBuilders.get('chair');
      expect(industrialChild).toBeDefined();
      expect(industrialChild!.builderName).toBe('IndustrialChair');
    });

    it('should fall back to default builder when style has no specific match', async () => {
      registerBuilderForRole('table', 'ModernTable', { styles: ['modern'], priority: 10 });
      registerBuilderForRole('table', 'GenericTable', { priority: 5 });

      const builderResolver = (name: string) => {
        if (name === 'ModernTable') return createMockBuilder('ModernTable', 'modern');
        if (name === 'GenericTable') return createMockBuilder('GenericTable', 'default');
        return null;
      };

      // Test with rustic style (no specific match)
      const scene = {
        version: '1.0',
        name: 'TestScene',
        style: 'rustic',
        compose: {
          table: { role: 'table' }
        },
        geometry: []
      };

      const result = await executeBuilder(scene, {
        seed: 12345,
        builderResolver
      });

      const tableChild = result.subBuilders.get('table');
      expect(tableChild).toBeDefined();
      expect(tableChild!.builderName).toBe('GenericTable'); // Falls back to default
    });
  });

  describe('style cascading through roles', () => {
    it('should cascade parent style to role-based children', async () => {
      // Register a builder that records whether it received the style
      let receivedStyle: string | undefined;

      registerBuilderForRole('decoration', 'TestVase', { priority: 10 });

      const builderResolver = (name: string) => {
        if (name === 'TestVase') {
          return (seed: number, overrides?: Record<string, any>) => {
            receivedStyle = overrides?.__style__;
            const { TracedBuilder } = require('../../generation/builder/TracedBuilder');
            const builder = new TracedBuilder('TestVase', seed, overrides);
            return builder.build();
          };
        }
        return null;
      };

      const scene = {
        version: '1.0',
        name: 'TestScene',
        style: 'industrial',
        compose: {
          vase: { role: 'decoration' }
        },
        geometry: []
      };

      await executeBuilder(scene, {
        seed: 12345,
        builderResolver
      });

      expect(receivedStyle).toBe('industrial');
    });

    it('should allow composition-level style override for roles', async () => {
      registerBuilderForRole('seating', 'ModernChair', { styles: ['modern'], priority: 10 });
      registerBuilderForRole('seating', 'RusticChair', { styles: ['rustic'], priority: 10 });

      const builderResolver = (name: string) => {
        if (name === 'ModernChair') return createMockBuilder('ModernChair', 'modern');
        if (name === 'RusticChair') return createMockBuilder('RusticChair', 'rustic');
        return null;
      };

      // Parent is modern, but chair explicitly uses rustic
      const scene = {
        version: '1.0',
        name: 'TestScene',
        style: 'modern',
        compose: {
          chair: {
            role: 'seating',
            style: 'rustic'  // Override parent style
          }
        },
        geometry: []
      };

      const result = await executeBuilder(scene, {
        seed: 12345,
        builderResolver
      });

      const chairChild = result.subBuilders.get('chair');
      expect(chairChild).toBeDefined();
      expect(chairChild!.builderName).toBe('RusticChair');
    });
  });

  describe('multiple roles in same scene', () => {
    it('should resolve multiple different roles correctly', async () => {
      registerBuilderForRole('table', 'DiningTable', { priority: 10 });
      registerBuilderForRole('seating', 'DiningChair', { priority: 10 });
      registerBuilderForRole('decoration', 'Vase', { priority: 10 });

      const builderResolver = (name: string) => {
        if (name === 'DiningTable') return createMockBuilder('DiningTable', 'default');
        if (name === 'DiningChair') return createMockBuilder('DiningChair', 'default');
        if (name === 'Vase') return createMockBuilder('Vase', 'default');
        return null;
      };

      const scene = {
        version: '1.0',
        name: 'DiningRoom',
        style: 'modern',
        compose: {
          table: { role: 'table' },
          chair1: { role: 'seating', offset: { x: 0, y: 0, z: -0.5 } },
          chair2: { role: 'seating', offset: { x: 0, y: 0, z: 0.5 } },
          centerpiece: { role: 'decoration', offset: { x: 0, y: 0.75, z: 0 } }
        },
        geometry: []
      };

      const result = await executeBuilder(scene, {
        seed: 12345,
        builderResolver
      });

      expect(result.subBuilders.size).toBe(4);
      expect(result.subBuilders.get('table')?.builderName).toBe('DiningTable');
      expect(result.subBuilders.get('chair1')?.builderName).toBe('DiningChair');
      expect(result.subBuilders.get('chair2')?.builderName).toBe('DiningChair');
      expect(result.subBuilders.get('centerpiece')?.builderName).toBe('Vase');
    });
  });

  describe('error handling', () => {
    it('should error when role has no candidates', async () => {
      // Don't register any builders for the role

      const scene = {
        version: '1.0',
        name: 'TestScene',
        compose: {
          item: { role: 'nonexistent_role' }
        },
        geometry: []
      };

      await expect(executeBuilder(scene, {
        seed: 12345,
        builderResolver: () => null
      })).rejects.toThrow(/No builder found for role/);
    });
  });
});
