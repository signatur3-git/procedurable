/**
 * MaterialSlots (C3-001) - Unit tests for material slot system
 */

import { describe, it, expect } from '@jest/globals';
import { Mesh } from '../../platform/geometry/Mesh';
import { Face } from '../../platform/geometry/Face';
import { Vertex } from '../../platform/geometry/Vertex';
import { Vec3 } from '../../platform/math/Vec3';
import type { MaterialSlot } from '../../platform/materials/MaterialLibrary';
import { resolveMaterialSlots, resolveGeometryMaterial, resolveGeometryMaterialSlotName } from '../../generation/builder/MaterialResolver';
import { parseAndExecuteBuilder } from '../../generation/builder/YamlBuilderParser';

// ============================================================================
// MaterialSlot type and Mesh.materialSlots
// ============================================================================

describe('MaterialSlot type', () => {
  it('should store name, color, roughness, metalness', () => {
    const slot: MaterialSlot = {
      name: 'wood',
      color: { r: 0.5, g: 0.3, b: 0.1 },
      roughness: 0.8,
      metalness: 0.0
    };
    expect(slot.name).toBe('wood');
    expect(slot.roughness).toBe(0.8);
    expect(slot.metalness).toBe(0.0);
  });
});

describe('Mesh.materialSlots', () => {
  it('should start with empty material slots', () => {
    const mesh = new Mesh();
    expect(mesh.materialSlots).toEqual([]);
  });

  it('should add material slots and return index', () => {
    const mesh = new Mesh();
    const idx = mesh.addMaterialSlot({
      name: 'metal',
      color: { r: 0.6, g: 0.6, b: 0.6 },
      roughness: 0.2,
      metalness: 0.9
    });
    expect(idx).toBe(0);
    expect(mesh.materialSlots.length).toBe(1);
    expect(mesh.materialSlots[0].name).toBe('metal');
  });

  it('should deduplicate slots by name', () => {
    const mesh = new Mesh();
    const idx1 = mesh.addMaterialSlot({ name: 'wood', color: { r: 0.5, g: 0.3, b: 0.1 }, roughness: 0.8, metalness: 0 });
    const idx2 = mesh.addMaterialSlot({ name: 'wood', color: { r: 0.5, g: 0.3, b: 0.1 }, roughness: 0.8, metalness: 0 });
    expect(idx1).toBe(0);
    expect(idx2).toBe(0);
    expect(mesh.materialSlots.length).toBe(1);
  });

  it('should get slot index by name', () => {
    const mesh = new Mesh();
    mesh.addMaterialSlot({ name: 'a', color: { r: 1, g: 0, b: 0 }, roughness: 0.5, metalness: 0 });
    mesh.addMaterialSlot({ name: 'b', color: { r: 0, g: 1, b: 0 }, roughness: 0.5, metalness: 0 });
    expect(mesh.getMaterialSlotIndex('a')).toBe(0);
    expect(mesh.getMaterialSlotIndex('b')).toBe(1);
    expect(mesh.getMaterialSlotIndex('c')).toBe(-1);
  });

  it('should clone materialSlots', () => {
    const mesh = new Mesh();
    mesh.addMaterialSlot({ name: 'test', color: { r: 1, g: 0, b: 0 }, roughness: 0.5, metalness: 0.1 });
    const cloned = mesh.clone();
    expect(cloned.materialSlots.length).toBe(1);
    expect(cloned.materialSlots[0].name).toBe('test');
    // Ensure deep clone
    cloned.materialSlots[0].color.r = 0;
    expect(mesh.materialSlots[0].color.r).toBe(1);
  });

  it('should merge materialSlots and remap face indices', () => {
    const v = (x: number) => new Vertex(new Vec3(x, 0, 0));

    const mesh1 = new Mesh([v(0), v(1), v(2)], [new Face([0, 1, 2], undefined, 0)]);
    mesh1.addMaterialSlot({ name: 'wood', color: { r: 0.5, g: 0.3, b: 0.1 }, roughness: 0.8, metalness: 0 });

    const mesh2 = new Mesh([v(3), v(4), v(5)], [new Face([0, 1, 2], undefined, 0)]);
    mesh2.addMaterialSlot({ name: 'metal', color: { r: 0.6, g: 0.6, b: 0.6 }, roughness: 0.2, metalness: 0.9 });

    mesh1.merge(mesh2);
    expect(mesh1.materialSlots.length).toBe(2);
    expect(mesh1.materialSlots[1].name).toBe('metal');
    // Merged face should have remapped slot index
    expect(mesh1.faces[1].materialSlotIndex).toBe(1);
  });
});

// ============================================================================
// Face.materialSlotIndex
// ============================================================================

describe('Face.materialSlotIndex', () => {
  it('should default to undefined', () => {
    const face = new Face([0, 1, 2]);
    expect(face.materialSlotIndex).toBeUndefined();
  });

  it('should store materialSlotIndex', () => {
    const face = new Face([0, 1, 2], undefined, 2);
    expect(face.materialSlotIndex).toBe(2);
  });

  it('should preserve materialSlotIndex through triangulate', () => {
    const quad = new Face([0, 1, 2, 3], { r: 1, g: 0, b: 0 }, 1);
    const tris = quad.triangulate();
    expect(tris.length).toBe(2);
    expect(tris[0].materialSlotIndex).toBe(1);
    expect(tris[1].materialSlotIndex).toBe(1);
  });

  it('should preserve materialSlotIndex through clone', () => {
    const face = new Face([0, 1, 2], { r: 1, g: 0, b: 0 }, 3);
    const cloned = face.clone();
    expect(cloned.materialSlotIndex).toBe(3);
  });
});

// ============================================================================
// MaterialResolver
// ============================================================================

describe('resolveMaterialSlots', () => {
  it('should resolve YAML materials to MaterialSlot objects', () => {
    const yamlMaterials = {
      wood: { color: 'wood_oak' as any, roughness: 0.8, metalness: 0.0 },
      metal: { color: '#999999' as any, roughness: 0.2, metalness: 0.9 }
    };
    const slots = resolveMaterialSlots(yamlMaterials, new Map());
    expect(slots.size).toBe(2);
    const wood = slots.get('wood')!;
    expect(wood.name).toBe('wood');
    expect(wood.roughness).toBe(0.8);
    expect(wood.metalness).toBe(0.0);
    const metal = slots.get('metal')!;
    expect(metal.roughness).toBe(0.2);
    expect(metal.metalness).toBe(0.9);
  });

  it('should default roughness=0.5, metalness=0.0', () => {
    const yamlMaterials = { simple: { color: 'red' as any } };
    const slots = resolveMaterialSlots(yamlMaterials, new Map());
    const simple = slots.get('simple')!;
    expect(simple.roughness).toBe(0.5);
    expect(simple.metalness).toBe(0.0);
  });

  it('should return empty map for undefined materials', () => {
    const slots = resolveMaterialSlots(undefined, new Map());
    expect(slots.size).toBe(0);
  });
});

describe('resolveGeometryMaterialSlotName', () => {
  it('should extract slot name from $ reference', () => {
    expect(resolveGeometryMaterialSlotName('$wood')).toBe('wood');
    expect(resolveGeometryMaterialSlotName('$primary_color')).toBe('primary_color');
  });

  it('should return undefined for non-$ references', () => {
    expect(resolveGeometryMaterialSlotName('wood_oak')).toBeUndefined();
    expect(resolveGeometryMaterialSlotName('#ff0000')).toBeUndefined();
    expect(resolveGeometryMaterialSlotName(undefined)).toBeUndefined();
    expect(resolveGeometryMaterialSlotName({ r: 1, g: 0, b: 0 })).toBeUndefined();
  });
});

describe('resolveGeometryMaterial', () => {
  it('should resolve both color and slot index for $ references', () => {
    const materials = new Map([['wood', { r: 0.5, g: 0.3, b: 0.1 }]]);
    const materialSlots = new Map();
    const mesh = new Mesh();
    mesh.addMaterialSlot({ name: 'wood', color: { r: 0.5, g: 0.3, b: 0.1 }, roughness: 0.8, metalness: 0 });

    const result = resolveGeometryMaterial('$wood', materials, materialSlots, mesh);
    expect(result.color).toEqual({ r: 0.5, g: 0.3, b: 0.1 });
    expect(result.materialSlotIndex).toBe(0);
  });

  it('should resolve color only for non-$ references (backward compat)', () => {
    const materials = new Map();
    const materialSlots = new Map();
    const mesh = new Mesh();

    const result = resolveGeometryMaterial('#ff0000', materials, materialSlots, mesh);
    expect(result.color).toBeDefined();
    expect(result.materialSlotIndex).toBeUndefined();
  });

  it('should return undefined for no color def', () => {
    const result = resolveGeometryMaterial(undefined, new Map(), new Map(), new Mesh());
    expect(result.color).toBeUndefined();
    expect(result.materialSlotIndex).toBeUndefined();
  });
});

// ============================================================================
// YAML Builder Integration
// ============================================================================

describe('YAML builder material slots integration', () => {
  it('should register material slots on mesh and assign to faces via $ref', async () => {
    const yaml = {
      version: '1',
      name: 'MaterialSlotTest',
      materials: {
        wood: { color: 'wood_oak', roughness: 0.8, metalness: 0.0 },
        metal: { color: 'metal_steel', roughness: 0.2, metalness: 0.9 }
      },
      geometry: [
        { box: { name: 'wooden_box', center: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '$wood' } },
        { box: { name: 'metal_box', center: { x: 2, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '$metal' } }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);
    const mesh = result.mesh;

    // Should have 2 material slots
    expect(mesh.materialSlots.length).toBe(2);
    expect(mesh.materialSlots[0].name).toBe('wood');
    expect(mesh.materialSlots[0].roughness).toBe(0.8);
    expect(mesh.materialSlots[1].name).toBe('metal');
    expect(mesh.materialSlots[1].metalness).toBe(0.9);

    // First 6 faces (wooden box) should have slot index 0
    for (let i = 0; i < 6; i++) {
      expect(mesh.faces[i].materialSlotIndex).toBe(0);
    }
    // Next 6 faces (metal box) should have slot index 1
    for (let i = 6; i < 12; i++) {
      expect(mesh.faces[i].materialSlotIndex).toBe(1);
    }
  });

  it('should work without materials section (backward compat)', async () => {
    const yaml = {
      version: '1',
      name: 'NoMaterialsTest',
      geometry: [
        { box: { name: 'plain_box', center: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } } }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);
    expect(result.mesh.materialSlots.length).toBe(0);
    expect(result.mesh.faces[0].materialSlotIndex).toBeUndefined();
  });

  it('should still support inline colors without material slots', async () => {
    const yaml = {
      version: '1',
      name: 'InlineColorTest',
      geometry: [
        { box: { name: 'red_box', center: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#ff0000' } }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);
    expect(result.mesh.materialSlots.length).toBe(0);
    // Faces should have color but no slot index
    expect(result.mesh.faces[0].color).toBeDefined();
    expect(result.mesh.faces[0].materialSlotIndex).toBeUndefined();
  });
});

// ============================================================================
// C3-002: Dashboard Material Rendering - Mesh Serialization
// ============================================================================

describe('Mesh serialization for dashboard rendering', () => {
  /**
   * Helper that simulates what builder.mesh command does:
   * Triangulates mesh and extracts colors from material slots or face colors.
   */
  function serializeMeshColors(mesh: Mesh): { colors: number[], hasColors: boolean } {
    const triangulated = mesh.triangulate();
    const colors: number[] = [];
    let hasColors = false;
    const defaultColor = { r: 0.545, g: 0.353, b: 0.169 };

    const resolveFaceColor = (face: Face) => {
      // Priority 1: Material slot
      if (face.materialSlotIndex !== undefined && face.materialSlotIndex >= 0) {
        const slot = triangulated.materialSlots[face.materialSlotIndex];
        if (slot) return { color: slot.color, hasColor: true };
      }
      // Priority 2: Vertex colors (legacy)
      if (face.color) return { color: face.color, hasColor: true };
      // Priority 3: Default
      return { color: defaultColor, hasColor: false };
    };

    for (const face of triangulated.faces) {
      const { color, hasColor } = resolveFaceColor(face);
      if (hasColor) hasColors = true;
      // 3 vertices per triangle
      for (let i = 0; i < 3; i++) {
        colors.push(color.r, color.g, color.b);
      }
    }

    return { colors, hasColors };
  }

  it('should use material slot colors when available', () => {
    const v = (x: number, y: number, z: number) => new Vertex(new Vec3(x, y, z));
    const mesh = new Mesh(
      [v(0, 0, 0), v(1, 0, 0), v(0.5, 1, 0)],
      [new Face([0, 1, 2], undefined, 0)]  // materialSlotIndex = 0
    );
    mesh.addMaterialSlot({
      name: 'red_material',
      color: { r: 1.0, g: 0.0, b: 0.0 },
      roughness: 0.5,
      metalness: 0.0
    });

    const { colors, hasColors } = serializeMeshColors(mesh);

    expect(hasColors).toBe(true);
    // 3 vertices × 3 color components = 9 values
    expect(colors.length).toBe(9);
    // All should be red (from material slot)
    expect(colors[0]).toBe(1.0);  // r
    expect(colors[1]).toBe(0.0);  // g
    expect(colors[2]).toBe(0.0);  // b
  });

  it('should fall back to face color when no material slot', () => {
    const v = (x: number, y: number, z: number) => new Vertex(new Vec3(x, y, z));
    const mesh = new Mesh(
      [v(0, 0, 0), v(1, 0, 0), v(0.5, 1, 0)],
      [new Face([0, 1, 2], { r: 0.0, g: 1.0, b: 0.0 })]  // Green face color, no slot
    );

    const { colors, hasColors } = serializeMeshColors(mesh);

    expect(hasColors).toBe(true);
    expect(colors[0]).toBe(0.0);  // r
    expect(colors[1]).toBe(1.0);  // g
    expect(colors[2]).toBe(0.0);  // b
  });

  it('should use default color when neither material slot nor face color', () => {
    const v = (x: number, y: number, z: number) => new Vertex(new Vec3(x, y, z));
    const mesh = new Mesh(
      [v(0, 0, 0), v(1, 0, 0), v(0.5, 1, 0)],
      [new Face([0, 1, 2])]  // No color, no slot
    );

    const { colors, hasColors } = serializeMeshColors(mesh);

    expect(hasColors).toBe(false);
    // Should use default wood brown color
    expect(colors[0]).toBeCloseTo(0.545, 2);  // r
    expect(colors[1]).toBeCloseTo(0.353, 2);  // g
    expect(colors[2]).toBeCloseTo(0.169, 2);  // b
  });

  it('should prioritize material slot over face color', () => {
    const v = (x: number, y: number, z: number) => new Vertex(new Vec3(x, y, z));
    // Face has BOTH a face color and a material slot index - slot should win
    const mesh = new Mesh(
      [v(0, 0, 0), v(1, 0, 0), v(0.5, 1, 0)],
      [new Face([0, 1, 2], { r: 0.0, g: 1.0, b: 0.0 }, 0)]  // Green face color BUT slot 0
    );
    mesh.addMaterialSlot({
      name: 'blue_material',
      color: { r: 0.0, g: 0.0, b: 1.0 },  // Blue from slot
      roughness: 0.5,
      metalness: 0.0
    });

    const { colors, hasColors } = serializeMeshColors(mesh);

    expect(hasColors).toBe(true);
    // Should use blue from material slot, not green from face color
    expect(colors[0]).toBe(0.0);  // r
    expect(colors[1]).toBe(0.0);  // g
    expect(colors[2]).toBe(1.0);  // b
  });

  it('should handle mixed faces with and without material slots', () => {
    const v = (x: number, y: number, z: number) => new Vertex(new Vec3(x, y, z));
    const mesh = new Mesh(
      [v(0, 0, 0), v(1, 0, 0), v(0.5, 1, 0), v(2, 0, 0), v(3, 0, 0), v(2.5, 1, 0)],
      [
        new Face([0, 1, 2], undefined, 0),  // Red from slot
        new Face([3, 4, 5], { r: 0.0, g: 1.0, b: 0.0 })  // Green from face color
      ]
    );
    mesh.addMaterialSlot({
      name: 'red',
      color: { r: 1.0, g: 0.0, b: 0.0 },
      roughness: 0.5,
      metalness: 0.0
    });

    const { colors, hasColors } = serializeMeshColors(mesh);

    expect(hasColors).toBe(true);
    expect(colors.length).toBe(18);  // 2 triangles × 3 vertices × 3 color components

    // First triangle: red from material slot
    expect(colors[0]).toBe(1.0);  // r
    expect(colors[1]).toBe(0.0);  // g
    expect(colors[2]).toBe(0.0);  // b

    // Second triangle: green from face color
    expect(colors[9]).toBe(0.0);   // r
    expect(colors[10]).toBe(1.0);  // g
    expect(colors[11]).toBe(0.0);  // b
  });
});


