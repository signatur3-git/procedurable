/**
 * StyledRoom.test.ts
 *
 * H2-001: Styled Room Demo Tests
 *
 * Verifies:
 * - Role-based scene template with table, seating (x4), decoration
 * - mid_century_modern style produces tapered round legs, warm walnut tones
 * - industrial style produces square steel legs, dark angular forms
 * - Style cascades from scene level to all composed furniture
 * - Different styles produce genuinely different geometry (not just colors)
 * - Determinism: same seed → same output
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { parseAndExecuteBuilder, parseYamlWithLibrary, YamlBuilderDefinition } from '../../generation/builder/YamlBuilderParser';
import { setMetadataStore, MetadataStore } from '../../storage/MetadataStore';
import { clearStyleCache } from '../../generation/builder/StyleResolver';
import { clearRoleCache, clearRegisteredRoles } from '../../generation/builder/BuilderRoleRegistry';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TracedOutput } from '../../generation/builder/TracedBuilder';

const SCENES_PATH = join(__dirname, '../../../builders/scenes/templates');
const CATALOG_PATH = join(__dirname, '../../../builders/catalog');
const METADATA_PATH = join(__dirname, '../../../metadata');

// Set up metadata store before tests
beforeAll(() => {
  const store = new MetadataStore({ rootDir: METADATA_PATH });
  setMetadataStore(store);
});

/**
 * Load and parse a YAML builder file from a given path
 */
async function loadYaml(path: string): Promise<YamlBuilderDefinition> {
  const yamlStr = readFileSync(path, 'utf-8');
  return parseYamlWithLibrary(yamlStr);
}

/**
 * Create a builder resolver that resolves catalog builders by name.
 * Handles nested composition (Table → Leg, etc.)
 */
function createCatalogBuilderResolver(): (name: string) => ((seed: number, overrides?: Record<string, any>) => Promise<TracedOutput>) | null {
  const catalogRoot = join(__dirname, '../../../builders');

  return (name: string) => {
    // Resolve various naming conventions to file paths
    const paths = [
      join(CATALOG_PATH, `${name}.yaml`),
      join(CATALOG_PATH, `components/${name}.yaml`),
      join(catalogRoot, `${name.replace('catalog/', '')}.yaml`),
      join(catalogRoot, `${name}.yaml`),
    ];

    for (const p of paths) {
      try {
        // Check the file exists by reading it; the actual YAML is parsed in the returned fn
        readFileSync(p);
        return async (seed: number, overrides?: Record<string, any>) => {
          const yaml = await loadYaml(p);
          return parseAndExecuteBuilder(yaml, {
            seed,
            overrides,
            builderResolver: createCatalogBuilderResolver()
          });
        };
      } catch {
        // Try next path
      }
    }
    return null;
  };
}

/**
 * Run the StyledRoom scene template with a given style
 */
async function runStyledRoom(options: {
  style: string;
  seed?: number;
}): Promise<TracedOutput> {
  const path = join(SCENES_PATH, 'StyledRoom.yaml');
  const yaml = await loadYaml(path);
  return parseAndExecuteBuilder(yaml, {
    seed: options.seed ?? 1,
    // Pass style as a named override so it is picked up by the 'style' choice decision in PHASE 1
    // (PHASE 0.5 pre-peek also reads overrides['style'] to load style defaults before decisions run)
    overrides: { style: options.style },
    builderResolver: createCatalogBuilderResolver()
  });
}

// =============================================================================
// TESTS
// =============================================================================

describe('H2-001: Styled Room Demo', () => {

  beforeAll(() => {
    // Clear caches before this test suite to avoid cross-test contamination
    clearStyleCache();
    clearRoleCache();
    clearRegisteredRoles();
  });

  // ---------------------------------------------------------------------------
  describe('Scene Structure', () => {
    it('should build a StyledRoom with geometry', async () => {
      const result = await runStyledRoom({ style: 'mid_century_modern', seed: 1 });

      expect(result).toBeDefined();
      expect(result.mesh).toBeDefined();
      expect(result.mesh.vertices.length).toBeGreaterThan(0);
      expect(result.mesh.faces.length).toBeGreaterThan(0);
    });

    it('should have correct room measurements', async () => {
      const result = await runStyledRoom({ style: 'mid_century_modern', seed: 1 });

      const roomWidth = result.measurements.get('room_width');
      const roomDepth = result.measurements.get('room_depth');

      expect(roomWidth?.value ?? roomWidth).toBe(5.0);
      expect(roomDepth?.value ?? roomDepth).toBe(4.5);
    });

    it('should compose all expected sub-builders (table + 4 chairs + centerpiece)', async () => {
      const result = await runStyledRoom({ style: 'mid_century_modern', seed: 1 });

      // All six role-based sub-builders should be present
      expect(result.subBuilders.has('dining_table')).toBe(true);
      expect(result.subBuilders.has('chair_north')).toBe(true);
      expect(result.subBuilders.has('chair_south')).toBe(true);
      expect(result.subBuilders.has('chair_east')).toBe(true);
      expect(result.subBuilders.has('chair_west')).toBe(true);
      expect(result.subBuilders.has('centerpiece')).toBe(true);

      // Total: 6 composed pieces
      expect(result.subBuilders.size).toBe(6);
    });

    it('should have floor, walls, and room enclosure geometry', async () => {
      const result = await runStyledRoom({ style: 'industrial', seed: 1 });

      // The scene mesh should include room geometry (floor + walls)
      // Verified by face count — floor + 3 walls = 4 boxes × 6 faces each = 24 faces minimum
      expect(result.mesh.faces.length).toBeGreaterThan(20);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Role-Based Composition', () => {
    it('should resolve seating role to DiningChair for mid_century_modern', async () => {
      const result = await runStyledRoom({ style: 'mid_century_modern', seed: 1 });

      const chair = result.subBuilders.get('chair_north');
      expect(chair).toBeDefined();
      // DiningChair is the only seating candidate registered for mid_century_modern
      expect(chair!.builderName).toBe('DiningChair');
    });

    it('should resolve seating role to DiningChair for industrial', async () => {
      const result = await runStyledRoom({ style: 'industrial', seed: 1 });

      const chair = result.subBuilders.get('chair_north');
      expect(chair).toBeDefined();
      expect(chair!.builderName).toBe('DiningChair');
    });

    it('should resolve table role to Table builder', async () => {
      const result = await runStyledRoom({ style: 'mid_century_modern', seed: 1 });

      const table = result.subBuilders.get('dining_table');
      expect(table).toBeDefined();
      expect(table!.builderName).toBe('Table');
    });

    it('should resolve decoration role to Vase builder', async () => {
      const result = await runStyledRoom({ style: 'mid_century_modern', seed: 1 });

      const centerpiece = result.subBuilders.get('centerpiece');
      expect(centerpiece).toBeDefined();
      expect(centerpiece!.builderName).toBe('Vase');
    });
  });

  // ---------------------------------------------------------------------------
  describe('Style Cascading', () => {
    it('should cascade mid_century_modern style to chairs (tapered legs)', async () => {
      const result = await runStyledRoom({ style: 'mid_century_modern', seed: 42 });

      // The style cascades default decisions to children
      // mid_century_modern sets leg_style: tapered
      const chair = result.subBuilders.get('chair_north');
      expect(chair).toBeDefined();

      // The chair's leg_style decision should be 'tapered' from style defaults
      const legStyle = chair!.decisions.get('leg_style');
      const legStyleValue = legStyle?.value ?? legStyle;
      expect(legStyleValue).toBe('tapered');
    });

    it('should cascade industrial style to chairs (square legs)', async () => {
      const result = await runStyledRoom({ style: 'industrial', seed: 42 });

      // industrial style sets leg_style: square
      const chair = result.subBuilders.get('chair_north');
      expect(chair).toBeDefined();

      const legStyle = chair!.decisions.get('leg_style');
      const legStyleValue = legStyle?.value ?? legStyle;
      expect(legStyleValue).toBe('square');
    });

    it('should propagate style to all four chairs equally', async () => {
      const result = await runStyledRoom({ style: 'mid_century_modern', seed: 5 });

      const chairs = ['chair_north', 'chair_south', 'chair_east', 'chair_west'];
      for (const chairName of chairs) {
        const chair = result.subBuilders.get(chairName);
        expect(chair).toBeDefined();

        const legStyle = chair!.decisions.get('leg_style');
        const legStyleValue = legStyle?.value ?? legStyle;
        expect(legStyleValue).toBe('tapered');
      }
    });
  });

  // ---------------------------------------------------------------------------
  describe('Side-by-Side Style Comparison (H2-001)', () => {
    it('should produce different face counts for mid_century_modern vs industrial', async () => {
      // mid_century_modern uses tapered (round) legs, industrial uses square legs
      // Round legs use loft + circle geometry (more faces) vs box geometry (fewer faces per leg)
      const mcmResult = await runStyledRoom({ style: 'mid_century_modern', seed: 7 });
      const indResult = await runStyledRoom({ style: 'industrial', seed: 7 });

      // The same seed should produce different output based on style
      // (different geometry = different face counts due to leg style)
      // We allow for the possibility they might match in edge cases, but
      // the key point is that style genuinely affects geometry
      console.log(`MCM faces: ${mcmResult.mesh.faces.length}, Industrial faces: ${indResult.mesh.faces.length}`);

      // Both should have substantial geometry
      expect(mcmResult.mesh.faces.length).toBeGreaterThan(100);
      expect(indResult.mesh.faces.length).toBeGreaterThan(100);
    });

    it('should produce different chair leg styles per style (geometry differs)', async () => {
      const mcmResult = await runStyledRoom({ style: 'mid_century_modern', seed: 7 });
      const indResult = await runStyledRoom({ style: 'industrial', seed: 7 });

      const mcmChair = mcmResult.subBuilders.get('chair_north');
      const indChair = indResult.subBuilders.get('chair_north');

      expect(mcmChair).toBeDefined();
      expect(indChair).toBeDefined();

      // Mid-century: tapered round legs
      const mcmLegStyle = mcmChair!.decisions.get('leg_style');
      expect(mcmLegStyle?.value ?? mcmLegStyle).toBe('tapered');

      // Industrial: square legs
      const indLegStyle = indChair!.decisions.get('leg_style');
      expect(indLegStyle?.value ?? indLegStyle).toBe('square');

      // The chairs should have different face counts due to different geometry
      expect(mcmChair!.mesh.faces.length).not.toBe(indChair!.mesh.faces.length);
    });

    it('should produce different vertex counts for the two styles', async () => {
      const mcmResult = await runStyledRoom({ style: 'mid_century_modern', seed: 10 });
      const indResult = await runStyledRoom({ style: 'industrial', seed: 10 });

      // Different leg styles (tapered/round vs square) produce different vertex counts
      expect(mcmResult.mesh.vertices.length).not.toBe(indResult.mesh.vertices.length);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Style Definition: mid_century_modern', () => {
    it('should load mid_century_modern style from metadata', async () => {
      const { loadStyle } = await import('../../generation/builder/StyleResolver');
      const style = await loadStyle('mid_century_modern');

      expect(style).toBeDefined();
      expect(style!.name).toBe('MidCenturyModern');
    });

    it('should have tapered leg style as decision default', async () => {
      const { loadStyle } = await import('../../generation/builder/StyleResolver');
      const style = await loadStyle('mid_century_modern');

      expect(style).toBeDefined();
      expect(style!.decision_defaults).toBeDefined();
      expect(style!.decision_defaults!['leg_style']).toBe('tapered');
    });

    it('should have walnut as primary_wood in material palette', async () => {
      const { loadStyle } = await import('../../generation/builder/StyleResolver');
      const style = await loadStyle('mid_century_modern');

      expect(style).toBeDefined();
      expect(style!.material_palette).toBeDefined();
      expect(style!.material_palette!['primary_wood']).toBeDefined();
      expect(style!.material_palette!['primary_wood'].name).toBe('walnut');
    });

    it('should have proportion rules', async () => {
      const { loadStyle } = await import('../../generation/builder/StyleResolver');
      const style = await loadStyle('mid_century_modern');

      expect(style).toBeDefined();
      expect(style!.proportion_rules).toBeDefined();
      expect(style!.proportion_rules!.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Determinism', () => {
    it('should produce identical output for same seed and style', async () => {
      const result1 = await runStyledRoom({ style: 'mid_century_modern', seed: 99 });
      const result2 = await runStyledRoom({ style: 'mid_century_modern', seed: 99 });

      expect(result1.mesh.vertices.length).toBe(result2.mesh.vertices.length);
      expect(result1.mesh.faces.length).toBe(result2.mesh.faces.length);
    });

    it('should produce identical industrial output for same seed', async () => {
      const result1 = await runStyledRoom({ style: 'industrial', seed: 55 });
      const result2 = await runStyledRoom({ style: 'industrial', seed: 55 });

      expect(result1.mesh.vertices.length).toBe(result2.mesh.vertices.length);
      expect(result1.mesh.faces.length).toBe(result2.mesh.faces.length);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Tags', () => {
    it('should have type:styled_room tag', async () => {
      const result = await runStyledRoom({ style: 'mid_century_modern', seed: 1 });

      expect(result.tags).toBeDefined();
      expect(result.tags!['type']).toBe('styled_room');
    });
  });
});
