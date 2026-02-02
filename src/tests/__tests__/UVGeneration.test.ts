/**
 * UV Generation (C4-001) - Unit tests for automatic UV coordinate generation
 */

import { describe, it, expect } from '@jest/globals';
import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { lathe } from '../../platform/geometry/Sweep';
import { extrude2D } from '../../platform/geometry/Extrude';
import { Shape2D } from '../../platform/geometry/Shape2D';

// ============================================================================
// Box UV tests
// ============================================================================

describe('Box UV Generation', () => {
  it('should generate UVs for all vertices', () => {
    const box = MeshOperations.createBox(1, 1, 1);

    // All vertices should have UVs
    for (const vertex of box.vertices) {
      expect(vertex.attributes.uv).toBeDefined();
      expect(vertex.attributes.uv).toHaveLength(2);
    }
  });

  it('should have UVs in valid [0,1] range', () => {
    const box = MeshOperations.createBox(2, 3, 4);

    for (const vertex of box.vertices) {
      const [u, v] = vertex.attributes.uv!;
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('should have 24 vertices (4 per face for proper UVs)', () => {
    const box = MeshOperations.createBox(1, 1, 1);
    expect(box.vertices.length).toBe(24);
  });

  it('should have corner UVs at [0,0], [1,0], [1,1], [0,1]', () => {
    const box = MeshOperations.createBox(1, 1, 1);

    // Each face should have all 4 corners
    const uvCorners = new Set<string>();
    for (const vertex of box.vertices) {
      const [u, v] = vertex.attributes.uv!;
      // Round to handle floating point
      const key = `${Math.round(u)},${Math.round(v)}`;
      uvCorners.add(key);
    }

    expect(uvCorners.has('0,0')).toBe(true);
    expect(uvCorners.has('1,0')).toBe(true);
    expect(uvCorners.has('1,1')).toBe(true);
    expect(uvCorners.has('0,1')).toBe(true);
  });
});

// ============================================================================
// Lathe UV tests
// ============================================================================

describe('Lathe UV Generation', () => {
  it('should generate UVs for all vertices', () => {
    const profile = [
      { x: 0.1, y: 0 },
      { x: 0.2, y: 0.5 },
      { x: 0.1, y: 1 }
    ];
    const mesh = lathe(profile, 8);

    for (const vertex of mesh.vertices) {
      expect(vertex.attributes.uv).toBeDefined();
      expect(vertex.attributes.uv).toHaveLength(2);
    }
  });

  it('should have U coordinate based on angle (0 to 1 around)', () => {
    const profile = [{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }];
    const mesh = lathe(profile, 8);

    // U should range from 0 to near 1 (not exactly 1 due to closed loop)
    const uValues = mesh.vertices.map(v => v.attributes.uv![0]);
    const minU = Math.min(...uValues);
    const maxU = Math.max(...uValues);

    expect(minU).toBe(0);
    expect(maxU).toBeLessThan(1); // For closed loop, doesn't reach exactly 1
  });

  it('should have V coordinate based on height', () => {
    const profile = [
      { x: 0.5, y: 0 },   // bottom: v = 0
      { x: 0.5, y: 0.5 }, // middle: v = 0.5
      { x: 0.5, y: 1 }    // top: v = 1
    ];
    const mesh = lathe(profile, 4);

    // Check that V maps to height
    for (const vertex of mesh.vertices) {
      const expectedV = vertex.position.y; // Height maps directly to V
      expect(vertex.attributes.uv![1]).toBeCloseTo(expectedV, 5);
    }
  });

  it('should have UVs in valid [0,1] range', () => {
    const profile = [{ x: 0.3, y: -1 }, { x: 0.5, y: 0 }, { x: 0.3, y: 1 }];
    const mesh = lathe(profile, 16);

    for (const vertex of mesh.vertices) {
      const [u, v] = vertex.attributes.uv!;
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// Sphere UV tests (already has UVs, verify they work)
// ============================================================================

describe('Sphere UV Generation', () => {
  it('should have UVs for all vertices', () => {
    const sphere = MeshOperations.createSphere(1, 16, 8);

    for (const vertex of sphere.vertices) {
      expect(vertex.attributes.uv).toBeDefined();
    }
  });

  it('should have UVs in valid [0,1] range', () => {
    const sphere = MeshOperations.createSphere(1, 16, 8);

    for (const vertex of sphere.vertices) {
      const [u, v] = vertex.attributes.uv!;
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// Extrude UV tests
// ============================================================================

describe('Extrude UV Generation', () => {
  it('should generate UVs for extruded geometry', () => {
    const shape = Shape2D.rect(1, 1);
    const result = extrude2D(shape, { depth: 1, caps: 'both' });

    expect(result.uvs).toBeDefined();
    expect(result.uvs!.length).toBe(result.vertices.length);
  });

  it('should have UVs in valid [0,1] range', () => {
    const shape = Shape2D.circle(0.5, 12);
    const result = extrude2D(shape, { depth: 2, caps: 'both' });

    for (const [u, v] of result.uvs!) {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('should have V=0 for front vertices and V=1 for back vertices', () => {
    const shape = Shape2D.rect(1, 1);
    const result = extrude2D(shape, { depth: 1, caps: 'none' });

    const pointCount = shape.points.length;

    // First half of vertices are front (V=0)
    for (let i = 0; i < pointCount; i++) {
      expect(result.uvs![i][1]).toBe(0);
    }

    // Second half are back (V=1)
    for (let i = pointCount; i < pointCount * 2; i++) {
      expect(result.uvs![i][1]).toBe(1);
    }
  });

  it('should have continuous U along perimeter', () => {
    const shape = Shape2D.rect(2, 1);
    const result = extrude2D(shape, { depth: 1, caps: 'none' });

    const pointCount = shape.points.length;

    // U values should increase around perimeter
    const frontUs = result.uvs!.slice(0, pointCount).map(uv => uv[0]);

    // First should be 0
    expect(frontUs[0]).toBe(0);

    // Should be monotonically increasing (modulo wrap)
    for (let i = 1; i < frontUs.length; i++) {
      expect(frontUs[i]).toBeGreaterThan(frontUs[i - 1]);
    }
  });
});
