/**
 * Decision Coverage Test (A3-001)
 *
 * Tests the decision coverage testing functionality:
 * - testDecisionCoverage() function runs builder with each decision option
 * - Compares mesh vertex/face counts between options
 * - Returns per-decision coverage report (covered/uncovered/partial)
 */

import { describe, it, expect } from '@jest/globals';
import { testDecisionCoverage } from '../../generation/validation/ValidationAPI';
import { Mesh } from '../../platform/geometry/Mesh';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { Vec3 } from '../../platform/math/Vec3';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Create a simple box mesh (6 faces, 8 vertices) at given size */
function makeBox(w: number, h: number, d: number): Mesh {
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
  const faces = [
    new Face([0, 1, 2, 3]),  // front
    new Face([5, 4, 7, 6]),  // back
    new Face([4, 0, 3, 7]),  // left
    new Face([1, 5, 6, 2]),  // right
    new Face([3, 2, 6, 7]),  // top
    new Face([4, 5, 1, 0]),  // bottom
  ];
  return new Mesh(verts, faces);
}

/** Create a mock YAML definition with decisions */
function mockYamlDefinition(decisions: Record<string, any>): any {
  return {
    name: 'TestBuilder',
    decisions
  };
}

describe('Decision Coverage (A3-001)', () => {
  describe('testDecisionCoverage function', () => {
    it('should detect covered choice decisions that produce different geometry', async () => {
      // Mock definition with a choice decision
      const definition = mockYamlDefinition({
        box_type: {
          type: 'choice',
          options: ['small', 'medium', 'large']
        }
      });

      // Mock executor that produces different geometry for different options
      // We use different numbers of boxes since all boxes have same vertex/face count
      const executeBuilder = async (overrides: Record<string, any>) => {
        const boxType = overrides.box_type ?? 'small';
        const boxCount = boxType === 'small' ? 1 : (boxType === 'medium' ? 2 : 3);
        const allVerts: Vertex[] = [];
        const allFaces: Face[] = [];
        for (let i = 0; i < boxCount; i++) {
          const box = makeBox(0.5, 0.5, 0.5);
          allVerts.push(...box.vertices);
          allFaces.push(...box.faces);
        }
        return { mesh: { vertices: allVerts, faces: allFaces } };
      };

      const report = await testDecisionCoverage(definition, executeBuilder, 42);

      expect(report.builderName).toBe('TestBuilder');
      expect(report.totalDecisions).toBe(1);

      // box_type should be covered (different box counts produce different vertex/face counts)
      const boxType = report.decisions.find(d => d.name === 'box_type');
      expect(boxType).toBeDefined();
      expect(boxType!.status).toBe('covered');
      expect(boxType!.optionResults).toBeDefined();
      expect(boxType!.optionResults!.length).toBe(3);
    });

    it('should detect uncovered decisions that produce identical geometry', async () => {
      // Mock definition with a decision that doesn't affect geometry
      const definition = mockYamlDefinition({
        style: {
          type: 'choice',
          options: ['modern', 'classic', 'vintage']
        }
      });

      // Mock executor that always produces the same geometry
      const executeBuilder = async (_overrides: Record<string, any>) => {
        return { mesh: makeBox(0.5, 0.5, 0.5) };
      };

      const report = await testDecisionCoverage(definition, executeBuilder, 42);

      expect(report.builderName).toBe('TestBuilder');

      // style decision doesn't affect geometry - should be uncovered
      const style = report.decisions.find(d => d.name === 'style');
      expect(style).toBeDefined();
      expect(style!.status).toBe('uncovered');
      expect(style!.notes).toContain('identical geometry');
    });

    it('should test boolean decisions correctly', async () => {
      const definition = mockYamlDefinition({
        has_top: {
          type: 'boolean',
          probability: 0.5
        }
      });

      // Mock executor: true = 2 boxes (12 faces), false = 1 box (6 faces)
      const executeBuilder = async (overrides: Record<string, any>) => {
        const hasTop = overrides.has_top ?? false;
        if (hasTop) {
          // Two boxes merged
          const mesh1 = makeBox(0.5, 0.5, 0.5);
          const mesh2 = makeBox(0.5, 0.1, 0.5);
          return {
            mesh: {
              vertices: [...mesh1.vertices, ...mesh2.vertices],
              faces: [...mesh1.faces, ...mesh2.faces]
            }
          };
        } else {
          return { mesh: makeBox(0.5, 0.5, 0.5) };
        }
      };

      const report = await testDecisionCoverage(definition, executeBuilder, 42);

      // has_top should be covered (adds geometry when true)
      const hasTop = report.decisions.find(d => d.name === 'has_top');
      expect(hasTop).toBeDefined();
      expect(hasTop!.type).toBe('boolean');
      expect(hasTop!.status).toBe('covered');
      expect(hasTop!.optionResults).toHaveLength(2);

      // Verify different face counts for true vs false
      const trueResult = hasTop!.optionResults!.find(r => r.value === true);
      const falseResult = hasTop!.optionResults!.find(r => r.value === false);
      expect(trueResult!.faceCount).toBeGreaterThan(falseResult!.faceCount);
    });

    it('should test count decisions correctly', async () => {
      const definition = mockYamlDefinition({
        column_count: {
          type: 'count',
          min: 2,
          max: 6
        }
      });

      // Mock executor: more columns = more geometry
      const executeBuilder = async (overrides: Record<string, any>) => {
        const count = overrides.column_count ?? 2;
        const boxes = [];
        for (let i = 0; i < count; i++) {
          const box = makeBox(0.1, 0.5, 0.1);
          boxes.push(box);
        }
        // Merge all meshes
        const allVerts: Vertex[] = [];
        const allFaces: Face[] = [];
        for (const box of boxes) {
          allVerts.push(...box.vertices);
          allFaces.push(...box.faces);
        }
        return { mesh: { vertices: allVerts, faces: allFaces } };
      };

      const report = await testDecisionCoverage(definition, executeBuilder, 42);

      // column_count should be covered (different counts = different geometry)
      const columnCount = report.decisions.find(d => d.name === 'column_count');
      expect(columnCount).toBeDefined();
      expect(columnCount!.type).toBe('count');
      expect(columnCount!.status).toBe('covered');
      expect(columnCount!.optionResults).toBeDefined();
      expect(columnCount!.optionResults!.length).toBeGreaterThan(0);
    });

    it('should test number decisions correctly', async () => {
      const definition = mockYamlDefinition({
        intensity: {
          type: 'number',
          min: 0.0,
          max: 1.0
        }
      });

      // Mock executor: number doesn't affect geometry
      const executeBuilder = async (_overrides: Record<string, any>) => {
        return { mesh: makeBox(0.5, 0.5, 0.5) };
      };

      const report = await testDecisionCoverage(definition, executeBuilder, 42);

      // intensity doesn't affect geometry - should be uncovered
      const intensity = report.decisions.find(d => d.name === 'intensity');
      expect(intensity).toBeDefined();
      expect(intensity!.type).toBe('number');
      expect(intensity!.status).toBe('uncovered');
    });

    it('should calculate coverage percentage correctly', async () => {
      const definition = mockYamlDefinition({
        covered_choice: {
          type: 'choice',
          options: ['a', 'b']
        },
        uncovered_choice: {
          type: 'choice',
          options: ['x', 'y']
        }
      });

      // Mock executor: only covered_choice affects geometry (different box counts)
      const executeBuilder = async (overrides: Record<string, any>) => {
        const covered = overrides.covered_choice ?? 'a';
        const boxCount = covered === 'a' ? 1 : 2;
        const allVerts: Vertex[] = [];
        const allFaces: Face[] = [];
        for (let i = 0; i < boxCount; i++) {
          const box = makeBox(0.5, 0.5, 0.5);
          allVerts.push(...box.vertices);
          allFaces.push(...box.faces);
        }
        return { mesh: { vertices: allVerts, faces: allFaces } };
      };

      const report = await testDecisionCoverage(definition, executeBuilder, 42);

      // 1 covered, 1 uncovered = 50%
      expect(report.totalDecisions).toBe(2);
      expect(report.covered).toBe(1);
      expect(report.uncovered).toBe(1);
      expect(report.coveragePercent).toBe(50);
    });

    it('should handle builders with no decisions', async () => {
      const definition = mockYamlDefinition({});

      const executeBuilder = async (_overrides: Record<string, any>) => {
        return { mesh: makeBox(0.5, 0.5, 0.5) };
      };

      const report = await testDecisionCoverage(definition, executeBuilder, 42);

      expect(report.totalDecisions).toBe(0);
      expect(report.covered).toBe(0);
      expect(report.uncovered).toBe(0);
      expect(report.coveragePercent).toBe(0);
      expect(report.decisions).toHaveLength(0);
    });

    it('should detect partial coverage when some options differ', async () => {
      const definition = mockYamlDefinition({
        style: {
          type: 'choice',
          options: ['a', 'b', 'c', 'd']
        }
      });

      // Mock executor: 'a' and 'b' produce same geometry (1 box), 'c' gets 2 boxes, 'd' gets 3 boxes
      const executeBuilder = async (overrides: Record<string, any>) => {
        const style = overrides.style ?? 'a';
        let boxCount = 1;
        if (style === 'c') boxCount = 2;
        if (style === 'd') boxCount = 3;
        const allVerts: Vertex[] = [];
        const allFaces: Face[] = [];
        for (let i = 0; i < boxCount; i++) {
          const box = makeBox(0.5, 0.5, 0.5);
          allVerts.push(...box.vertices);
          allFaces.push(...box.faces);
        }
        return { mesh: { vertices: allVerts, faces: allFaces } };
      };

      const report = await testDecisionCoverage(definition, executeBuilder, 42);

      // Only 3 distinct geometry outputs for 4 options - partial coverage
      const style = report.decisions.find(d => d.name === 'style');
      expect(style).toBeDefined();
      expect(style!.status).toBe('partial');
    });
  });

  describe('Coverage report structure', () => {
    it('should include all required fields in the report', async () => {
      const definition = mockYamlDefinition({
        test_choice: {
          type: 'choice',
          options: ['a', 'b']
        }
      });

      const executeBuilder = async (_overrides: Record<string, any>) => {
        return { mesh: makeBox(0.5, 0.5, 0.5) };
      };

      const report = await testDecisionCoverage(definition, executeBuilder, 42);

      // Check report structure
      expect(report).toHaveProperty('builderName');
      expect(report).toHaveProperty('totalDecisions');
      expect(report).toHaveProperty('covered');
      expect(report).toHaveProperty('uncovered');
      expect(report).toHaveProperty('partial');
      expect(report).toHaveProperty('errors');
      expect(report).toHaveProperty('coveragePercent');
      expect(report).toHaveProperty('decisions');
      expect(report).toHaveProperty('seed');

      // Check decision item structure
      const decision = report.decisions[0];
      expect(decision).toHaveProperty('name');
      expect(decision).toHaveProperty('type');
      expect(decision).toHaveProperty('status');
      expect(['covered', 'uncovered', 'partial', 'error']).toContain(decision.status);
    });

    it('should include option results with vertex/face counts', async () => {
      const definition = mockYamlDefinition({
        style: {
          type: 'choice',
          options: ['a', 'b', 'c']
        }
      });

      // Use different box counts so we get different vertex/face counts
      const executeBuilder = async (overrides: Record<string, any>) => {
        const style = overrides.style ?? 'a';
        const boxCount = style === 'a' ? 1 : (style === 'b' ? 2 : 3);
        const allVerts: Vertex[] = [];
        const allFaces: Face[] = [];
        for (let i = 0; i < boxCount; i++) {
          const box = makeBox(0.5, 0.5, 0.5);
          allVerts.push(...box.vertices);
          allFaces.push(...box.faces);
        }
        return { mesh: { vertices: allVerts, faces: allFaces } };
      };

      const report = await testDecisionCoverage(definition, executeBuilder, 42);

      const style = report.decisions.find(d => d.name === 'style');
      expect(style).toBeDefined();
      expect(style!.optionResults).toBeDefined();

      for (const result of style!.optionResults!) {
        expect(result).toHaveProperty('value');
        expect(result).toHaveProperty('vertexCount');
        expect(result).toHaveProperty('faceCount');
        expect(result).toHaveProperty('differs');
        expect(typeof result.vertexCount).toBe('number');
        expect(typeof result.faceCount).toBe('number');
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle executor errors gracefully', async () => {
      const definition = mockYamlDefinition({
        error_choice: {
          type: 'choice',
          options: ['good', 'bad']
        }
      });

      let callCount = 0;
      const executeBuilder = async (overrides: Record<string, any>) => {
        callCount++;
        if (callCount > 2 && overrides.error_choice === 'bad') {
          throw new Error('Simulated error');
        }
        return { mesh: makeBox(0.5, 0.5, 0.5) };
      };

      // Should not throw, but return report with error info
      const report = await testDecisionCoverage(definition, executeBuilder, 42);
      expect(report).toBeDefined();
      expect(report.decisions.length).toBe(1);
    });

    it('should handle baseline failure', async () => {
      const definition = mockYamlDefinition({
        test: {
          type: 'choice',
          options: ['a', 'b']
        }
      });

      const executeBuilder = async (_overrides: Record<string, any>) => {
        throw new Error('Baseline failed');
      };

      const report = await testDecisionCoverage(definition, executeBuilder, 42);

      expect(report.errors).toBe(1);
      expect(report.decisions[0].status).toBe('error');
      expect(report.decisions[0].error).toContain('Baseline failed');
    });
  });
});
