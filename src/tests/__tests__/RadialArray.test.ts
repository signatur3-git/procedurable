/**
 * RadialArray (C7-002) - Unit tests for radial array operation
 */

import { describe, it, expect } from '@jest/globals';
import { Mesh } from '../../platform/geometry/Mesh';
import { Vec3 } from '../../platform/math/Vec3';
import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { parseAndExecuteBuilder } from '../../generation/builder/YamlBuilderParser';

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Create a simple box mesh for testing
 */
function createTestBox(width = 0.1, height = 0.1, depth = 0.1): Mesh {
  return MeshOperations.createBox(width, height, depth);
}

// ============================================================================
// MeshOperations.radialArray() tests
// ============================================================================

describe('MeshOperations.radialArray()', () => {
  it('should create specified number of copies', () => {
    const box = createTestBox();
    const arrayed = MeshOperations.radialArray(box, 'y', 4);

    // Should have 4x the vertices and faces
    expect(arrayed.vertices.length).toBe(box.vertices.length * 4);
    expect(arrayed.faces.length).toBe(box.faces.length * 4);
  });

  it('should distribute copies evenly around axis', () => {
    // Create a box offset from origin
    const box = createTestBox();
    // Translate it so we can see the rotation effect
    for (const v of box.vertices) {
      v.position = v.position.add(new Vec3(0.5, 0, 0));
    }

    const arrayed = MeshOperations.radialArray(box, 'y', 4);

    // With 4 copies around Y, copies should be at 0°, 90°, 180°, 270°
    // Check that we have vertices at different X/Z positions
    const xPositions = new Set<number>();
    for (const v of arrayed.vertices) {
      xPositions.add(Math.round(v.position.x * 100) / 100);
    }
    // Should have vertices at multiple X positions due to rotation
    expect(xPositions.size).toBeGreaterThan(1);
  });

  it('should rotate around X axis', () => {
    const box = createTestBox();
    for (const v of box.vertices) {
      v.position = v.position.add(new Vec3(0, 0.5, 0));
    }

    const arrayed = MeshOperations.radialArray(box, 'x', 4);
    expect(arrayed.vertices.length).toBe(box.vertices.length * 4);
  });

  it('should rotate around Z axis', () => {
    const box = createTestBox();
    for (const v of box.vertices) {
      v.position = v.position.add(new Vec3(0.5, 0, 0));
    }

    const arrayed = MeshOperations.radialArray(box, 'z', 4);
    expect(arrayed.vertices.length).toBe(box.vertices.length * 4);
  });

  it('should support partial angle (less than full circle)', () => {
    const box = createTestBox();
    for (const v of box.vertices) {
      v.position = v.position.add(new Vec3(0.5, 0, 0));
    }

    // 4 copies over 180° (π radians)
    const arrayed = MeshOperations.radialArray(box, 'y', 4, Math.PI);
    expect(arrayed.vertices.length).toBe(box.vertices.length * 4);
    expect(arrayed.faces.length).toBe(box.faces.length * 4);
  });

  it('should preserve face colors', () => {
    const box = createTestBox();
    box.faces[0].color = { r: 1, g: 0, b: 0 };

    const arrayed = MeshOperations.radialArray(box, 'y', 3);

    // Each copy should have the same color on corresponding face
    expect(arrayed.faces[0].color).toEqual({ r: 1, g: 0, b: 0 });
  });

  it('should preserve material slots', () => {
    const box = createTestBox();
    box.addMaterialSlot({ name: 'metal', color: { r: 0.8, g: 0.8, b: 0.8 }, roughness: 0.3, metalness: 0.9 });
    box.faces[0].materialSlotIndex = 0;

    const arrayed = MeshOperations.radialArray(box, 'y', 4);

    expect(arrayed.materialSlots.length).toBe(1);
    expect(arrayed.materialSlots[0].name).toBe('metal');
  });

  it('should support custom axis point and direction', () => {
    const box = createTestBox();
    for (const v of box.vertices) {
      v.position = v.position.add(new Vec3(1, 0, 0));
    }

    const axis = {
      point: new Vec3(0.5, 0, 0),  // Offset pivot
      direction: new Vec3(0, 1, 0)  // Y axis direction
    };

    const arrayed = MeshOperations.radialArray(box, axis, 4);
    expect(arrayed.vertices.length).toBe(box.vertices.length * 4);
  });

  it('should exclude original when include_original is false', () => {
    const box = createTestBox();

    // With includeOriginal = false, should have count-1 copies
    const arrayed = MeshOperations.radialArray(box, 'y', 4, Math.PI * 2, false);
    expect(arrayed.vertices.length).toBe(box.vertices.length * 3);
    expect(arrayed.faces.length).toBe(box.faces.length * 3);
  });

  it('should handle count of 1', () => {
    const box = createTestBox();
    const arrayed = MeshOperations.radialArray(box, 'y', 1);

    // Should just be the original
    expect(arrayed.vertices.length).toBe(box.vertices.length);
    expect(arrayed.faces.length).toBe(box.faces.length);
  });

  it('should preserve mesh topology', () => {
    const box = createTestBox();
    const arrayed = MeshOperations.radialArray(box, 'y', 6);

    // Face indices should be valid
    for (const face of arrayed.faces) {
      for (const idx of face.indices) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(arrayed.vertices.length);
      }
    }
  });
});

// ============================================================================
// YAML builder integration tests
// ============================================================================

describe('YAML builder mesh_radial_array integration', () => {
  it('should execute mesh_radial_array command', async () => {
    const yaml = {
      version: '1',
      name: 'RadialArrayTest',
      geometry: [
        { box: { name: 'tooth', center: { x: 0.5, y: 0, z: 0 }, size: { x: 0.1, y: 0.1, z: 0.1 } } },
        { mesh_radial_array: 'teeth', axis: 'y', count: 8 }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);

    // Should have 8x the original box (24 vertices per box with UVs)
    expect(result.mesh.vertices.length).toBe(8 * 24); // 8 copies × 24 vertices per box
    expect(result.mesh.faces.length).toBe(8 * 6);    // 8 copies × 6 faces per box

    // Should have trace
    expect(result.traces.has('mesh_radial_array:teeth')).toBe(true);
  });

  it('should support expression for count', async () => {
    const yaml = {
      version: '1',
      name: 'RadialArrayExprTest',
      measurements: {
        spoke_count: { base: 6 }
      },
      geometry: [
        { box: { name: 'spoke', center: { x: 0.3, y: 0, z: 0 }, size: { x: 0.5, y: 0.05, z: 0.05 } } },
        { mesh_radial_array: 'spokes', axis: 'y', count: 'spoke_count' }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);
    expect(result.mesh.vertices.length).toBe(6 * 24);
  });

  it('should support partial angle', async () => {
    const yaml = {
      version: '1',
      name: 'PartialArrayTest',
      geometry: [
        { box: { name: 'segment', center: { x: 0.5, y: 0, z: 0 }, size: { x: 0.1, y: 0.1, z: 0.1 } } },
        { mesh_radial_array: 'half_circle', axis: 'z', count: 4, angle: 3.14159 }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);
    expect(result.mesh.vertices.length).toBe(4 * 24);
  });

  it('should work with different axes', async () => {
    const yamlX = {
      version: '1',
      name: 'XAxisTest',
      geometry: [
        { box: { name: 'element', center: { x: 0, y: 0.5, z: 0 }, size: { x: 0.1, y: 0.1, z: 0.1 } } },
        { mesh_radial_array: 'pattern', axis: 'x', count: 3 }
      ]
    };

    const result = await parseAndExecuteBuilder(yamlX as any);
    expect(result.mesh.vertices.length).toBe(3 * 24);
  });
});
