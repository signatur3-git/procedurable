/**
 * HybridCreature Tests (H1-001: Rigged Creature Demo)
 *
 * End-to-end tests for the rigged creature demo.
 * Verifies skeleton composition, weights, and glTF export.
 */

import { describe, it, expect } from '@jest/globals';
import { parseAndExecuteBuilder, parseYamlWithLibrary, YamlBuilderDefinition } from '../../generation/builder/YamlBuilderParser';
import { exportRiggedGLB } from '../../export/GLTFExporter';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TracedOutput } from '../../generation/builder/TracedBuilder';

const BUILDERS_PATH = join(__dirname, '../../../builders/catalog');
const COMPONENTS_PATH = join(BUILDERS_PATH, 'components');

/**
 * Load and parse a YAML builder file
 */
async function loadBuilder(name: string, isComponent = false): Promise<YamlBuilderDefinition> {
  const path = isComponent
    ? join(COMPONENTS_PATH, `${name}.yaml`)
    : join(BUILDERS_PATH, `${name}.yaml`);
  const yamlStr = readFileSync(path, 'utf-8');
  return await parseYamlWithLibrary(yamlStr);
}

/**
 * Create a builder resolver that can load YAML builders from the catalog
 */
function createBuilderResolver(): (name: string) => ((seed: number, overrides?: Record<string, any>) => Promise<TracedOutput>) | null {
  return (name: string) => {
    // Try to load from components first, then catalog
    const paths = [
      join(COMPONENTS_PATH, `${name}.yaml`),
      join(BUILDERS_PATH, `${name}.yaml`)
    ];

    for (const path of paths) {
      try {
        const yamlStr = readFileSync(path, 'utf-8');
        return async (seed: number, overrides?: Record<string, any>) => {
          const yaml = await parseYamlWithLibrary(yamlStr);
          return parseAndExecuteBuilder(yaml, {
            seed,
            overrides,
            builderResolver: createBuilderResolver() // Recursive for nested compositions
          });
        };
      } catch {
        // File not found, try next path
      }
    }
    return null;
  };
}

describe('H1-001: Rigged Creature Demo', () => {
  describe('HorseBody component', () => {
    it('should build with skeleton', async () => {
      const yaml = await loadBuilder('HorseBody', true);
      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(output.mesh.vertices.length).toBeGreaterThan(0);
      expect(output.skeleton).toBeDefined();
      expect(output.skeleton!.joints.length).toBeGreaterThanOrEqual(10);

      // Check for key joints
      const jointNames = output.skeleton!.joints.map(j => j.name);
      expect(jointNames).toContain('spine_root');
      expect(jointNames).toContain('spine_chest');
      expect(jointNames).toContain('head');
      expect(jointNames).toContain('shoulder_L');
      expect(jointNames).toContain('shoulder_R');
      expect(jointNames).toContain('tail_base');
    });

    it('should have vertex weights', async () => {
      const yaml = await loadBuilder('HorseBody', true);
      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(output.vertexWeights).toBeDefined();
      expect(output.vertexWeights!.stats.weightedVertices).toBeGreaterThan(0);
    });

    it('should have attachment ports', async () => {
      const yaml = await loadBuilder('HorseBody', true);
      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(output.ports).toBeDefined();
      expect(output.ports!.size).toBeGreaterThanOrEqual(3);

      const portNames = Array.from(output.ports!.keys());
      expect(portNames).toContain('wing_attach_L');
      expect(portNames).toContain('wing_attach_R');
      expect(portNames).toContain('tail_attach');
    });

    it('should export to rigged glTF', async () => {
      const yaml = await loadBuilder('HorseBody', true);
      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });

      const result = exportRiggedGLB(output, 'HorseBody');
      expect(result.glb).toBeDefined();
      expect(result.stats.jointCount).toBeGreaterThanOrEqual(10);
      expect(result.stats.skinnedVertexCount).toBeGreaterThan(0);
    });
  });

  describe('EagleWing component', () => {
    it('should build with skeleton', async () => {
      const yaml = await loadBuilder('EagleWing', true);
      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(output.mesh.vertices.length).toBeGreaterThan(0);
      expect(output.skeleton).toBeDefined();

      const jointNames = output.skeleton!.joints.map(j => j.name);
      expect(jointNames).toContain('wing_root');
      expect(jointNames).toContain('elbow');
      expect(jointNames).toContain('wrist');
      expect(jointNames).toContain('wing_tip');
    });

    it('should have body_attach port', async () => {
      const yaml = await loadBuilder('EagleWing', true);
      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(output.ports).toBeDefined();
      const portNames = Array.from(output.ports!.keys());
      expect(portNames).toContain('body_attach');
    });
  });

  describe('ScorpionTail component', () => {
    it('should build with segmented skeleton', async () => {
      const yaml = await loadBuilder('ScorpionTail', true);
      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });

      expect(output.mesh.vertices.length).toBeGreaterThan(0);
      expect(output.skeleton).toBeDefined();

      const jointNames = output.skeleton!.joints.map(j => j.name);
      expect(jointNames).toContain('tail_root');
      expect(jointNames).toContain('tail_seg1');
      expect(jointNames).toContain('tail_seg2');
      expect(jointNames).toContain('tail_seg3');
      expect(jointNames).toContain('tail_seg4');
      expect(jointNames).toContain('stinger');
    });

    it('should have hinge constraints on segments', async () => {
      const yaml = await loadBuilder('ScorpionTail', true);
      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });

      const seg1 = output.skeleton!.joints.find(j => j.name === 'tail_seg1');
      expect(seg1).toBeDefined();
      expect(seg1!.constraints).toBeDefined();
      expect(seg1!.constraints!.type).toBe('hinge');
    });
  });

  describe('Rigged glTF Export', () => {
    it('should export HorseBody with valid glTF structure', async () => {
      const yaml = await loadBuilder('HorseBody', true);
      const output = await parseAndExecuteBuilder(yaml, { seed: 42 });
      const result = exportRiggedGLB(output, 'horse_test');

      // Parse GLB to verify structure
      const view = new DataView(result.glb.buffer);
      const magic = view.getUint32(0, true);
      expect(magic).toBe(0x46546C67); // "glTF"

      // Extract JSON
      const jsonLength = view.getUint32(12, true);
      const jsonBytes = result.glb.slice(20, 20 + jsonLength);
      const json = JSON.parse(new TextDecoder().decode(jsonBytes));

      // Verify skin
      expect(json.skins).toBeDefined();
      expect(json.skins.length).toBe(1);
      expect(json.skins[0].joints.length).toBeGreaterThanOrEqual(10);

      // Verify mesh has skinning attributes
      const primitive = json.meshes[0].primitives[0];
      expect(primitive.attributes.JOINTS_0).toBeDefined();
      expect(primitive.attributes.WEIGHTS_0).toBeDefined();
    });
  });

  describe('HybridCreature composition', () => {
    it('should load HybridCreature.yaml without errors', async () => {
      const yaml = await loadBuilder('HybridCreature', false);
      expect(yaml.name).toBe('HybridCreature');
      expect(yaml.compose).toBeDefined();
      expect(Object.keys(yaml.compose!).length).toBe(4); // body, wing_L, wing_R, tail
    });

    it('should build composed creature with merged geometry', async () => {
      const yaml = await loadBuilder('HybridCreature', false);
      const output = await parseAndExecuteBuilder(yaml, {
        seed: 42,
        builderResolver: createBuilderResolver()
      });

      // Should have vertices from all components
      expect(output.mesh.vertices.length).toBeGreaterThan(100);

      // Should have faces
      expect(output.mesh.faces.length).toBeGreaterThan(20);
    });

    it('should have wings on opposite sides of the body', async () => {
      const yaml = await loadBuilder('HybridCreature', false);
      const output = await parseAndExecuteBuilder(yaml, {
        seed: 42,
        builderResolver: createBuilderResolver()
      });

      // Get all vertices and find the bounding box
      const vertices = output.mesh.vertices;
      let minX = Infinity, maxX = -Infinity;

      for (const v of vertices) {
        minX = Math.min(minX, v.position.x);
        maxX = Math.max(maxX, v.position.x);
      }

      // The creature should have significant width (wings extend on both sides)
      const width = maxX - minX;
      expect(width).toBeGreaterThan(0.3); // Wings should extend the width significantly

      // Creature should be roughly symmetric (center near 0)
      const center = (maxX + minX) / 2;
      expect(Math.abs(center)).toBeLessThan(0.1); // Center should be near 0
    });

    it('should have merged skeleton with all component joints', async () => {
      const yaml = await loadBuilder('HybridCreature', false);
      const output = await parseAndExecuteBuilder(yaml, {
        seed: 42,
        builderResolver: createBuilderResolver()
      });

      expect(output.skeleton).toBeDefined();
      const jointNames = output.skeleton!.joints.map(j => j.name);

      // Should have body joints
      expect(jointNames).toContain('spine_root');
      expect(jointNames).toContain('head');

      // Should have prefixed wing joints
      expect(jointNames.some(n => n.includes('wing_L'))).toBe(true);
      expect(jointNames.some(n => n.includes('wing_R'))).toBe(true);

      // Should have prefixed tail joints
      expect(jointNames.some(n => n.includes('tail'))).toBe(true);
    });

    it('should export composed creature to rigged glTF', async () => {
      const yaml = await loadBuilder('HybridCreature', false);
      const output = await parseAndExecuteBuilder(yaml, {
        seed: 42,
        builderResolver: createBuilderResolver()
      });

      // Should be able to export the composed creature
      const result = exportRiggedGLB(output, 'HybridCreature');
      expect(result.glb).toBeDefined();
      expect(result.stats.jointCount).toBeGreaterThanOrEqual(15);
    });
  });
});
