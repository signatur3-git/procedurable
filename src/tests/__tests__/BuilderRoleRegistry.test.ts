/**
 * BuilderRoleRegistry Tests (F3-001)
 *
 * Tests for role-based builder resolution
 */

import { describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import {
  registerBuilderForRole,
  unregisterBuilderFromRole,
  resolveRole,
  listRegisteredRoles,
  getRoleInfo,
  clearRoleCache,
  clearRegisteredRoles,
  loadRoleFromMetadata
} from '../../generation/builder/BuilderRoleRegistry';
import { setMetadataStore, MetadataStore } from '../../storage/MetadataStore';
import * as path from 'path';

describe('BuilderRoleRegistry (F3-001)', () => {
  beforeAll(() => {
    // Set up metadata store for tests
    const store = new MetadataStore({
      rootDir: path.resolve(__dirname, '../../../metadata')
    });
    setMetadataStore(store);
  });

  beforeEach(() => {
    clearRoleCache();
    clearRegisteredRoles();
  });

  describe('registerBuilderForRole', () => {
    it('should register a builder for a role', () => {
      registerBuilderForRole('seating', 'TestChair');

      const roles = listRegisteredRoles();
      expect(roles).toContain('seating');
    });

    it('should register multiple builders for the same role', () => {
      registerBuilderForRole('seating', 'Chair1');
      registerBuilderForRole('seating', 'Chair2');

      const info = getRoleInfo('seating');
      expect(info).resolves.toMatchObject({
        candidates: expect.arrayContaining([
          expect.objectContaining({ builder: 'Chair1' }),
          expect.objectContaining({ builder: 'Chair2' })
        ])
      });
    });

    it('should allow style-specific registration', () => {
      registerBuilderForRole('seating', 'ModernChair', { styles: ['modern'] });
      registerBuilderForRole('seating', 'RusticChair', { styles: ['rustic'] });

      const info = getRoleInfo('seating');
      expect(info).resolves.toMatchObject({
        candidates: expect.arrayContaining([
          expect.objectContaining({ builder: 'ModernChair', styles: ['modern'] }),
          expect.objectContaining({ builder: 'RusticChair', styles: ['rustic'] })
        ])
      });
    });

    it('should support priority for ordering', () => {
      registerBuilderForRole('lighting', 'BasicLamp', { priority: 0 });
      registerBuilderForRole('lighting', 'FancyLamp', { priority: 10 });

      const info = getRoleInfo('lighting');
      expect(info).resolves.toMatchObject({
        candidates: expect.arrayContaining([
          expect.objectContaining({ builder: 'FancyLamp', priority: 10 }),
          expect.objectContaining({ builder: 'BasicLamp', priority: 0 })
        ])
      });
    });
  });

  describe('unregisterBuilderFromRole', () => {
    it('should remove a builder from a role', () => {
      registerBuilderForRole('seating', 'TestChair');
      const removed = unregisterBuilderFromRole('seating', 'TestChair');

      expect(removed).toBe(true);
      expect(listRegisteredRoles()).not.toContain('seating');
    });

    it('should return false for non-existent builder', () => {
      registerBuilderForRole('seating', 'TestChair');
      const removed = unregisterBuilderFromRole('seating', 'NonExistent');

      expect(removed).toBe(false);
    });
  });

  describe('resolveRole', () => {
    it('should resolve to highest priority default candidate', async () => {
      registerBuilderForRole('seating', 'LowPriorityChair', { priority: 0 });
      registerBuilderForRole('seating', 'HighPriorityChair', { priority: 10 });

      const result = await resolveRole('seating');

      expect(result).not.toBeNull();
      expect(result!.builder).toBe('HighPriorityChair');
      expect(result!.source).toBe('default');
    });

    it('should prefer style-specific candidates when style is provided', async () => {
      registerBuilderForRole('seating', 'DefaultChair', { priority: 10 });
      registerBuilderForRole('seating', 'ModernChair', { styles: ['modern'], priority: 5 });

      // Without style, should pick default (higher priority)
      const noStyle = await resolveRole('seating');
      expect(noStyle!.builder).toBe('DefaultChair');

      // With style, should prefer the style-specific one
      const withStyle = await resolveRole('seating', 'modern');
      expect(withStyle!.builder).toBe('ModernChair');
      expect(withStyle!.source).toBe('exact_match');
    });

    it('should fall back to default when style has no match', async () => {
      registerBuilderForRole('seating', 'DefaultChair');
      registerBuilderForRole('seating', 'ModernChair', { styles: ['modern'] });

      const result = await resolveRole('seating', 'industrial');

      expect(result!.builder).toBe('DefaultChair');
      expect(result!.source).toBe('default');
    });

    it('should return null for unknown role', async () => {
      const result = await resolveRole('nonexistent_role');
      expect(result).toBeNull();
    });
  });

  describe('loadRoleFromMetadata', () => {
    it('should load seating role from metadata', async () => {
      const role = await loadRoleFromMetadata('seating');

      expect(role).not.toBeNull();
      expect(role!.name).toBe('seating');
      expect(role!.candidates.length).toBeGreaterThan(0);
    });

    it('should return null for non-existent role', async () => {
      const role = await loadRoleFromMetadata('nonexistent_role_xyz');
      expect(role).toBeNull();
    });
  });

  describe('integration: metadata + registered roles', () => {
    it('should prefer registered roles over metadata', async () => {
      // Register a builder that overrides metadata
      registerBuilderForRole('seating', 'CustomChair', { priority: 100 });

      const result = await resolveRole('seating');

      expect(result!.builder).toBe('CustomChair');
    });

    it('should resolve from metadata when not registered', async () => {
      // Don't register anything - should fall back to metadata
      const result = await resolveRole('seating');

      // Should get DiningChair from the seating.yaml metadata
      expect(result).not.toBeNull();
      expect(result!.builder).toBe('DiningChair');
    });
  });

  describe('getRoleInfo', () => {
    it('should return detailed info for registered role', async () => {
      registerBuilderForRole('test_role', 'TestBuilder', {
        styles: ['modern'],
        priority: 5,
        description: 'A test builder'
      });

      const info = await getRoleInfo('test_role');

      expect(info).not.toBeNull();
      expect(info!.source).toBe('registered');
      expect(info!.candidates).toContainEqual({
        builder: 'TestBuilder',
        styles: ['modern'],
        priority: 5,
        description: 'A test builder'
      });
    });

    it('should return detailed info for metadata role', async () => {
      const info = await getRoleInfo('seating');

      expect(info).not.toBeNull();
      expect(info!.source).toBe('metadata');
      expect(info!.candidates.length).toBeGreaterThan(0);
    });

    it('should return null for unknown role', async () => {
      const info = await getRoleInfo('totally_unknown_role');
      expect(info).toBeNull();
    });
  });
});
