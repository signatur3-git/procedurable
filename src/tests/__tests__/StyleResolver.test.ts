/**
 * Style Resolver Tests (F2-001)
 *
 * Tests for style loading, resolution, and decision defaulting
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import { setMetadataStore, MetadataStore } from '../../storage/MetadataStore';
import {
  loadStyle,
  resolveStyle,
  normalizeStyleDefinition,
  getDecisionDefault,
  getMaterialFromPalette,
  listStyles,
  clearStyleCache,
  DEFAULT_STYLE,
  StyleDefinition
} from '../../generation/builder/StyleResolver';
import * as path from 'path';

describe('Style Resolver (F2-001)', () => {
  let store: MetadataStore;

  beforeAll(() => {
    // Use the real metadata folder
    store = new MetadataStore({
      rootDir: path.resolve(__dirname, '../../../metadata')
    });
    setMetadataStore(store);
  });

  afterEach(() => {
    clearStyleCache();
  });

  describe('loadStyle', () => {
    it('should load modern style from metadata', async () => {
      const style = await loadStyle('modern');
      expect(style).not.toBeNull();
      expect(style!.name).toBe('Modern');
    });

    it('should load rustic style from metadata', async () => {
      const style = await loadStyle('rustic');
      expect(style).not.toBeNull();
      expect(style!.name).toBe('Rustic');
    });

    it('should load industrial style from metadata', async () => {
      const style = await loadStyle('industrial');
      expect(style).not.toBeNull();
      expect(style!.name).toBe('Industrial');
    });

    it('should return null for non-existent style', async () => {
      const style = await loadStyle('nonexistent');
      expect(style).toBeNull();
    });

    it('should cache loaded styles', async () => {
      const style1 = await loadStyle('modern');
      const style2 = await loadStyle('modern');
      expect(style1).toBe(style2); // Same reference
    });
  });

  describe('resolveStyle', () => {
    it('should return default style when no name provided', async () => {
      const result = await resolveStyle(undefined);
      expect(result.source).toBe('default');
      expect(result.definition).toBe(DEFAULT_STYLE);
    });

    it('should resolve existing style from metadata', async () => {
      const result = await resolveStyle('modern');
      expect(result.source).toBe('metadata');
      expect(result.name).toBe('modern');
    });

    it('should fall back to default for unknown style', async () => {
      const result = await resolveStyle('unknown_style');
      expect(result.source).toBe('default');
    });
  });

  describe('normalizeStyleDefinition', () => {
    it('should convert legacy colors to material_palette', () => {
      const legacy = {
        name: 'Test',
        colors: {
          primary: [{ name: 'white', hex: '#FFFFFF', rgb: [1, 1, 1] }]
        }
      };

      const normalized = normalizeStyleDefinition(legacy);
      expect(normalized.material_palette).toBeDefined();
      expect(normalized.material_palette!['primary_color']).toBeDefined();
      expect(normalized.material_palette!['primary_color'].rgb).toEqual([1, 1, 1]);
    });

    it('should convert legacy materials to material_palette', () => {
      const legacy = {
        name: 'Test',
        materials: {
          primary: [{ name: 'glass', roughness: 0.1, metalness: 0.0 }]
        }
      };

      const normalized = normalizeStyleDefinition(legacy);
      expect(normalized.material_palette!['primary_default']).toBeDefined();
      expect(normalized.material_palette!['primary_default'].roughness).toBe(0.1);
    });

    it('should convert legacy proportions to decision_defaults', () => {
      const legacy = {
        name: 'Test',
        proportions: {
          edge_radius: 0.005,
          leg_taper: 0.0
        }
      };

      const normalized = normalizeStyleDefinition(legacy);
      expect(normalized.decision_defaults!['edge_radius']).toBe(0.005);
      expect(normalized.decision_defaults!['leg_taper']).toBe(0.0);
    });

    it('should preserve legacy fields for backward compatibility', () => {
      const legacy = {
        name: 'Test',
        colors: { primary: [] },
        materials: { primary: [] }
      };

      const normalized = normalizeStyleDefinition(legacy);
      expect(normalized.colors).toBeDefined();
      expect(normalized.materials).toBeDefined();
    });
  });

  describe('getDecisionDefault', () => {
    it('should return decision default from style', () => {
      const style: StyleDefinition = {
        name: 'Test',
        decision_defaults: {
          leg_style: 'tapered',
          seat_cushion: true,
          leg_count: 4
        }
      };

      expect(getDecisionDefault(style, 'leg_style')).toBe('tapered');
      expect(getDecisionDefault(style, 'seat_cushion')).toBe(true);
      expect(getDecisionDefault(style, 'leg_count')).toBe(4);
    });

    it('should return undefined for missing decision', () => {
      const style: StyleDefinition = {
        name: 'Test',
        decision_defaults: {}
      };

      expect(getDecisionDefault(style, 'nonexistent')).toBeUndefined();
    });
  });

  describe('getMaterialFromPalette', () => {
    it('should return material for existing role', () => {
      const style: StyleDefinition = {
        name: 'Test',
        material_palette: {
          primary_wood: { rgb: [0.6, 0.4, 0.2], roughness: 0.6, metalness: 0.0 }
        }
      };

      const mat = getMaterialFromPalette(style, 'primary_wood');
      expect(mat).toBeDefined();
      expect(mat!.roughness).toBe(0.6);
    });

    it('should return undefined for missing role', () => {
      const style: StyleDefinition = {
        name: 'Test',
        material_palette: {}
      };

      expect(getMaterialFromPalette(style, 'nonexistent')).toBeUndefined();
    });
  });

  describe('listStyles', () => {
    it('should list available styles', async () => {
      const styles = await listStyles();
      expect(styles).toContain('modern');
      expect(styles).toContain('rustic');
      expect(styles).toContain('industrial');
    });
  });

  describe('integration with existing style metadata', () => {
    it('should normalize modern style with all expected fields', async () => {
      const style = await loadStyle('modern');
      expect(style).not.toBeNull();

      // Should have converted proportions to decision_defaults
      expect(style!.decision_defaults).toBeDefined();

      // Should have material_palette
      expect(style!.material_palette).toBeDefined();

      // Should preserve legacy fields
      expect(style!.colors).toBeDefined();
      expect(style!.materials).toBeDefined();
    });

    it('should have pattern preferences from ornamentation', async () => {
      const style = await loadStyle('modern');
      expect(style!.pattern_preferences).toBeDefined();
      expect(style!.pattern_preferences!.ornamentation).toBe('minimal');
    });
  });

  describe('TracedBuilder style defaults integration', () => {
    const { TracedBuilder } = require('../../generation/builder/TracedBuilder');

    it('should apply style defaults to choice decisions', () => {
      const builder = new TracedBuilder('test', 12345);
      builder.setStyleDefaults({
        leg_style: 'square',
        arm_style: 'none'
      });

      // With style default, should pick 'square' even though options include others
      const value = builder.decide('leg_style', ['round', 'square', 'tapered']);
      expect(value).toBe('square');

      // Decision should be traced as 'style' source
      const decision = builder.decisions.get('leg_style');
      expect(decision?.source).toBe('style');
    });

    it('should apply style defaults to number decisions within range', () => {
      const builder = new TracedBuilder('test', 12345);
      builder.setStyleDefaults({
        edge_radius: 0.0
      });

      const value = builder.decideNumber('edge_radius', 0.0, 0.02);
      expect(value).toBe(0.0);

      const decision = builder.decisions.get('edge_radius');
      expect(decision?.source).toBe('style');
    });

    it('should apply style defaults to boolean decisions', () => {
      const builder = new TracedBuilder('test', 12345);
      builder.setStyleDefaults({
        has_cushion: false
      });

      const value = builder.decideBoolean('has_cushion', 0.7);
      expect(value).toBe(false);

      const decision = builder.decisions.get('has_cushion');
      expect(decision?.source).toBe('style');
    });

    it('should prefer explicit overrides over style defaults', () => {
      const builder = new TracedBuilder('test', 12345, { leg_style: 'tapered' });
      builder.setStyleDefaults({
        leg_style: 'square'
      });

      const value = builder.decide('leg_style', ['round', 'square', 'tapered']);
      expect(value).toBe('tapered');

      const decision = builder.decisions.get('leg_style');
      expect(decision?.source).toBe('override');
    });

    it('should fall back to random if style default is not a valid option', () => {
      const builder = new TracedBuilder('test', 12345);
      builder.setStyleDefaults({
        leg_style: 'curved'  // Not in options
      });

      const value = builder.decide('leg_style', ['round', 'square', 'tapered']);
      // Should fall back to random
      expect(['round', 'square', 'tapered']).toContain(value);

      const decision = builder.decisions.get('leg_style');
      expect(decision?.source).toBe('random');
    });

    it('should fall back to random if style default is outside numeric range', () => {
      const builder = new TracedBuilder('test', 12345);
      builder.setStyleDefaults({
        edge_radius: 0.1  // Outside range [0, 0.02]
      });

      const value = builder.decideNumber('edge_radius', 0.0, 0.02);
      // Should fall back to random within range
      expect(value).toBeGreaterThanOrEqual(0.0);
      expect(value).toBeLessThanOrEqual(0.02);

      const decision = builder.decisions.get('edge_radius');
      expect(decision?.source).toBe('random');
    });
  });

  describe('YamlBuilderExecutor style integration', () => {
    const { executeBuilder } = require('../../generation/builder/YamlBuilderExecutor');

    it('should apply industrial style defaults to builder', async () => {
      const yaml = {
        version: '1.0',
        name: 'StyledChair',
        style: 'industrial',
        decisions: {
          leg_style: {
            type: 'choice',
            options: ['round', 'square', 'tapered']
          },
          edge_radius: {
            type: 'number',
            min: 0.0,
            max: 0.02
          }
        },
        geometry: []
      };

      const result = await executeBuilder(yaml, { seed: 12345 });

      // Industrial style should default leg_style to 'square'
      const legDecision = result.decisions.get('leg_style');
      expect(legDecision?.value).toBe('square');
      expect(legDecision?.source).toBe('style');

      // Industrial style should default edge_radius to 0.0
      const edgeDecision = result.decisions.get('edge_radius');
      expect(edgeDecision?.value).toBe(0.0);
      expect(edgeDecision?.source).toBe('style');
    });

    it('should apply modern style defaults differently', async () => {
      const yaml = {
        version: '1.0',
        name: 'StyledChair',
        style: 'modern',
        decisions: {
          leg_style: {
            type: 'choice',
            options: ['round', 'straight', 'tapered']
          }
        },
        geometry: []
      };

      const result = await executeBuilder(yaml, { seed: 12345 });

      // Modern style should default leg_style to 'straight'
      const legDecision = result.decisions.get('leg_style');
      expect(legDecision?.value).toBe('straight');
      expect(legDecision?.source).toBe('style');
    });

    it('should work without style specified', async () => {
      const yaml = {
        version: '1.0',
        name: 'NoStyleChair',
        decisions: {
          leg_style: {
            type: 'choice',
            options: ['round', 'square', 'tapered']
          }
        },
        geometry: []
      };

      const result = await executeBuilder(yaml, { seed: 12345 });

      // No style, should be random
      const legDecision = result.decisions.get('leg_style');
      expect(legDecision?.source).toBe('random');
    });
  });

  describe('F2-002: Style Cascading in Composition', () => {
    const { executeBuilder } = require('../../generation/builder/YamlBuilderExecutor');

    // Create a mock child builder for testing
    const mockChildBuilder = (seed: number, overrides?: Record<string, any>) => {
      const { TracedBuilder } = require('../../generation/builder/TracedBuilder');
      const builder = new TracedBuilder('MockChild', seed, overrides);

      // Apply style defaults if __style__ was passed
      if (overrides?.__style__) {
        // Simulate loading style defaults
        const styleDefaults: Record<string, any> = {
          industrial: { child_decision: 'metal' },
          modern: { child_decision: 'glass' },
          rustic: { child_decision: 'wood' }
        };
        const defaults = styleDefaults[overrides.__style__] || {};
        builder.setStyleDefaults(defaults);
      }

      // Make a decision that should be affected by style
      builder.decide('child_decision', ['metal', 'glass', 'wood']);

      return builder.build();
    };

    it('should cascade parent style to child builders via __style__ override', async () => {
      const yaml = {
        version: '1.0',
        name: 'ParentBuilder',
        style: 'industrial',
        decisions: {
          leg_style: {  // This exists in industrial style defaults
            type: 'choice',
            options: ['round', 'square', 'tapered']
          }
        },
        geometry: [],
        compose: {
          child1: {
            builder: 'MockChild'
          }
        }
      };

      const builderResolver = (name: string) => {
        if (name === 'MockChild') return mockChildBuilder;
        return null;
      };

      const result = await executeBuilder(yaml, {
        seed: 12345,
        builderResolver
      });

      // Parent should use industrial style - leg_style defaults to 'square'
      const parentDecision = result.decisions.get('leg_style');
      expect(parentDecision?.value).toBe('square');
      expect(parentDecision?.source).toBe('style');

      // Child should have inherited industrial style and chosen 'metal'
      const childOutput = result.subBuilders.get('child1');
      expect(childOutput).toBeDefined();
      const childDecision = childOutput!.decisions.get('child_decision');
      expect(childDecision?.value).toBe('metal');
      expect(childDecision?.source).toBe('style');
    });

    it('should allow child to override parent style', async () => {
      const yaml = {
        version: '1.0',
        name: 'ParentBuilder',
        style: 'industrial',
        decisions: {},
        geometry: [],
        compose: {
          child1: {
            builder: 'MockChild',
            style: 'modern'  // Override parent's industrial with modern
          }
        }
      };

      const builderResolver = (name: string) => {
        if (name === 'MockChild') return mockChildBuilder;
        return null;
      };

      const result = await executeBuilder(yaml, {
        seed: 12345,
        builderResolver
      });

      // Child should use modern style (overriding parent's industrial)
      const childOutput = result.subBuilders.get('child1');
      expect(childOutput).toBeDefined();
      const childDecision = childOutput!.decisions.get('child_decision');
      expect(childDecision?.value).toBe('glass');
      expect(childDecision?.source).toBe('style');
    });

    it('should not cascade style when parent has no style', async () => {
      const yaml = {
        version: '1.0',
        name: 'ParentBuilder',
        // No style specified
        decisions: {},
        geometry: [],
        compose: {
          child1: {
            builder: 'MockChild'
          }
        }
      };

      const builderResolver = (name: string) => {
        if (name === 'MockChild') return mockChildBuilder;
        return null;
      };

      const result = await executeBuilder(yaml, {
        seed: 12345,
        builderResolver
      });

      // Child should fall back to random (no style inherited)
      const childOutput = result.subBuilders.get('child1');
      expect(childOutput).toBeDefined();
      const childDecision = childOutput!.decisions.get('child_decision');
      expect(childDecision?.source).toBe('random');
    });
  });

  describe('F2-003: Style-Driven Material Theming', () => {
    const { resolveMaterialSlots, resolveFromStylePalette, styleMaterialToColor } = require('../../generation/builder/MaterialResolver');

    describe('resolveFromStylePalette', () => {
      it('should return palette entry for existing role', () => {
        const style = {
          name: 'test',
          material_palette: {
            primary_wood: { rgb: [0.6, 0.4, 0.2], roughness: 0.7 }
          }
        };

        const result = resolveFromStylePalette('primary_wood', style);
        expect(result).toBeDefined();
        expect(result.rgb).toEqual([0.6, 0.4, 0.2]);
        expect(result.roughness).toBe(0.7);
      });

      it('should return undefined for missing role', () => {
        const style = {
          name: 'test',
          material_palette: {}
        };

        const result = resolveFromStylePalette('nonexistent', style);
        expect(result).toBeUndefined();
      });

      it('should return undefined when style is null', () => {
        const result = resolveFromStylePalette('primary_wood', null);
        expect(result).toBeUndefined();
      });
    });

    describe('styleMaterialToColor', () => {
      it('should convert rgb array to RGBColor', () => {
        const mat = { rgb: [0.8, 0.6, 0.4] as [number, number, number] };
        const color = styleMaterialToColor(mat);
        expect(color.r).toBeCloseTo(0.8);
        expect(color.g).toBeCloseTo(0.6);
        expect(color.b).toBeCloseTo(0.4);
      });

      it('should convert hex color string', () => {
        const mat = { color: '#FF0000' };
        const color = styleMaterialToColor(mat);
        expect(color.r).toBeCloseTo(1.0);
        expect(color.g).toBeCloseTo(0.0);
        expect(color.b).toBeCloseTo(0.0);
      });
    });

    describe('resolveMaterialSlots with role', () => {
      it('should resolve material from style palette when role is specified', () => {
        const materials = {
          wood: {
            role: 'primary_wood'
          }
        };

        const style = {
          name: 'industrial',
          material_palette: {
            primary_wood: { rgb: [0.36, 0.25, 0.20], roughness: 0.8, metalness: 0.0 }
          }
        };

        const resolved = resolveMaterialSlots(materials, new Map(), style);
        const wood = resolved.get('wood');

        expect(wood).toBeDefined();
        expect(wood.color.r).toBeCloseTo(0.36);
        expect(wood.color.g).toBeCloseTo(0.25);
        expect(wood.color.b).toBeCloseTo(0.20);
        expect(wood.roughness).toBe(0.8);
        expect(wood.metalness).toBe(0.0);
      });

      it('should use fallback_color when role not found in palette', () => {
        const materials = {
          accent: {
            role: 'nonexistent_role',
            fallback_color: '#FF0000'
          }
        };

        const style = {
          name: 'test',
          material_palette: {}
        };

        const resolved = resolveMaterialSlots(materials, new Map(), style);
        const accent = resolved.get('accent');

        expect(accent).toBeDefined();
        expect(accent.color.r).toBeCloseTo(1.0);
        expect(accent.color.g).toBeCloseTo(0.0);
        expect(accent.color.b).toBeCloseTo(0.0);
      });

      it('should use explicit color when role not found and no fallback', () => {
        const materials = {
          wood: {
            role: 'nonexistent_role',
            color: '#00FF00'
          }
        };

        const style = {
          name: 'test',
          material_palette: {}
        };

        const resolved = resolveMaterialSlots(materials, new Map(), style);
        const wood = resolved.get('wood');

        expect(wood).toBeDefined();
        expect(wood.color.g).toBeCloseTo(1.0);
      });

      it('should work with traditional color when no role specified', () => {
        const materials = {
          metal: {
            color: '#C0C0C0',
            roughness: 0.3,
            metalness: 0.9
          }
        };

        const resolved = resolveMaterialSlots(materials, new Map(), null);
        const metal = resolved.get('metal');

        expect(metal).toBeDefined();
        expect(metal.roughness).toBe(0.3);
        expect(metal.metalness).toBe(0.9);
      });
    });

    describe('executor integration with role-based materials', () => {
      const { executeBuilder } = require('../../generation/builder/YamlBuilderExecutor');

      it('should apply different colors for same builder with different styles', async () => {
        // Builder that uses role-based material
        const yaml = {
          version: '1.0',
          name: 'StyledBox',
          materials: {
            main: {
              role: 'primary_wood'
            }
          },
          geometry: []  // No geometry needed, just testing material resolution
        };

        // With industrial style
        const industrialResult = await executeBuilder(
          { ...yaml, style: 'industrial' },
          { seed: 12345 }
        );

        // With modern style
        const modernResult = await executeBuilder(
          { ...yaml, style: 'modern' },
          { seed: 12345 }
        );

        // Get material slots from each
        const industrialSlot = industrialResult.mesh.materialSlots.find((s: any) => s.name === 'main');
        const modernSlot = modernResult.mesh.materialSlots.find((s: any) => s.name === 'main');

        expect(industrialSlot).toBeDefined();
        expect(modernSlot).toBeDefined();

        // They should have different colors (industrial is darker wood, modern is lighter)
        // Industrial primary_wood: rgb: [0.36, 0.25, 0.20]
        // Modern primary_wood: rgb: [0.88, 0.88, 0.88]
        expect(industrialSlot!.color.r).toBeLessThan(modernSlot!.color.r);
      });

      it('should include PBR properties from style palette', async () => {
        const yaml = {
          version: '1.0',
          name: 'MetalBox',
          style: 'industrial',
          materials: {
            metal: {
              role: 'accent_metal'
            }
          },
          geometry: []  // No geometry needed
        };

        const result = await executeBuilder(yaml, { seed: 12345 });
        const metalSlot = result.mesh.materialSlots.find((s: any) => s.name === 'metal');

        expect(metalSlot).toBeDefined();
        // Industrial accent_metal should be metallic (metalness: 0.9)
        expect(metalSlot!.metalness).toBeGreaterThan(0.5);
      });
    });
  });
});
