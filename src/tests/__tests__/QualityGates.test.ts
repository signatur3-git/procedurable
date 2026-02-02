/**
 * Quality Gates Tests (A2-001)
 *
 * Tests evaluateQualityTier() for machine-readable tier assessment.
 */

import { describe, it, expect } from '@jest/globals';
import { evaluateQualityTier, ValidationContext } from '../../generation/validation/ValidationAPI';
import { Mesh } from '../../platform/geometry/Mesh';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { Vec3 } from '../../platform/math/Vec3';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Create a simple box mesh (6 faces, 8 vertices) at given size */
function makeBox(w: number, h: number, d: number, color?: { r: number; g: number; b: number }): Mesh {
  const hw = w / 2, hd = d / 2;
  const verts = [
    new Vertex(new Vec3(-hw, 0, -hd)),
    new Vertex(new Vec3( hw, 0, -hd)),
    new Vertex(new Vec3( hw, h,  -hd)),
    new Vertex(new Vec3(-hw, h,  -hd)),
    new Vertex(new Vec3(-hw, 0,  hd)),
    new Vertex(new Vec3( hw, 0,  hd)),
    new Vertex(new Vec3( hw, h,   hd)),
    new Vertex(new Vec3(-hw, h,   hd)),
  ];
  const c = color;
  const faces = [
    new Face([0, 1, 2, 3], c),  // front
    new Face([5, 4, 7, 6], c),  // back
    new Face([4, 0, 3, 7], c),  // left
    new Face([1, 5, 6, 2], c),  // right
    new Face([3, 2, 6, 7], c),  // top
    new Face([4, 5, 1, 0], c),  // bottom
  ];
  return new Mesh(verts, faces);
}

/** Create an empty mesh */
function makeEmptyMesh(): Mesh {
  return new Mesh([], []);
}

/** Create a single-triangle mesh (degenerate placeholder) */
function makeSingleTriangle(size: number = 1): Mesh {
  const verts = [
    new Vertex(new Vec3(0, 0, 0)),
    new Vertex(new Vec3(size, 0, 0)),
    new Vertex(new Vec3(0, size, 0)),
  ];
  return new Mesh(verts, [new Face([0, 1, 2])]);
}

/** Build traces map with named geometry groups */
function makeTraces(groupNames: string[]): Map<string, any> {
  const traces = new Map<string, any>();
  for (const name of groupNames) {
    traces.set(`face:${name}`, { type: 'face', name });
  }
  return traces;
}

/** Create a multi-part mesh (multiple boxes stacked, with traces) */
function makeMultiPartMesh(partCount: number, colorsPerPart?: { r: number; g: number; b: number }[]): { mesh: Mesh; traces: Map<string, any> } {
  const allVerts: Vertex[] = [];
  const allFaces: Face[] = [];
  const traces = new Map<string, any>();
  const partNames = ['seat', 'back', 'leg', 'stretcher', 'arm', 'spindle', 'apron', 'support'];

  for (let i = 0; i < partCount; i++) {
    const offset = i * 0.5;
    const color = colorsPerPart?.[i];
    const hw = 0.2, h = 0.3, hd = 0.2;
    const baseIdx = allVerts.length;
    allVerts.push(
      new Vertex(new Vec3(-hw, offset, -hd)),
      new Vertex(new Vec3( hw, offset, -hd)),
      new Vertex(new Vec3( hw, offset + h, -hd)),
      new Vertex(new Vec3(-hw, offset + h, -hd)),
      new Vertex(new Vec3(-hw, offset, hd)),
      new Vertex(new Vec3( hw, offset, hd)),
      new Vertex(new Vec3( hw, offset + h, hd)),
      new Vertex(new Vec3(-hw, offset + h, hd)),
    );
    allFaces.push(
      new Face([baseIdx, baseIdx+1, baseIdx+2, baseIdx+3], color),
      new Face([baseIdx+5, baseIdx+4, baseIdx+7, baseIdx+6], color),
      new Face([baseIdx+4, baseIdx, baseIdx+3, baseIdx+7], color),
      new Face([baseIdx+1, baseIdx+5, baseIdx+6, baseIdx+2], color),
      new Face([baseIdx+3, baseIdx+2, baseIdx+6, baseIdx+7], color),
      new Face([baseIdx+4, baseIdx+5, baseIdx+1, baseIdx], color),
    );
    const name = partNames[i] || `part_${i}`;
    // Create trace entries for each face in the part (A2-002 counts faces per group)
    for (let f = 0; f < 6; f++) {
      traces.set(`face:${name}_face${f}`, { type: 'face', name: `${name}_face${f}` });
    }
  }
  return { mesh: new Mesh(allVerts, allFaces), traces };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('evaluateQualityTier', () => {

  describe('empty mesh', () => {
    it('should achieve tier 0 with suggestions to add geometry', () => {
      const ctx: ValidationContext = {
        builderName: 'EmptyBuilder',
        mesh: makeEmptyMesh(),
        traces: new Map(),
      };
      const result = evaluateQualityTier(ctx);

      expect(result.achieved_tier).toBe(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.action === 'add_geometry')).toBe(true);
    });
  });

  describe('single triangle (placeholder)', () => {
    it('should fail tier 1 due to low face count and no groups', () => {
      const ctx: ValidationContext = {
        builderName: 'PlaceholderBuilder',
        mesh: makeSingleTriangle(),
        traces: makeTraces(['placeholder']),
      };
      const result = evaluateQualityTier(ctx);

      expect(result.achieved_tier).toBe(0);
      // Should fail min_face_count and min_geometry_groups
      const failedNames = result.gates.filter(g => g.status === 'fail').map(g => g.name);
      expect(failedNames).toContain('min_face_count');
      expect(failedNames).toContain('min_geometry_groups');
    });
  });

  describe('single box (one part)', () => {
    it('should fail min_geometry_groups', () => {
      const ctx: ValidationContext = {
        builderName: 'BoxBuilder',
        mesh: makeBox(0.5, 0.5, 0.5),
        traces: makeTraces(['box']),
      };
      const result = evaluateQualityTier(ctx);

      expect(result.achieved_tier).toBe(0);
      const failedNames = result.gates.filter(g => g.status === 'fail').map(g => g.name);
      expect(failedNames).toContain('min_geometry_groups');
    });
  });

  describe('multi-part mesh passes tier 1', () => {
    it('should achieve tier 1 with 2 parts and enough faces', () => {
      const { mesh, traces } = makeMultiPartMesh(2);
      const ctx: ValidationContext = {
        builderName: 'SimpleChair',
        mesh,
        traces,
      };
      const result = evaluateQualityTier(ctx);

      expect(result.achieved_tier).toBeGreaterThanOrEqual(1);
      // All tier 1 gates should pass
      const t1Failed = result.gates.filter(g => g.tier === 1 && g.status === 'fail');
      expect(t1Failed).toHaveLength(0);
    });
  });

  describe('tier 2 requires colors and more parts', () => {
    it('should fail tier 2 without multiple colors', () => {
      const { mesh, traces } = makeMultiPartMesh(3);
      const ctx: ValidationContext = {
        builderName: 'MonoChair',
        mesh,
        traces,
      };
      const result = evaluateQualityTier(ctx, 2);

      // Should pass tier 1 but fail tier 2 (no colors)
      expect(result.achieved_tier).toBe(1);
      const failedT2 = result.gates.filter(g => g.tier === 2 && g.status === 'fail');
      expect(failedT2.some(g => g.name === 'min_materials')).toBe(true);
      expect(result.suggestions.some(s => s.action === 'add_material')).toBe(true);
    });

    it('should pass tier 2 with colors and enough parts', () => {
      const colors = [
        { r: 0.6, g: 0.3, b: 0.1 },  // wood
        { r: 0.2, g: 0.2, b: 0.2 },  // metal
        { r: 0.8, g: 0.1, b: 0.1 },  // red accent
        { r: 0.6, g: 0.3, b: 0.1 },  // wood
        { r: 0.2, g: 0.2, b: 0.2 },  // metal
        { r: 0.8, g: 0.1, b: 0.1 },  // red accent
        { r: 0.6, g: 0.3, b: 0.1 },  // wood
        { r: 0.2, g: 0.2, b: 0.2 },  // metal
      ];
      // Need ≥100 triangles for T2. 9 parts × 6 faces × 2 tris = 108.
      colors.push({ r: 0.4, g: 0.4, b: 0.0 }); // 9th color
      const { mesh, traces } = makeMultiPartMesh(9, colors);
      const ctx: ValidationContext = {
        builderName: 'ColorChair',
        mesh,
        traces,
      };
      const result = evaluateQualityTier(ctx, 2);

      expect(result.achieved_tier).toBe(2);
      const failedT2 = result.gates.filter(g => g.tier === 2 && g.status === 'fail');
      expect(failedT2).toHaveLength(0);
    });
  });

  describe('suggestion structure', () => {
    it('should have all required fields on suggestions', () => {
      const ctx: ValidationContext = {
        builderName: 'EmptyBuilder',
        mesh: makeEmptyMesh(),
        traces: new Map(),
      };
      const result = evaluateQualityTier(ctx);

      for (const s of result.suggestions) {
        expect(s).toHaveProperty('action');
        expect(s).toHaveProperty('target');
        expect(s).toHaveProperty('reason');
        expect(s).toHaveProperty('metric');
        expect(s).toHaveProperty('current_value');
        expect(s).toHaveProperty('required_value');
        expect(s).toHaveProperty('tier');
        expect(typeof s.action).toBe('string');
        expect(typeof s.current_value).toBe('number');
        expect(typeof s.required_value).toBe('number');
      }
    });
  });

  describe('target tier filtering', () => {
    it('should only show tier 1 gates when target is 1', () => {
      const { mesh, traces } = makeMultiPartMesh(2);
      const ctx: ValidationContext = {
        builderName: 'SimpleChair',
        mesh,
        traces,
      };
      const result = evaluateQualityTier(ctx, 1);

      // All returned gates should be tier 1
      expect(result.gates.every(g => g.tier <= 1)).toBe(true);
      expect(result.suggestions.every(s => s.tier <= 1)).toBe(true);
      expect(result.target_tier).toBe(1);
    });
  });

  describe('quality metadata from YAML', () => {
    it('should use target_tier from qualityMeta if no explicit tier requested', () => {
      const { mesh, traces } = makeMultiPartMesh(2);
      const ctx: ValidationContext = {
        builderName: 'Builder',
        mesh,
        traces,
        qualityMeta: { target_tier: 2 },
      };
      const result = evaluateQualityTier(ctx);

      expect(result.target_tier).toBe(2);
      // Should include tier 2 gates
      expect(result.gates.some(g => g.tier === 2)).toBe(true);
    });
  });

  describe('bounds gates', () => {
    it('should fail for extremely small mesh', () => {
      const mesh = makeBox(0.001, 0.001, 0.001);
      const ctx: ValidationContext = {
        builderName: 'TinyBuilder',
        mesh,
        traces: makeTraces(['tiny', 'box']),
      };
      const result = evaluateQualityTier(ctx);

      const failedNames = result.gates.filter(g => g.status === 'fail').map(g => g.name);
      expect(failedNames).toContain('bounds_reasonable');
      expect(result.suggestions.some(s => s.action === 'fix_scale')).toBe(true);
    });
  });

  describe('degenerate triangles', () => {
    it('should fail when most triangles are degenerate', () => {
      // Create mesh where all triangles are degenerate (collinear points)
      const verts = [
        new Vertex(new Vec3(0, 0, 0)),
        new Vertex(new Vec3(1, 0, 0)),
        new Vertex(new Vec3(2, 0, 0)),  // collinear
        // Add one normal triangle for volume
        new Vertex(new Vec3(0, 1, 0)),
        new Vertex(new Vec3(0, 0, 1)),
      ];
      const faces = [
        new Face([0, 1, 2]),  // degenerate
        new Face([0, 1, 2]),  // degenerate
        new Face([0, 1, 2]),  // degenerate
        new Face([0, 1, 2]),  // degenerate
        new Face([0, 1, 2]),  // degenerate
        new Face([0, 1, 2]),  // degenerate
        new Face([0, 1, 2]),  // degenerate
        new Face([0, 1, 2]),  // degenerate
        new Face([0, 1, 2]),  // degenerate
        new Face([0, 3, 4]),  // valid
      ];
      const mesh = new Mesh(verts, faces);
      const ctx: ValidationContext = {
        builderName: 'DegenerateBuilder',
        mesh,
        traces: makeTraces(['degen', 'valid']),
      };
      const result = evaluateQualityTier(ctx);

      const failedNames = result.gates.filter(g => g.status === 'fail').map(g => g.name);
      expect(failedNames).toContain('degenerate_ratio');
    });
  });

  // A2-002: New Tier 2 gates
  describe('min faces per part (A2-002)', () => {
    it('should fail when a part has fewer than 6 faces', () => {
      // Create mesh with one part having only 2 faces
      const verts = [
        new Vertex(new Vec3(0, 0, 0)),
        new Vertex(new Vec3(1, 0, 0)),
        new Vertex(new Vec3(1, 1, 0)),
        new Vertex(new Vec3(0, 1, 0)),
        new Vertex(new Vec3(0, 0, 1)),
        new Vertex(new Vec3(1, 0, 1)),
        new Vertex(new Vec3(1, 1, 1)),
        new Vertex(new Vec3(0, 1, 1)),
      ];
      // Full box = 6 faces
      const faces = [
        new Face([0, 1, 2, 3]),
        new Face([4, 7, 6, 5]),
        new Face([0, 4, 5, 1]),
        new Face([2, 6, 7, 3]),
        new Face([0, 3, 7, 4]),
        new Face([1, 5, 6, 2]),
      ];
      const mesh = new Mesh(verts, faces);
      // Create traces where "back" group only has 2 faces (should fail)
      const traces = new Map<string, any>();
      traces.set('face:seat_top', { type: 'face', name: 'seat_top' });
      traces.set('face:seat_bottom', { type: 'face', name: 'seat_bottom' });
      traces.set('face:seat_left', { type: 'face', name: 'seat_left' });
      traces.set('face:seat_right', { type: 'face', name: 'seat_right' });
      traces.set('face:seat_front', { type: 'face', name: 'seat_front' });
      traces.set('face:seat_back', { type: 'face', name: 'seat_back' }); // 6 faces for seat - OK
      traces.set('face:back_panel', { type: 'face', name: 'back_panel' }); // only 1 face for back - FAIL

      const ctx: ValidationContext = {
        builderName: 'UnderFacedBuilder',
        mesh,
        traces,
      };
      const result = evaluateQualityTier(ctx, 2);

      const failedGate = result.gates.find(g => g.name === 'min_faces_per_part');
      expect(failedGate).toBeDefined();
      expect(failedGate?.status).toBe('fail');
      expect(failedGate?.detail).toContain('back');

      // Should have actionable suggestion
      const suggestion = result.suggestions.find(s => s.target === 'back');
      expect(suggestion).toBeDefined();
      expect(suggestion?.reason).toContain('1 face');
      expect(suggestion?.reason).toContain('≥6');
    });

    it('should pass when all parts have 6+ faces', () => {
      // makeMultiPartMesh creates 6 faces per part
      const { mesh, traces } = makeMultiPartMesh(3);
      const ctx: ValidationContext = {
        builderName: 'WellFacedBuilder',
        mesh,
        traces,
      };
      const result = evaluateQualityTier(ctx, 2);

      const gate = result.gates.find(g => g.name === 'min_faces_per_part');
      expect(gate).toBeDefined();
      expect(gate?.status).toBe('pass');
    });
  });

  describe('closed mesh (A2-002)', () => {
    it('should pass for a closed cube', () => {
      // A cube has all edges shared by exactly 2 faces
      const { mesh, traces } = makeMultiPartMesh(1);
      const ctx: ValidationContext = {
        builderName: 'ClosedCube',
        mesh,
        traces,
      };
      const result = evaluateQualityTier(ctx, 2);

      const gate = result.gates.find(g => g.name === 'closed_mesh');
      expect(gate).toBeDefined();
      expect(gate?.status).toBe('pass');
      expect(gate?.detail).toContain('100%');
    });

    it('should fail for an open mesh (single quad)', () => {
      // A single quad has 4 boundary edges - 0% closed
      const verts = [
        new Vertex(new Vec3(0, 0, 0)),
        new Vertex(new Vec3(1, 0, 0)),
        new Vertex(new Vec3(1, 1, 0)),
        new Vertex(new Vec3(0, 1, 0)),
      ];
      const faces = [new Face([0, 1, 2, 3])];
      const mesh = new Mesh(verts, faces);
      const traces = new Map<string, any>();
      // Add enough traces to pass other tier 2 gates
      for (let i = 0; i < 8; i++) {
        traces.set(`face:part${i}_face`, { type: 'face', name: `part${i}_face` });
      }

      const ctx: ValidationContext = {
        builderName: 'OpenQuad',
        mesh,
        traces,
      };
      const result = evaluateQualityTier(ctx, 2);

      const gate = result.gates.find(g => g.name === 'closed_mesh');
      expect(gate).toBeDefined();
      expect(gate?.status).toBe('fail');
      expect(gate?.detail).toContain('0%');

      // Should have suggestion
      const suggestion = result.suggestions.find(s => s.action === 'close_mesh');
      expect(suggestion).toBeDefined();
      expect(suggestion?.metric).toBe('closed_edge_percent');
    });
  });

  describe('decision coverage gate (A3-002)', () => {
    it('should pass when coverage is >= 90%', () => {
      const twoColors = [{ r: 0.8, g: 0.5, b: 0.2 }, { r: 0.4, g: 0.6, b: 0.8 }, { r: 0.9, g: 0.3, b: 0.1 }];
      const { mesh, traces } = makeMultiPartMesh(3, twoColors); // 3 parts, different colors
      const ctx: ValidationContext = {
        builderName: 'TestBuilder',
        mesh,
        traces,
        decisionCoverageReport: {
          builderName: 'TestBuilder',
          totalDecisions: 10,
          covered: 9,
          uncovered: 1,
          partial: 0,
          errors: 0,
          coveragePercent: 90,
          decisions: [],
          seed: 42
        }
      };
      const result = evaluateQualityTier(ctx, 2);

      const gate = result.gates.find(g => g.name === 'decision_coverage');
      expect(gate).toBeDefined();
      expect(gate?.status).toBe('pass');
      expect(gate?.detail).toContain('90%');
    });

    it('should fail when coverage is < 90%', () => {
      const twoColors = [{ r: 0.8, g: 0.5, b: 0.2 }, { r: 0.4, g: 0.6, b: 0.8 }, { r: 0.9, g: 0.3, b: 0.1 }];
      const { mesh, traces } = makeMultiPartMesh(3, twoColors);
      const ctx: ValidationContext = {
        builderName: 'TestBuilder',
        mesh,
        traces,
        decisionCoverageReport: {
          builderName: 'TestBuilder',
          totalDecisions: 10,
          covered: 5,
          uncovered: 5,
          partial: 0,
          errors: 0,
          coveragePercent: 50,
          decisions: [
            { name: 'unused_decision', type: 'choice', status: 'uncovered', notes: 'All options produce identical geometry' }
          ],
          seed: 42
        }
      };
      const result = evaluateQualityTier(ctx, 2);

      const gate = result.gates.find(g => g.name === 'decision_coverage');
      expect(gate).toBeDefined();
      expect(gate?.status).toBe('fail');
      expect(gate?.detail).toContain('50%');

      // Should have suggestions for uncovered decisions
      const suggestion = result.suggestions.find(s => s.action === 'implement_decision');
      expect(suggestion).toBeDefined();
      expect(suggestion?.target).toBe('unused_decision');
    });

    it('should skip gate when no coverage report provided', () => {
      const twoColors = [{ r: 0.8, g: 0.5, b: 0.2 }, { r: 0.4, g: 0.6, b: 0.8 }, { r: 0.9, g: 0.3, b: 0.1 }];
      const { mesh, traces } = makeMultiPartMesh(3, twoColors);
      const ctx: ValidationContext = {
        builderName: 'TestBuilder',
        mesh,
        traces,
        // No decisionCoverageReport
      };
      const result = evaluateQualityTier(ctx, 2);

      const gate = result.gates.find(g => g.name === 'decision_coverage');
      // Gate should not be added when no coverage report is provided
      expect(gate).toBeUndefined();
    });

    it('should add suggestions for partial coverage decisions', () => {
      const twoColors = [{ r: 0.8, g: 0.5, b: 0.2 }, { r: 0.4, g: 0.6, b: 0.8 }, { r: 0.9, g: 0.3, b: 0.1 }];
      const { mesh, traces } = makeMultiPartMesh(3, twoColors);
      const ctx: ValidationContext = {
        builderName: 'TestBuilder',
        mesh,
        traces,
        decisionCoverageReport: {
          builderName: 'TestBuilder',
          totalDecisions: 4,
          covered: 1,
          uncovered: 2,
          partial: 1,
          errors: 0,
          coveragePercent: 25,
          decisions: [
            { name: 'covered_decision', type: 'boolean', status: 'covered' },
            { name: 'uncovered_decision', type: 'choice', status: 'uncovered', notes: 'All options identical' },
            { name: 'partial_decision', type: 'choice', status: 'partial', notes: '2/4 options differ' },
            { name: 'another_uncovered', type: 'number', status: 'uncovered' }
          ],
          seed: 42
        }
      };
      const result = evaluateQualityTier(ctx, 2);

      // Should have implement_decision suggestions for uncovered
      const implementSuggestions = result.suggestions.filter(s => s.action === 'implement_decision');
      expect(implementSuggestions.length).toBe(2);
      expect(implementSuggestions.map(s => s.target)).toContain('uncovered_decision');
      expect(implementSuggestions.map(s => s.target)).toContain('another_uncovered');

      // Should have complete_decision suggestion for partial
      const completeSuggestion = result.suggestions.find(s => s.action === 'complete_decision');
      expect(completeSuggestion).toBeDefined();
      expect(completeSuggestion?.target).toBe('partial_decision');
    });
  });
});
