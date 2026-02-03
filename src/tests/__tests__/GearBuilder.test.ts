/**
 * Gear Builder Integration Test
 * Verifies the Gear builder achieves Tier 2 quality
 */

import { parseAndExecuteBuilder, parseYamlWithLibrary, YamlBuilderDefinition } from '../../generation/builder/YamlBuilderParser';
import * as fs from 'fs';
import * as path from 'path';

describe('Gear Builder (B1-004)', () => {
  let gearDef: YamlBuilderDefinition;

  beforeAll(async () => {
    const yamlPath = path.join(__dirname, '../../../builders/test-fixtures/Gear.yaml');
    const yaml = fs.readFileSync(yamlPath, 'utf-8');
    gearDef = await parseYamlWithLibrary(yaml);
  });

  it('should load Gear.yaml without errors', () => {
    expect(gearDef.name).toBe('Gear');
    expect(gearDef.quality?.target_tier).toBe(2);
  });

  it('should only have beveled and rounded styles (no simple)', () => {
    const gearStyle = gearDef.decisions?.gear_style as any;
    expect(gearStyle.options).toEqual(['beveled', 'rounded']);
    expect(gearStyle.options).not.toContain('simple');
  });

  it('should achieve Tier 2 quality with seed 1', async () => {
    const output = await parseAndExecuteBuilder(gearDef, { seed: 1 });

    expect(output.qualityGateResult).toBeDefined();
    expect(output.qualityGateResult.achieved_tier).toBe(2);
    expect(output.qualityGateResult.target_tier).toBe(2);
  });

  it('should achieve Tier 2 quality with seed 42', async () => {
    const output = await parseAndExecuteBuilder(gearDef, { seed: 42 });

    expect(output.qualityGateResult).toBeDefined();
    expect(output.qualityGateResult.achieved_tier).toBe(2);
  });

  it('should achieve Tier 2 quality with seed 999', async () => {
    const output = await parseAndExecuteBuilder(gearDef, { seed: 999 });

    expect(output.qualityGateResult).toBeDefined();
    expect(output.qualityGateResult.achieved_tier).toBe(2);
  });

  it('should have 3 distinct geometry groups (body, hub_ring, teeth)', async () => {
    const output = await parseAndExecuteBuilder(gearDef, { seed: 42 });

    // Check trace entries for mesh: prefixed items
    // gear_body uses 2D boolean subtract for the center hole
    // hub_ring is a raised collar around the hole, also using 2D boolean
    const meshTraces = Array.from(output.traces.keys()).filter(k => k.startsWith('mesh:'));
    expect(meshTraces.length).toBeGreaterThanOrEqual(3);
    expect(meshTraces).toContain('mesh:gear_body');
    expect(meshTraces).toContain('mesh:hub_ring');
    expect(meshTraces).toContain('mesh:tooth');
  });

  it('should have multiple materials (gear_metal and gear_brass)', async () => {
    const output = await parseAndExecuteBuilder(gearDef, { seed: 42 });

    // Check that faces have different colors
    // gear_body and teeth use gear_metal, hub_ring uses gear_brass
    const colorSet = new Set<string>();
    for (const face of output.mesh.faces) {
      if (face.color) {
        colorSet.add(`${face.color.r.toFixed(2)},${face.color.g.toFixed(2)},${face.color.b.toFixed(2)}`);
      }
    }
    expect(colorSet.size).toBeGreaterThanOrEqual(2);
  });

  it('should have meaningful decisions that affect geometry', async () => {
    // Run with different seeds to check for variance
    const output1 = await parseAndExecuteBuilder(gearDef, { seed: 1 });
    const output2 = await parseAndExecuteBuilder(gearDef, { seed: 100 });

    // Verify decisions are recorded
    expect(output1.decisions.get('tooth_count')).toBeDefined();
    expect(output1.decisions.get('gear_style')).toBeDefined();

    // Verify tooth_count decision produces different values with different seeds
    const toothCount1 = output1.decisions.get('tooth_count')?.value as number;
    const toothCount2 = output2.decisions.get('tooth_count')?.value as number;

    // Both should be valid tooth counts (8-32 range)
    expect(toothCount1).toBeGreaterThanOrEqual(8);
    expect(toothCount1).toBeLessThanOrEqual(32);
    expect(toothCount2).toBeGreaterThanOrEqual(8);
    expect(toothCount2).toBeLessThanOrEqual(32);

    // Different tooth counts should produce different face counts
    if (toothCount1 !== toothCount2) {
      expect(output1.mesh.faces.length).not.toBe(output2.mesh.faces.length);
    }
  });
});
