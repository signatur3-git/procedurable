/**
 * A2-003: Quality Gate in Builder Execution Tests
 *
 * Verifies that quality gates run automatically when a builder has a quality: section
 */

import { parseAndExecuteBuilder, YamlBuilderDefinition } from '../../generation/builder/YamlBuilderParser';

describe('Automatic Quality Gate Execution (A2-003)', () => {
  it('should attach qualityGateResult when quality: section is present', async () => {
    const yaml: YamlBuilderDefinition = {
      version: '1.0',
      name: 'TestWithQuality',
      description: 'Test builder with quality section',
      quality: {
        target_tier: 1,
        current_tier: 1
      },
      measurements: {
        size: { value: 0.5 }
      },
      geometry: [
        { type: 'vertex', name: 'v1', x: 0, y: 0, z: 0 },
        { type: 'vertex', name: 'v2', x: '${size}', y: 0, z: 0 },
        { type: 'vertex', name: 'v3', x: '${size}', y: '${size}', z: 0 },
        { type: 'vertex', name: 'v4', x: 0, y: '${size}', z: 0 },
        { type: 'vertex', name: 'v5', x: 0, y: 0, z: '${size}' },
        { type: 'vertex', name: 'v6', x: '${size}', y: 0, z: '${size}' },
        { type: 'vertex', name: 'v7', x: '${size}', y: '${size}', z: '${size}' },
        { type: 'vertex', name: 'v8', x: 0, y: '${size}', z: '${size}' },
        // Box faces
        { type: 'face', name: 'bottom', vertices: ['v1', 'v2', 'v3', 'v4'], group: 'base' },
        { type: 'face', name: 'top', vertices: ['v5', 'v8', 'v7', 'v6'], group: 'base' },
        { type: 'face', name: 'front', vertices: ['v1', 'v5', 'v6', 'v2'], group: 'sides' },
        { type: 'face', name: 'back', vertices: ['v3', 'v7', 'v8', 'v4'], group: 'sides' },
        { type: 'face', name: 'left', vertices: ['v1', 'v4', 'v8', 'v5'], group: 'sides' },
        { type: 'face', name: 'right', vertices: ['v2', 'v6', 'v7', 'v3'], group: 'sides' }
      ] as any
    };

    const output = await parseAndExecuteBuilder(yaml, { seed: 1 });

    // A2-003: qualityGateResult should be attached
    expect(output.qualityGateResult).toBeDefined();
    expect(output.qualityGateResult.target_tier).toBe(1);
    expect(output.qualityGateResult.achieved_tier).toBeGreaterThanOrEqual(0);
    expect(output.qualityGateResult.summary).toBeDefined();
    expect(output.qualityGateResult.gates).toBeInstanceOf(Array);
  });

  it('should NOT attach qualityGateResult when quality: section is absent', async () => {
    const yaml: YamlBuilderDefinition = {
      version: '1.0',
      name: 'TestWithoutQuality',
      description: 'Test builder without quality section',
      measurements: {
        size: { value: 0.5 }
      },
      geometry: [
        { type: 'vertex', name: 'v1', x: 0, y: 0, z: 0 },
        { type: 'vertex', name: 'v2', x: 0.5, y: 0, z: 0 },
        { type: 'vertex', name: 'v3', x: 0.5, y: 0.5, z: 0 },
        { type: 'face', name: 'f1', vertices: ['v1', 'v2', 'v3'] }
      ] as any
    };

    const output = await parseAndExecuteBuilder(yaml, { seed: 1 });

    // qualityGateResult should NOT be attached
    expect(output.qualityGateResult).toBeUndefined();
  });

  it('should add gate failures as warnings in validation.issues', async () => {
    // Build a minimal mesh that will fail tier 1 gates
    const yaml: YamlBuilderDefinition = {
      version: '1.0',
      name: 'FailingQualityTest',
      quality: {
        target_tier: 1,
        current_tier: 0
      },
      measurements: {},
      geometry: [
        // Just one triangle - will fail tier 1 due to insufficient geometry
        { type: 'vertex', name: 'v1', x: 0, y: 0, z: 0 },
        { type: 'vertex', name: 'v2', x: 1, y: 0, z: 0 },
        { type: 'vertex', name: 'v3', x: 0.5, y: 1, z: 0 },
        { type: 'face', name: 'f1', vertices: ['v1', 'v2', 'v3'], group: 'base' }
      ] as any
    };

    const output = await parseAndExecuteBuilder(yaml, { seed: 1 });

    // Should have quality gate result with failures
    expect(output.qualityGateResult).toBeDefined();
    expect(output.qualityGateResult.suggestions.length).toBeGreaterThan(0);

    // Gate failures should appear as warnings in validation.issues
    const qualityWarnings = output.validation.issues.filter(
      (i: any) => i.severity === 'warning' && i.message.includes('Quality gate')
    );
    expect(qualityWarnings.length).toBeGreaterThan(0);
  });

  it('quality gate target_tier should be used from YAML', async () => {
    const yaml: YamlBuilderDefinition = {
      version: '1.0',
      name: 'Tier2Target',
      quality: {
        target_tier: 2,  // Target tier 2
        current_tier: 0
      },
      measurements: {},
      geometry: [
        { type: 'vertex', name: 'v1', x: 0, y: 0, z: 0 },
        { type: 'vertex', name: 'v2', x: 1, y: 0, z: 0 },
        { type: 'vertex', name: 'v3', x: 0.5, y: 1, z: 0 },
        { type: 'face', name: 'f1', vertices: ['v1', 'v2', 'v3'], group: 'base' }
      ] as any
    };

    const output = await parseAndExecuteBuilder(yaml, { seed: 1 });

    expect(output.qualityGateResult).toBeDefined();
    expect(output.qualityGateResult.target_tier).toBe(2);
  });
});
