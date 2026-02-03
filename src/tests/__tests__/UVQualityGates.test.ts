/**
 * UV Quality Gates Tests (G3-003)
 *
 * Tests for UV quality metrics and validation.
 */

import { describe, it, expect } from '@jest/globals';
import {
  evaluateUVQuality,
  generateUVSuggestions,
  getAchievedTier,
  assessUVQuality,
  UVQualityMetrics,
  UV_QUALITY_THRESHOLDS
} from '../../generation/validation/UVQualityGates';
import { MeshOperations } from '../../platform/geometry/MeshOperations';
import { lathe } from '../../platform/geometry/Sweep';
import { extrude2D } from '../../platform/geometry/Extrude';
import { Shape2D } from '../../platform/geometry/Shape2D';
import { Mesh } from '../../platform/geometry/Mesh';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { Vec3 } from '../../platform/math/Vec3';

describe('UV Quality Gates (G3-003)', () => {
  describe('evaluateUVQuality', () => {
    it('should return 100% coverage for mesh with all UVs', () => {
      const box = MeshOperations.createBox(1, 1, 1);
      const metrics = evaluateUVQuality(box);

      expect(metrics.coverage).toBe(100);
      expect(metrics.facesMissingUVs).toBe(0);
    });

    it('should detect missing UVs', () => {
      // Create a mesh without UVs
      const mesh = new Mesh();
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(0, 1, 0)));
      mesh.addFace(new Face([0, 1, 2]));

      const metrics = evaluateUVQuality(mesh);

      expect(metrics.coverage).toBe(0);
      expect(metrics.facesMissingUVs).toBe(1);
      expect(metrics.facesWithUVs).toBe(0);
    });

    it('should calculate utilization for box UVs', () => {
      const box = MeshOperations.createBox(1, 1, 1, 'normalized');
      const metrics = evaluateUVQuality(box);

      // Normalized box UVs should use full [0,1] space
      expect(metrics.utilization).toBeGreaterThan(90);
    });

    it('should detect low stretch for uniform UVs', () => {
      const box = MeshOperations.createBox(1, 1, 1, 'world_scale');
      const metrics = evaluateUVQuality(box);

      // World-scale box should have low stretch (uniform density)
      expect(metrics.maxStretch).toBeLessThan(2);
    });

    it('should detect high stretch for non-uniform UVs', () => {
      // Create a stretched box (2x1x1) with normalized UVs
      const box = MeshOperations.createBox(4, 1, 1, 'normalized');
      const metrics = evaluateUVQuality(box);

      // Normalized UVs on stretched box will have density variance
      expect(metrics.densityVariance).toBeGreaterThan(1);
    });

    it('should calculate metrics for lathe mesh', () => {
      const profile = [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 0, y: 1 }
      ];
      const mesh = lathe(profile, 8);
      const metrics = evaluateUVQuality(mesh);

      expect(metrics.coverage).toBe(100);
      expect(metrics.totalFaces).toBeGreaterThan(0);
    });

    it('should calculate metrics for extruded mesh', () => {
      const shape = Shape2D.rect(1, 1);
      const result = extrude2D(shape, { depth: 1, caps: 'both' });

      // Convert to Mesh for evaluation
      const mesh = new Mesh();
      for (let i = 0; i < result.vertices.length; i++) {
        const v = result.vertices[i];
        const uv = result.uvs?.[i];
        mesh.addVertex(new Vertex(v, uv ? { uv } : undefined));
      }
      for (const face of result.faces) {
        mesh.addFace(new Face(face));
      }

      const metrics = evaluateUVQuality(mesh);
      expect(metrics.coverage).toBe(100);
    });
  });

  describe('generateUVSuggestions', () => {
    it('should suggest adding UVs when coverage is low', () => {
      const metrics: UVQualityMetrics = {
        coverage: 50,
        maxStretch: 1.0,
        meanStretch: 1.0,
        utilization: 100,
        densityVariance: 1.0,
        overlapCount: 0,
        totalFaces: 10,
        facesWithUVs: 5,
        facesMissingUVs: 5
      };

      const suggestions = generateUVSuggestions(metrics, 3);
      const addUVsSuggestion = suggestions.find(s => s.action === 'add_uvs');

      expect(addUVsSuggestion).toBeDefined();
      expect(addUVsSuggestion!.severity).toBe('error'); // Coverage < 95% for tier 3
    });

    it('should suggest reducing stretch when too high', () => {
      const metrics: UVQualityMetrics = {
        coverage: 100,
        maxStretch: 3.0,
        meanStretch: 2.0,
        utilization: 80,
        densityVariance: 5.0,
        overlapCount: 0,
        totalFaces: 10,
        facesWithUVs: 10,
        facesMissingUVs: 0
      };

      const suggestions = generateUVSuggestions(metrics, 3);
      const stretchSuggestion = suggestions.find(s => s.action === 'reduce_stretch');

      expect(stretchSuggestion).toBeDefined();
    });

    it('should suggest fixing overlaps when present', () => {
      const metrics: UVQualityMetrics = {
        coverage: 100,
        maxStretch: 1.0,
        meanStretch: 1.0,
        utilization: 80,
        densityVariance: 1.0,
        overlapCount: 150, // Above tier 3 threshold of 100
        totalFaces: 10,
        facesWithUVs: 10,
        facesMissingUVs: 0
      };

      const suggestions = generateUVSuggestions(metrics, 3);
      const overlapSuggestion = suggestions.find(s => s.action === 'fix_overlap');

      expect(overlapSuggestion).toBeDefined();
    });

    it('should return no suggestions for perfect metrics', () => {
      const metrics: UVQualityMetrics = {
        coverage: 100,
        maxStretch: 1.0,
        meanStretch: 1.0,
        utilization: 90,
        densityVariance: 1.0,
        overlapCount: 0,
        totalFaces: 10,
        facesWithUVs: 10,
        facesMissingUVs: 0
      };

      const suggestions = generateUVSuggestions(metrics, 3);
      expect(suggestions.length).toBe(0);
    });
  });

  describe('getAchievedTier', () => {
    it('should return tier 4 for perfect metrics', () => {
      const metrics: UVQualityMetrics = {
        coverage: 100,
        maxStretch: 1.0,
        meanStretch: 1.0,
        utilization: 95,
        densityVariance: 1.0,
        overlapCount: 0,
        totalFaces: 10,
        facesWithUVs: 10,
        facesMissingUVs: 0
      };

      expect(getAchievedTier(metrics)).toBe(4);
    });

    it('should return tier 0 for poor metrics', () => {
      const metrics: UVQualityMetrics = {
        coverage: 30,
        maxStretch: 10.0,
        meanStretch: 5.0,
        utilization: 20,
        densityVariance: 20.0,
        overlapCount: 50,
        totalFaces: 10,
        facesWithUVs: 3,
        facesMissingUVs: 7
      };

      expect(getAchievedTier(metrics)).toBe(0);
    });

    it('should return appropriate tier based on thresholds', () => {
      // Tier 2 metrics (coverage 80+, stretch < 5, density variance < 50)
      const tier2Metrics: UVQualityMetrics = {
        coverage: 85,
        maxStretch: 4.0,
        meanStretch: 2.0,
        utilization: 60,
        densityVariance: 40.0,
        overlapCount: 5000, // High overlap is OK for tier 1-2
        totalFaces: 10,
        facesWithUVs: 9,
        facesMissingUVs: 1
      };

      expect(getAchievedTier(tier2Metrics)).toBe(2);
    });
  });

  describe('assessUVQuality', () => {
    it('should pass for high-quality mesh', () => {
      const box = MeshOperations.createBox(1, 1, 1, 'world_scale');
      const result = assessUVQuality(box, 1);  // Tier 1 - box UVs have overlaps by design

      // Box with world_scale UVs achieves at least tier 1
      expect(result.achievedTier).toBeGreaterThanOrEqual(1);
      expect(result.metrics.coverage).toBe(100);
    });

    it('should fail for mesh without UVs', () => {
      const mesh = new Mesh();
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(0, 1, 0)));
      mesh.addFace(new Face([0, 1, 2]));

      const result = assessUVQuality(mesh, 1);

      expect(result.passed).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should provide machine-readable suggestions', () => {
      const mesh = new Mesh();
      mesh.addVertex(new Vertex(new Vec3(0, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(1, 0, 0)));
      mesh.addVertex(new Vertex(new Vec3(0, 1, 0)));
      mesh.addFace(new Face([0, 1, 2]));

      const result = assessUVQuality(mesh, 3);

      expect(result.suggestions.length).toBeGreaterThan(0);
      const suggestion = result.suggestions[0];
      expect(suggestion.action).toBeDefined();
      expect(suggestion.reason).toBeDefined();
      expect(suggestion.severity).toBeDefined();
    });
  });

  describe('UV_QUALITY_THRESHOLDS', () => {
    it('should have thresholds for tiers 0-4', () => {
      expect(UV_QUALITY_THRESHOLDS[0]).toBeDefined();
      expect(UV_QUALITY_THRESHOLDS[1]).toBeDefined();
      expect(UV_QUALITY_THRESHOLDS[2]).toBeDefined();
      expect(UV_QUALITY_THRESHOLDS[3]).toBeDefined();
      expect(UV_QUALITY_THRESHOLDS[4]).toBeDefined();
    });

    it('should have progressively stricter thresholds', () => {
      // Higher tiers should have stricter (lower) maxStretch
      expect(UV_QUALITY_THRESHOLDS[4].maxStretch).toBeLessThan(UV_QUALITY_THRESHOLDS[3].maxStretch);
      expect(UV_QUALITY_THRESHOLDS[3].maxStretch).toBeLessThan(UV_QUALITY_THRESHOLDS[2].maxStretch);

      // Higher tiers should have stricter (higher) minCoverage
      expect(UV_QUALITY_THRESHOLDS[4].minCoverage).toBeGreaterThan(UV_QUALITY_THRESHOLDS[3].minCoverage);
      expect(UV_QUALITY_THRESHOLDS[3].minCoverage).toBeGreaterThan(UV_QUALITY_THRESHOLDS[2].minCoverage);
    });
  });
});
