/**
 * Mirror (C7-001) - Unit tests for mirror operation
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
function createTestBox(width = 1, height = 1, depth = 1): Mesh {
  return MeshOperations.createBox(width, height, depth);
}

// ============================================================================
// MeshOperations.mirror() tests
// ============================================================================

describe('MeshOperations.mirror()', () => {
  it('should mirror mesh across X plane (YZ plane)', () => {
    const box = createTestBox(2, 1, 1);
    const mirrored = MeshOperations.mirror(box, 'x', false);

    // Should have same vertex/face count (just mirrored, not welded)
    expect(mirrored.vertices.length).toBe(box.vertices.length);
    expect(mirrored.faces.length).toBe(box.faces.length);

    // Vertices should be mirrored in X
    for (let i = 0; i < box.vertices.length; i++) {
      expect(mirrored.vertices[i].position.x).toBeCloseTo(-box.vertices[i].position.x, 5);
      expect(mirrored.vertices[i].position.y).toBeCloseTo(box.vertices[i].position.y, 5);
      expect(mirrored.vertices[i].position.z).toBeCloseTo(box.vertices[i].position.z, 5);
    }
  });

  it('should mirror mesh across Y plane (XZ plane)', () => {
    const box = createTestBox(1, 2, 1);
    const mirrored = MeshOperations.mirror(box, 'y', false);

    // Vertices should be mirrored in Y
    for (let i = 0; i < box.vertices.length; i++) {
      expect(mirrored.vertices[i].position.x).toBeCloseTo(box.vertices[i].position.x, 5);
      expect(mirrored.vertices[i].position.y).toBeCloseTo(-box.vertices[i].position.y, 5);
      expect(mirrored.vertices[i].position.z).toBeCloseTo(box.vertices[i].position.z, 5);
    }
  });

  it('should mirror mesh across Z plane (XY plane)', () => {
    const box = createTestBox(1, 1, 2);
    const mirrored = MeshOperations.mirror(box, 'z', false);

    // Vertices should be mirrored in Z
    for (let i = 0; i < box.vertices.length; i++) {
      expect(mirrored.vertices[i].position.x).toBeCloseTo(box.vertices[i].position.x, 5);
      expect(mirrored.vertices[i].position.y).toBeCloseTo(box.vertices[i].position.y, 5);
      expect(mirrored.vertices[i].position.z).toBeCloseTo(-box.vertices[i].position.z, 5);
    }
  });

  it('should weld mirrored mesh with original when weld=true', () => {
    const box = createTestBox(1, 1, 1);
    const mirrored = MeshOperations.mirror(box, 'x', true);

    // Welded mesh should have double the vertices and faces (approximately)
    // (some vertices may be shared at the boundary)
    expect(mirrored.vertices.length).toBeGreaterThanOrEqual(box.vertices.length);
    expect(mirrored.faces.length).toBe(box.faces.length * 2);
  });

  it('should preserve mesh topology', () => {
    const box = createTestBox();
    const mirrored = MeshOperations.mirror(box, 'x', false);

    // Face indices should still be valid
    for (const face of mirrored.faces) {
      for (const idx of face.indices) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(mirrored.vertices.length);
      }
    }
  });

  it('should preserve face colors', () => {
    const box = createTestBox();
    // Add a color to the first face
    box.faces[0].color = { r: 1, g: 0, b: 0 };

    const mirrored = MeshOperations.mirror(box, 'x', false);

    // The mirrored face should have the same color
    expect(mirrored.faces[0].color).toEqual({ r: 1, g: 0, b: 0 });
  });

  it('should preserve material slots', () => {
    const box = createTestBox();
    box.addMaterialSlot({ name: 'wood', color: { r: 0.5, g: 0.3, b: 0.1 }, roughness: 0.5, metalness: 0 });
    box.faces[0].materialSlotIndex = 0;

    const mirrored = MeshOperations.mirror(box, 'x', false);

    expect(mirrored.materialSlots.length).toBe(1);
    expect(mirrored.materialSlots[0].name).toBe('wood');
    expect(mirrored.faces[0].materialSlotIndex).toBe(0);
  });

  it('should support custom plane definition', () => {
    const box = createTestBox(1, 1, 1);
    // Mirror across plane at x=0.5 with normal pointing in +X
    const plane = {
      point: new Vec3(0.5, 0, 0),
      normal: new Vec3(1, 0, 0)
    };
    const mirrored = MeshOperations.mirror(box, plane, false);

    // The mesh should be mirrored around x=0.5
    // Original vertices at x=-0.5 should mirror to x=1.5
    // Original vertices at x=0.5 should stay at x=0.5
    expect(mirrored.vertices.length).toBe(box.vertices.length);
  });

  it('should reverse face winding for correct normals', () => {
    const box = createTestBox();
    const mirrored = MeshOperations.mirror(box, 'x', false);

    // Check that face indices are reversed (different order than original)
    // The first face's indices should be reversed
    const originalIndices = box.faces[0].indices;
    const mirroredIndices = mirrored.faces[0].indices;

    // Reversed winding: [0,1,2,3] -> [3,2,1,0]
    expect(mirroredIndices[0]).toBe(originalIndices[originalIndices.length - 1]);
  });
});

// ============================================================================
// YAML builder integration tests
// ============================================================================

describe('YAML builder mirror integration', () => {
  it('should execute mirror command in YAML builder', async () => {
    const yaml = {
      version: '1',
      name: 'MirrorTest',
      geometry: [
        { box: { name: 'half_box', center: { x: 0.5, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } } },
        { mirror: 'symmetric', plane: 'x', weld: true }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);

    // Should have valid mesh
    expect(result.mesh.vertices.length).toBeGreaterThan(0);
    expect(result.mesh.faces.length).toBeGreaterThan(0);

    // Should have mirror trace
    expect(result.traces.has('mirror:symmetric')).toBe(true);
  });

  it('should default to X plane if not specified', async () => {
    const yaml = {
      version: '1',
      name: 'MirrorDefaultTest',
      geometry: [
        { box: { name: 'test_box', center: { x: 0.5, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } } },
        { mirror: 'default_mirror' }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);
    expect(result.mesh.vertices.length).toBeGreaterThan(0);
    expect(result.traces.has('mirror:default_mirror')).toBe(true);
  });

  it('should support Y and Z planes', async () => {
    const yaml = {
      version: '1',
      name: 'MirrorYZTest',
      geometry: [
        { box: { name: 'test_box', center: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 } } },
        { mirror: 'y_mirror', plane: 'y' }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);
    expect(result.mesh.vertices.length).toBeGreaterThan(0);
  });

  it('should work with weld=false (default)', async () => {
    const yaml = {
      version: '1',
      name: 'MirrorNoWeldTest',
      geometry: [
        { box: { name: 'test_box', center: { x: 0.5, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } } },
        { mirror: 'no_weld', plane: 'x', weld: false }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);
    // Without weld, should have same vertex count as original box (24 vertices with UVs)
    expect(result.mesh.vertices.length).toBe(24);
    expect(result.mesh.faces.length).toBe(6);
  });
});
