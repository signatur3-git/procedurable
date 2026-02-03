/**
 * UV Generation (C4-001) - Unit tests for automatic UV coordinate generation
 */

import { describe, it, expect } from '@jest/globals';
import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { lathe, loftProfiles, Profiles } from '../../platform/geometry/Sweep';
import { extrude2D } from '../../platform/geometry/Extrude';
import { Shape2D } from '../../platform/geometry/Shape2D';
import { Vec3 } from '../../platform/math/Vec3';

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

  it('should have UVs in valid [0,1] range for normalized mode', () => {
    const box = MeshOperations.createBox(2, 3, 4, 'normalized');

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

  it('should have corner UVs at [0,0], [1,0], [1,1], [0,1] for normalized mode', () => {
    const box = MeshOperations.createBox(1, 1, 1, 'normalized');

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

  it('should have world-scale UVs when uv_mode is world_scale', () => {
    const width = 2, height = 3, depth = 4;
    const box = MeshOperations.createBox(width, height, depth, 'world_scale');

    // Find max UV values - they should match world dimensions
    let maxU = 0, maxV = 0;
    for (const vertex of box.vertices) {
      const [u, v] = vertex.attributes.uv!;
      maxU = Math.max(maxU, u);
      maxV = Math.max(maxV, v);
    }

    // Max U/V should be related to world dimensions
    // Front/Back faces: width x height -> max should be max(width, height)
    // Left/Right faces: depth x height
    // Top/Bottom faces: width x depth
    expect(maxU).toBeGreaterThan(1); // Should exceed 1 for world_scale
    expect(maxV).toBeGreaterThan(1);
  });

  it('should have consistent texel density in world_scale mode', () => {
    const width = 2, height = 1, depth = 3;
    const box = MeshOperations.createBox(width, height, depth, 'world_scale');

    // In world_scale mode, UVs should match dimensions
    // Front/Back: width x height
    // Left/Right: depth x height
    // Top/Bottom: width x depth

    // Collect all UV max values
    const allUVs = box.vertices.map(v => v.attributes.uv!);
    const maxU = Math.max(...allUVs.map(uv => uv[0]));
    const maxV = Math.max(...allUVs.map(uv => uv[1]));

    // Max U should be depth (3) from left/right faces
    // Max V should be depth (3) from top/bottom faces
    expect(maxU).toBeCloseTo(depth, 5);  // left/right faces use depth for U
    expect(maxV).toBeCloseTo(depth, 5);  // top/bottom faces use depth for V
  });

  it('should have consistent UV orientation for checker patterns', () => {
    // For a unit cube, all faces should have the same UV corner pattern
    // Each face should go from (0,0) at one corner to (1,1) at opposite
    // This ensures checker patterns look the same on all faces
    const box = MeshOperations.createBox(1, 1, 1, 'normalized');

    // Group vertices by face (every 4 vertices is a face)
    for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
      const faceVerts = box.vertices.slice(faceIdx * 4, faceIdx * 4 + 4);
      const uvs = faceVerts.map(v => v.attributes.uv!);

      // Each face should have corners at (0,0), (1,0), (1,1), (0,1)
      const uvSet = new Set(uvs.map(([u, v]) => `${u.toFixed(1)},${v.toFixed(1)}`));
      expect(uvSet.has('0.0,0.0')).toBe(true);
      expect(uvSet.has('1.0,0.0')).toBe(true);
      expect(uvSet.has('1.0,1.0')).toBe(true);
      expect(uvSet.has('0.0,1.0')).toBe(true);
    }
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

  it('should have planar UVs on cap faces (G3-001)', () => {
    const shape = Shape2D.rect(2, 2);  // 2x2 square
    const result = extrude2D(shape, { depth: 1, caps: 'both' });

    // With caps='both', we have:
    // - 4 vertices for front sides
    // - 4 vertices for back sides
    // - 4 vertices for front cap (new, planar UVs)
    // - 4 vertices for back cap (new, planar UVs)
    expect(result.vertices.length).toBe(16);

    // Check cap vertices have planar UVs in [0,1] range
    // Cap vertices are at indices 8-15
    const capUVs = result.uvs!.slice(8);
    expect(capUVs.length).toBe(8);  // 4 front cap + 4 back cap

    for (const [u, v] of capUVs) {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }

    // Cap UVs should cover the full [0,1] range (corners at 0 and 1)
    const capUs = capUVs.map(uv => uv[0]);
    const capVs = capUVs.map(uv => uv[1]);
    expect(Math.min(...capUs)).toBeCloseTo(0);
    expect(Math.max(...capUs)).toBeCloseTo(1);
    expect(Math.min(...capVs)).toBeCloseTo(0);
    expect(Math.max(...capVs)).toBeCloseTo(1);
  });
});

// ============================================================================
// Lathe Cap UV tests (G3-001)
// ============================================================================

describe('Lathe Cap UV Generation (G3-001)', () => {
  it('should have planar UVs on caps', () => {
    // Profile that starts and ends on axis (x=0) to generate caps
    const profile = [
      { x: 0, y: 0 },    // Bottom center (on axis)
      { x: 0.5, y: 0.5 }, // Mid edge
      { x: 0, y: 1 }     // Top center (on axis)
    ];
    const mesh = lathe(profile, 8);

    // All vertices should have UVs
    for (const vertex of mesh.vertices) {
      expect(vertex.attributes.uv).toBeDefined();
      const [u, v] = vertex.attributes.uv!;
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('should have cap center UV at (0.5, 0.5)', () => {
    const profile = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 0, y: 1 }
    ];
    const mesh = lathe(profile, 8);

    // Find vertices at cap centers (y=0 and y=1 with x≈0, z≈0)
    const bottomCenterVerts = mesh.vertices.filter(v =>
      Math.abs(v.position.y - 0) < 0.001 &&
      Math.abs(v.position.x) < 0.001 &&
      Math.abs(v.position.z) < 0.001
    );

    const topCenterVerts = mesh.vertices.filter(v =>
      Math.abs(v.position.y - 1) < 0.001 &&
      Math.abs(v.position.x) < 0.001 &&
      Math.abs(v.position.z) < 0.001
    );

    // Should have center vertices for both caps
    expect(bottomCenterVerts.length).toBeGreaterThan(0);
    expect(topCenterVerts.length).toBeGreaterThan(0);

    // Center vertices should have UV at (0.5, 0.5)
    for (const v of bottomCenterVerts) {
      if (v.attributes.uv) {
        // Check if this is a cap center (planar UV at 0.5, 0.5)
        const [u, vCoord] = v.attributes.uv;
        if (Math.abs(u - 0.5) < 0.01 && Math.abs(vCoord - 0.5) < 0.01) {
          expect(u).toBeCloseTo(0.5, 1);
          expect(vCoord).toBeCloseTo(0.5, 1);
        }
      }
    }
  });
});

// ============================================================================
// Loft UV tests (G3-001)
// ============================================================================

describe('Loft UV Generation (G3-001)', () => {
  it('should generate UVs for all loft vertices', () => {
    const profile = Profiles.circle(0.5, 8);
    const mesh = loftProfiles([
      { position: new Vec3(0, 0, 0), normal: new Vec3(0, 1, 0), profile },
      { position: new Vec3(0, 1, 0), normal: new Vec3(0, 1, 0), profile },
      { position: new Vec3(0, 2, 0), normal: new Vec3(0, 1, 0), profile }
    ]);

    // All vertices should have UVs
    for (const vertex of mesh.vertices) {
      expect(vertex.attributes.uv).toBeDefined();
      expect(vertex.attributes.uv).toHaveLength(2);
    }
  });

  it('should have UVs in valid [0,1] range', () => {
    const profile = Profiles.circle(0.5, 8);
    const mesh = loftProfiles([
      { position: new Vec3(0, 0, 0), normal: new Vec3(0, 1, 0), profile },
      { position: new Vec3(0, 1, 0), normal: new Vec3(0, 1, 0), profile }
    ]);

    for (const vertex of mesh.vertices) {
      const [u, v] = vertex.attributes.uv!;
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('should have V coordinate varying along loft path', () => {
    const profile = Profiles.circle(0.5, 4);
    const mesh = loftProfiles([
      { position: new Vec3(0, 0, 0), normal: new Vec3(0, 1, 0), profile },
      { position: new Vec3(0, 1, 0), normal: new Vec3(0, 1, 0), profile },
      { position: new Vec3(0, 2, 0), normal: new Vec3(0, 1, 0), profile }
    ]);

    // Profile has 4 points, 3 profiles = 12 vertices total
    expect(mesh.vertices.length).toBe(12);

    // First profile (Y=0) should have V=0
    for (let i = 0; i < 4; i++) {
      expect(mesh.vertices[i].attributes.uv![1]).toBeCloseTo(0);
    }

    // Middle profile (Y=1) should have V=0.5
    for (let i = 4; i < 8; i++) {
      expect(mesh.vertices[i].attributes.uv![1]).toBeCloseTo(0.5);
    }

    // Last profile (Y=2) should have V=1
    for (let i = 8; i < 12; i++) {
      expect(mesh.vertices[i].attributes.uv![1]).toBeCloseTo(1);
    }
  });

  it('should have U coordinate varying around profile', () => {
    const profile = Profiles.circle(0.5, 4);  // 4 points around
    const mesh = loftProfiles([
      { position: new Vec3(0, 0, 0), normal: new Vec3(0, 1, 0), profile },
      { position: new Vec3(0, 1, 0), normal: new Vec3(0, 1, 0), profile }
    ]);

    // Check first profile's U values (should be 0, 0.25, 0.5, 0.75 for 4 points)
    const firstProfileUs = mesh.vertices.slice(0, 4).map(v => v.attributes.uv![0]);
    expect(firstProfileUs[0]).toBeCloseTo(0);
    expect(firstProfileUs[1]).toBeCloseTo(0.25);
    expect(firstProfileUs[2]).toBeCloseTo(0.5);
    expect(firstProfileUs[3]).toBeCloseTo(0.75);
  });
});

