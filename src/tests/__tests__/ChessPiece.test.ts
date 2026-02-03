/**
 * ChessPiece.test.ts
 *
 * Tests for ChessPiece component
 */

import { describe, it, expect } from '@jest/globals';
import { parseAndExecuteBuilder, parseYamlWithLibrary, YamlBuilderDefinition } from '../../generation/builder/YamlBuilderParser';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TracedOutput } from '../../generation/builder/TracedBuilder';

const COMPONENTS_PATH = join(__dirname, '../../../builders/catalog/components');

/**
 * Load and parse a YAML builder file
 */
async function loadBuilder(name: string): Promise<YamlBuilderDefinition> {
  const path = join(COMPONENTS_PATH, `${name}.yaml`);
  const yamlStr = readFileSync(path, 'utf-8');
  return await parseYamlWithLibrary(yamlStr);
}

/**
 * Run a builder with options
 */
async function runBuilder(name: string, options: { seed?: number; overrides?: Record<string, any> } = {}): Promise<TracedOutput> {
  const yaml = await loadBuilder(name);
  return parseAndExecuteBuilder(yaml, {
    seed: options.seed ?? 1,
    overrides: options.overrides
  });
}

describe('ChessPiece Component', () => {
  it('should assign correct materials to all faces for white piece', async () => {
    const result = await runBuilder('ChessPiece', {
      seed: 1,
      overrides: { piece_color: 'white' }
    });

    // Check that all faces have material slots assigned
    const facesWithMaterials = result.mesh.faces.filter(f => f.materialSlotIndex !== undefined);
    const facesWithoutMaterials = result.mesh.faces.filter(f => f.materialSlotIndex === undefined);
    const facesWithColors = result.mesh.faces.filter(f => f.color !== undefined);
    const facesWithoutColors = result.mesh.faces.filter(f => f.color === undefined);

    console.log(`Total faces: ${result.mesh.faces.length}`);
    console.log(`Faces with materialSlotIndex: ${facesWithMaterials.length}`);
    console.log(`Faces without materialSlotIndex: ${facesWithoutMaterials.length}`);
    console.log(`Faces with color: ${facesWithColors.length}`);
    console.log(`Faces without color: ${facesWithoutColors.length}`);

    // Check material slots
    console.log('Material slots:', result.mesh.materialSlots.map(s => `${s.name}: r=${s.color.r.toFixed(3)}`));

    // Check which material slots are assigned to faces
    const slotCounts: Record<string, number> = {};
    for (const face of result.mesh.faces) {
      if (face.materialSlotIndex !== undefined) {
        const slotName = result.mesh.materialSlots[face.materialSlotIndex]?.name || 'unknown';
        slotCounts[slotName] = (slotCounts[slotName] || 0) + 1;
      } else {
        slotCounts['NO_SLOT'] = (slotCounts['NO_SLOT'] || 0) + 1;
      }
    }
    console.log('Material slot assignment counts:', slotCounts);

    // Check unique face colors (direct color, not from material slot)
    const colorSet = new Set<string>();
    for (const face of result.mesh.faces) {
      if (face.color) {
        const key = `${face.color.r.toFixed(2)},${face.color.g.toFixed(2)},${face.color.b.toFixed(2)}`;
        colorSet.add(key);
      }
    }
    console.log('Unique face.color values:', [...colorSet]);

    // All faces should have materials assigned
    expect(facesWithoutMaterials.length).toBe(0);
  });

  it('should assign correct materials to all faces for black piece', async () => {
    const result = await runBuilder('ChessPiece', {
      seed: 1,
      overrides: { piece_color: 'black' }
    });

    // Check that all faces have material slots assigned
    const facesWithMaterials = result.mesh.faces.filter(f => f.materialSlotIndex !== undefined);
    const facesWithoutMaterials = result.mesh.faces.filter(f => f.materialSlotIndex === undefined);

    console.log(`Total faces: ${result.mesh.faces.length}`);
    console.log(`Faces with materials: ${facesWithMaterials.length}`);
    console.log(`Faces without materials: ${facesWithoutMaterials.length}`);

    // All faces should have materials assigned
    expect(facesWithoutMaterials.length).toBe(0);
  });
});
