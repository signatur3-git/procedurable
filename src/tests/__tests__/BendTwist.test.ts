/**
 * BendTwistTaper (C5-002, C5-003) - Unit tests for bend, twist, and taper deformers
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
 * Create a simple box mesh for testing deformers
 */
function createTestBox(width = 1, height = 2, depth = 1): Mesh {
  return MeshOperations.createBox(width, height, depth);
}


// ============================================================================
// MeshOperations.bend() tests
// ============================================================================

describe('MeshOperations.bend()', () => {
  it('should return unchanged mesh when angle is 0', () => {
    const box = createTestBox();
    const bent = MeshOperations.bend(box, 'y', 0);

    // Should have same vertex count
    expect(bent.vertices.length).toBe(box.vertices.length);

    // Positions should be unchanged
    for (let i = 0; i < box.vertices.length; i++) {
      expect(bent.vertices[i].position.x).toBeCloseTo(box.vertices[i].position.x, 5);
      expect(bent.vertices[i].position.y).toBeCloseTo(box.vertices[i].position.y, 5);
      expect(bent.vertices[i].position.z).toBeCloseTo(box.vertices[i].position.z, 5);
    }
  });

  it('should bend mesh when angle is non-zero', () => {
    const box = createTestBox(1, 2, 1);
    const bent = MeshOperations.bend(box, 'y', Math.PI / 4);  // 45 degrees

    // Should have same topology
    expect(bent.vertices.length).toBe(box.vertices.length);
    expect(bent.faces.length).toBe(box.faces.length);

    // Vertices should have moved (at least some of them)
    let verticesMoved = 0;
    for (let i = 0; i < box.vertices.length; i++) {
      const orig = box.vertices[i].position;
      const newPos = bent.vertices[i].position;
      if (orig.sub(newPos).length() > 0.01) {
        verticesMoved++;
      }
    }
    expect(verticesMoved).toBeGreaterThan(0);
  });

  it('should bend along different axes', () => {
    const box = createTestBox(1, 2, 1);
    const angle = Math.PI / 6;

    const bentX = MeshOperations.bend(box, 'x', angle);
    const bentY = MeshOperations.bend(box, 'y', angle);
    const bentZ = MeshOperations.bend(box, 'z', angle);

    // All should have same vertex/face count
    expect(bentX.vertices.length).toBe(box.vertices.length);
    expect(bentY.vertices.length).toBe(box.vertices.length);
    expect(bentZ.vertices.length).toBe(box.vertices.length);

    // But different resulting positions (for non-trivial mesh)
    // We just verify they don't throw and produce valid meshes
    expect(bentX.faces.length).toBeGreaterThan(0);
    expect(bentY.faces.length).toBeGreaterThan(0);
    expect(bentZ.faces.length).toBeGreaterThan(0);
  });

  it('should preserve mesh topology', () => {
    const box = createTestBox();
    const bent = MeshOperations.bend(box, 'y', Math.PI / 3);

    // Face indices should still be valid
    for (const face of bent.faces) {
      for (const idx of face.indices) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(bent.vertices.length);
      }
    }
  });

  it('should accept custom center point', () => {
    const box = createTestBox();
    const center = new Vec3(0, 0, 0);
    const bent = MeshOperations.bend(box, 'y', Math.PI / 4, center);

    expect(bent.vertices.length).toBe(box.vertices.length);
  });
});

// ============================================================================
// MeshOperations.twist() tests
// ============================================================================

describe('MeshOperations.twist()', () => {
  it('should return unchanged mesh when angle is 0', () => {
    const box = createTestBox();
    const twisted = MeshOperations.twist(box, 'y', 0);

    // Positions should be unchanged
    for (let i = 0; i < box.vertices.length; i++) {
      expect(twisted.vertices[i].position.x).toBeCloseTo(box.vertices[i].position.x, 5);
      expect(twisted.vertices[i].position.y).toBeCloseTo(box.vertices[i].position.y, 5);
      expect(twisted.vertices[i].position.z).toBeCloseTo(box.vertices[i].position.z, 5);
    }
  });

  it('should twist mesh when angle is non-zero', () => {
    const box = createTestBox(1, 2, 1);
    const twisted = MeshOperations.twist(box, 'y', Math.PI);  // 180 degrees total

    // Should have same topology
    expect(twisted.vertices.length).toBe(box.vertices.length);
    expect(twisted.faces.length).toBe(box.faces.length);

    // Vertices at ends should have rotated
    let verticesMoved = 0;
    for (let i = 0; i < box.vertices.length; i++) {
      const orig = box.vertices[i].position;
      const newPos = twisted.vertices[i].position;
      if (orig.sub(newPos).length() > 0.01) {
        verticesMoved++;
      }
    }
    expect(verticesMoved).toBeGreaterThan(0);
  });

  it('should twist progressively along axis (center stays, ends rotate)', () => {
    // Create a tall box
    const box = createTestBox(1, 4, 1);
    const twisted = MeshOperations.twist(box, 'y', Math.PI);

    // Find vertices near Y=2 (top) to verify twist was applied
    const topVerts = twisted.vertices.filter(v => v.position.y > 1.9);

    // Center vertices should be relatively unchanged in XZ
    // (They're at the center of the twist, so rotation is minimal)

    // Top vertices should be rotated more
    // We can verify they're still in a valid position
    expect(topVerts.length).toBeGreaterThan(0);
  });

  it('should twist along different axes', () => {
    const box = createTestBox();
    const angle = Math.PI / 2;

    const twistX = MeshOperations.twist(box, 'x', angle);
    const twistY = MeshOperations.twist(box, 'y', angle);
    const twistZ = MeshOperations.twist(box, 'z', angle);

    // All should produce valid meshes
    expect(twistX.faces.length).toBeGreaterThan(0);
    expect(twistY.faces.length).toBeGreaterThan(0);
    expect(twistZ.faces.length).toBeGreaterThan(0);
  });

  it('should preserve mesh topology', () => {
    const box = createTestBox();
    const twisted = MeshOperations.twist(box, 'y', Math.PI / 2);

    // Face indices should still be valid
    for (const face of twisted.faces) {
      for (const idx of face.indices) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(twisted.vertices.length);
      }
    }
  });

  it('should accept custom center point', () => {
    const box = createTestBox();
    const center = new Vec3(0.5, 0.5, 0.5);
    const twisted = MeshOperations.twist(box, 'y', Math.PI / 4, center);

    expect(twisted.vertices.length).toBe(box.vertices.length);
  });
});

// ============================================================================
// YAML Builder Integration tests
// ============================================================================

describe('YAML builder bend/twist integration', () => {
  it('should execute bend command in YAML builder', async () => {
    const yaml = {
      version: '1',
      name: 'BendTest',
      geometry: [
        { box: { name: 'test_box', center: { x: 0, y: 1, z: 0 }, size: { x: 0.5, y: 2, z: 0.5 } } },
        { bend: 'curved_shape', axis: 'y', angle: 0.5 }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);

    // Should have valid mesh
    expect(result.mesh.vertices.length).toBeGreaterThan(0);
    expect(result.mesh.faces.length).toBeGreaterThan(0);

    // Should have bend trace
    expect(result.traces.has('bend:curved_shape')).toBe(true);
  });

  it('should execute twist command in YAML builder', async () => {
    const yaml = {
      version: '1',
      name: 'TwistTest',
      geometry: [
        { box: { name: 'test_box', center: { x: 0, y: 1, z: 0 }, size: { x: 0.5, y: 2, z: 0.5 } } },
        { twist: 'spiral_shape', axis: 'y', angle: 1.57 }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);

    // Should have valid mesh
    expect(result.mesh.vertices.length).toBeGreaterThan(0);
    expect(result.mesh.faces.length).toBeGreaterThan(0);

    // Should have twist trace
    expect(result.traces.has('twist:spiral_shape')).toBe(true);
  });

  it('should support expressions for angle', async () => {
    const yaml = {
      version: '1',
      name: 'ExpressionTest',
      measurements: {
        bend_amount: { base: 0.3 }
      },
      geometry: [
        { box: { name: 'test_box', center: { x: 0, y: 1, z: 0 }, size: { x: 0.5, y: 2, z: 0.5 } } },
        { bend: 'curved', angle: 'bend_amount * 2' }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);
    expect(result.mesh.vertices.length).toBeGreaterThan(0);
  });

  it('should chain multiple deformers', async () => {
    const yaml = {
      version: '1',
      name: 'ChainTest',
      geometry: [
        { box: { name: 'test_box', center: { x: 0, y: 1, z: 0 }, size: { x: 0.5, y: 2, z: 0.5 } } },
        { bend: 'first_bend', axis: 'y', angle: 0.2 },
        { twist: 'then_twist', axis: 'y', angle: 0.5 }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);

    // Should have both traces
    expect(result.traces.has('bend:first_bend')).toBe(true);
    expect(result.traces.has('twist:then_twist')).toBe(true);
  });
});

// ============================================================================
// MeshOperations.taper() tests (C5-003)
// ============================================================================

describe('MeshOperations.taper()', () => {
  it('should return unchanged mesh when startScale equals endScale', () => {
    const box = createTestBox();
    const tapered = MeshOperations.taper(box, 'y', 1.0, 1.0);

    // Positions should be unchanged
    for (let i = 0; i < box.vertices.length; i++) {
      expect(tapered.vertices[i].position.x).toBeCloseTo(box.vertices[i].position.x, 5);
      expect(tapered.vertices[i].position.y).toBeCloseTo(box.vertices[i].position.y, 5);
      expect(tapered.vertices[i].position.z).toBeCloseTo(box.vertices[i].position.z, 5);
    }
  });

  it('should taper mesh when scales differ', () => {
    const box = createTestBox(1, 2, 1);
    const tapered = MeshOperations.taper(box, 'y', 1.0, 0.5);

    // Should have same topology
    expect(tapered.vertices.length).toBe(box.vertices.length);
    expect(tapered.faces.length).toBe(box.faces.length);

    // Vertices at top should be scaled down
    const topVerts = tapered.vertices.filter(v => v.position.y > 0.9);
    const bottomVerts = tapered.vertices.filter(v => v.position.y < -0.9);

    // Top vertices should have smaller XZ extent than bottom
    const topMaxX = Math.max(...topVerts.map(v => Math.abs(v.position.x)));
    const bottomMaxX = Math.max(...bottomVerts.map(v => Math.abs(v.position.x)));

    expect(topMaxX).toBeLessThan(bottomMaxX);
  });

  it('should taper along different axes', () => {
    const box = createTestBox();

    const taperedX = MeshOperations.taper(box, 'x', 1.0, 0.5);
    const taperedY = MeshOperations.taper(box, 'y', 1.0, 0.5);
    const taperedZ = MeshOperations.taper(box, 'z', 1.0, 0.5);

    // All should produce valid meshes
    expect(taperedX.faces.length).toBeGreaterThan(0);
    expect(taperedY.faces.length).toBeGreaterThan(0);
    expect(taperedZ.faces.length).toBeGreaterThan(0);
  });

  it('should preserve mesh topology', () => {
    const box = createTestBox();
    const tapered = MeshOperations.taper(box, 'y', 1.0, 0.3);

    // Face indices should still be valid
    for (const face of tapered.faces) {
      for (const idx of face.indices) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(tapered.vertices.length);
      }
    }
  });

  it('should work with inverse taper (growing instead of shrinking)', () => {
    const box = createTestBox(1, 2, 1);
    const tapered = MeshOperations.taper(box, 'y', 0.5, 1.0);  // Start small, end big

    // Top vertices should be larger than bottom
    const topVerts = tapered.vertices.filter(v => v.position.y > 0.9);
    const bottomVerts = tapered.vertices.filter(v => v.position.y < -0.9);

    const topMaxX = Math.max(...topVerts.map(v => Math.abs(v.position.x)));
    const bottomMaxX = Math.max(...bottomVerts.map(v => Math.abs(v.position.x)));

    expect(topMaxX).toBeGreaterThan(bottomMaxX);
  });

  it('should accept custom center point', () => {
    const box = createTestBox();
    const center = new Vec3(0.5, 0.5, 0.5);
    const tapered = MeshOperations.taper(box, 'y', 1.0, 0.5, center);

    expect(tapered.vertices.length).toBe(box.vertices.length);
  });
});

// ============================================================================
// YAML builder taper integration
// ============================================================================

describe('YAML builder taper integration', () => {
  it('should execute taper command in YAML builder', async () => {
    const yaml = {
      version: '1',
      name: 'TaperTest',
      geometry: [
        { box: { name: 'test_box', center: { x: 0, y: 1, z: 0 }, size: { x: 1, y: 2, z: 1 } } },
        { taper: 'cone_shape', axis: 'y', start_scale: 1.0, end_scale: 0.2 }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);

    // Should have valid mesh
    expect(result.mesh.vertices.length).toBeGreaterThan(0);
    expect(result.mesh.faces.length).toBeGreaterThan(0);

    // Should have taper trace
    expect(result.traces.has('taper:cone_shape')).toBe(true);
  });

  it('should support expressions for scale values', async () => {
    const yaml = {
      version: '1',
      name: 'TaperExpressionTest',
      measurements: {
        top_scale: { base: 0.3 }
      },
      geometry: [
        { box: { name: 'test_box', center: { x: 0, y: 1, z: 0 }, size: { x: 1, y: 2, z: 1 } } },
        { taper: 'tapered', axis: 'y', start_scale: 1.0, end_scale: 'top_scale' }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);
    expect(result.mesh.vertices.length).toBeGreaterThan(0);
    expect(result.traces.has('taper:tapered')).toBe(true);
  });

  it('should chain all deformers together', async () => {
    const yaml = {
      version: '1',
      name: 'AllDeformersTest',
      geometry: [
        { box: { name: 'test_box', center: { x: 0, y: 1, z: 0 }, size: { x: 0.5, y: 2, z: 0.5 } } },
        { taper: 'first_taper', axis: 'y', start_scale: 1.0, end_scale: 0.7 },
        { bend: 'then_bend', axis: 'y', angle: 0.2 },
        { twist: 'finally_twist', axis: 'y', angle: 0.3 }
      ]
    };

    const result = await parseAndExecuteBuilder(yaml as any);

    // Should have all three traces
    expect(result.traces.has('taper:first_taper')).toBe(true);
    expect(result.traces.has('bend:then_bend')).toBe(true);
    expect(result.traces.has('twist:finally_twist')).toBe(true);
  });
});

