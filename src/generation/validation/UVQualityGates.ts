/**
 * UV Quality Gates (G3-003)
 *
 * Metrics and validation for UV quality assessment.
 * Provides machine-readable metrics and suggestions for improving UV quality.
 */

import { Mesh } from '../../platform/geometry/Mesh';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { Vec3 } from '../../platform/math/Vec3';

/**
 * UV quality metrics for a mesh
 */
export interface UVQualityMetrics {
  /** Percentage of faces with valid UVs (0-100) */
  coverage: number;
  /** Maximum UV stretch ratio (1.0 = no stretch, >1 = stretched) */
  maxStretch: number;
  /** Mean UV stretch ratio across all faces */
  meanStretch: number;
  /** Percentage of [0,1] UV space utilized (0-100) */
  utilization: number;
  /** Ratio of max to min texel density (1.0 = uniform, higher = more variance) */
  densityVariance: number;
  /** Count of overlapping UV triangles */
  overlapCount: number;
  /** Total number of faces analyzed */
  totalFaces: number;
  /** Number of faces with valid UVs */
  facesWithUVs: number;
  /** Number of faces missing UVs */
  facesMissingUVs: number;
}

/**
 * Machine-readable suggestion for UV improvement
 */
export interface UVQualitySuggestion {
  /** Action to take */
  action: 'add_uvs' | 'reduce_stretch' | 'improve_packing' | 'fix_overlap' | 'normalize_density';
  /** Target of the action (e.g., face indices, UV island) */
  target?: string;
  /** Human-readable reason */
  reason: string;
  /** Severity: error (blocking), warning (quality issue), info (suggestion) */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Complete UV quality assessment result
 */
export interface UVQualityResult {
  /** Computed metrics */
  metrics: UVQualityMetrics;
  /** Pass/fail status */
  passed: boolean;
  /** List of suggestions for improvement */
  suggestions: UVQualitySuggestion[];
  /** Quality tier achieved (0-4, or -1 if failed basic validation) */
  achievedTier: number;
}

/**
 * Quality thresholds for different tiers
 */
export interface UVQualityThresholds {
  /** Minimum coverage percentage */
  minCoverage: number;
  /** Maximum allowed stretch ratio */
  maxStretch: number;
  /** Maximum allowed density variance */
  maxDensityVariance: number;
  /** Maximum allowed overlap count */
  maxOverlap: number;
}

/**
 * Default thresholds per quality tier
 *
 * Note: Overlap counts are high for meshes using per-part UV mapping
 * (each part uses [0,1]×[0,1]) which is expected until G3-002 (smart unwrapping).
 * The overlap threshold is set high to avoid false positives.
 */
export const UV_QUALITY_THRESHOLDS: Record<number, UVQualityThresholds> = {
  0: { minCoverage: 0, maxStretch: Infinity, maxDensityVariance: Infinity, maxOverlap: Infinity },
  1: { minCoverage: 50, maxStretch: 10.0, maxDensityVariance: 100.0, maxOverlap: Infinity },
  2: { minCoverage: 80, maxStretch: 5.0, maxDensityVariance: 50.0, maxOverlap: Infinity },
  3: { minCoverage: 95, maxStretch: 2.0, maxDensityVariance: 10.0, maxOverlap: 100 },
  4: { minCoverage: 100, maxStretch: 1.5, maxDensityVariance: 5.0, maxOverlap: 0 }
};

/**
 * Calculate the 2D area of a triangle in UV space
 */
function calculateUVTriangleArea(uv0: [number, number], uv1: [number, number], uv2: [number, number]): number {
  const u1 = uv1[0] - uv0[0];
  const v1 = uv1[1] - uv0[1];
  const u2 = uv2[0] - uv0[0];
  const v2 = uv2[1] - uv0[1];
  return Math.abs(u1 * v2 - u2 * v1) / 2;
}

/**
 * Calculate the 3D area of a triangle in world space
 */
function calculate3DTriangleArea(p0: Vec3, p1: Vec3, p2: Vec3): number {
  const v1 = p1.sub(p0);
  const v2 = p2.sub(p0);
  return v1.cross(v2).length() / 2;
}

/**
 * Check if two UV triangles overlap (simplified axis-aligned bounding box test)
 */
function uvTrianglesOverlap(
  t1: [[number, number], [number, number], [number, number]],
  t2: [[number, number], [number, number], [number, number]]
): boolean {
  // Get bounding boxes
  const t1MinU = Math.min(t1[0][0], t1[1][0], t1[2][0]);
  const t1MaxU = Math.max(t1[0][0], t1[1][0], t1[2][0]);
  const t1MinV = Math.min(t1[0][1], t1[1][1], t1[2][1]);
  const t1MaxV = Math.max(t1[0][1], t1[1][1], t1[2][1]);

  const t2MinU = Math.min(t2[0][0], t2[1][0], t2[2][0]);
  const t2MaxU = Math.max(t2[0][0], t2[1][0], t2[2][0]);
  const t2MinV = Math.min(t2[0][1], t2[1][1], t2[2][1]);
  const t2MaxV = Math.max(t2[0][1], t2[1][1], t2[2][1]);

  // AABB overlap test
  if (t1MaxU < t2MinU || t2MaxU < t1MinU) return false;
  if (t1MaxV < t2MinV || t2MaxV < t1MinV) return false;

  // For more accurate overlap detection, we'd need triangle-triangle intersection
  // For now, AABB overlap is a reasonable approximation
  return true;
}

/**
 * Get UV coordinates for a face's vertices
 * Returns null if any vertex is missing UVs
 */
function getFaceUVs(face: Face, vertices: Vertex[]): [number, number][] | null {
  const uvs: [number, number][] = [];
  for (const idx of face.indices) {
    const vertex = vertices[idx];
    if (!vertex.attributes.uv) {
      return null;
    }
    uvs.push(vertex.attributes.uv as [number, number]);
  }
  return uvs;
}

/**
 * Evaluate UV quality metrics for a mesh
 */
export function evaluateUVQuality(mesh: Mesh): UVQualityMetrics {
  const vertices = mesh.vertices;
  const faces = mesh.faces;

  let facesWithUVs = 0;
  let facesMissingUVs = 0;
  const texelDensities: number[] = [];
  const uvTriangles: Array<[[number, number], [number, number], [number, number]]> = [];

  // Track UV bounds for utilization calculation
  let minU = Infinity, maxU = -Infinity;
  let minV = Infinity, maxV = -Infinity;

  // Analyze each face
  for (const face of faces) {
    const faceUVs = getFaceUVs(face, vertices);

    if (!faceUVs) {
      facesMissingUVs++;
      continue;
    }

    facesWithUVs++;

    // Update UV bounds
    for (const [u, v] of faceUVs) {
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }

    // Triangulate face for analysis
    const triangles = face.triangulate();
    for (const tri of triangles) {
      const triUVs = getFaceUVs(tri, vertices);
      if (!triUVs || triUVs.length !== 3) continue;

      // Get 3D positions
      const p0 = vertices[tri.indices[0]].position;
      const p1 = vertices[tri.indices[1]].position;
      const p2 = vertices[tri.indices[2]].position;

      // Calculate areas
      const uvArea = calculateUVTriangleArea(triUVs[0], triUVs[1], triUVs[2]);
      const worldArea = calculate3DTriangleArea(p0, p1, p2);

      // Calculate stretch ratio (ratio of UV area to world area, normalized)
      // A stretch ratio of 1.0 means UV area is proportional to world area
      if (worldArea > 0.00001 && uvArea > 0.00001) {
        // Texel density: UV area per unit world area
        const density = uvArea / worldArea;
        texelDensities.push(density);

        // Store UV triangle for overlap detection
        uvTriangles.push([triUVs[0], triUVs[1], triUVs[2]]);
      }
    }
  }

  // Calculate coverage
  const totalFaces = faces.length;
  const coverage = totalFaces > 0 ? (facesWithUVs / totalFaces) * 100 : 0;

  // Calculate stretch metrics from density variance
  let maxStretch = 1.0;
  let meanStretch = 1.0;
  let densityVariance = 1.0;

  if (texelDensities.length > 0) {
    const minDensity = Math.min(...texelDensities);
    const maxDensity = Math.max(...texelDensities);
    const meanDensity = texelDensities.reduce((a, b) => a + b, 0) / texelDensities.length;

    // Density variance: ratio of max to min density
    densityVariance = minDensity > 0.00001 ? maxDensity / minDensity : Infinity;

    // Stretch is approximated from density variance
    // Higher density variance means more stretch
    maxStretch = Math.sqrt(densityVariance);
    meanStretch = texelDensities.reduce((sum, d) => {
      const ratio = meanDensity > 0 ? d / meanDensity : 1;
      return sum + Math.abs(ratio - 1);
    }, 0) / texelDensities.length + 1;
  }

  // Calculate utilization (percentage of [0,1] space used)
  let utilization = 0;
  if (minU < Infinity && maxU > -Infinity && minV < Infinity && maxV > -Infinity) {
    const usedWidth = Math.min(1, Math.max(0, maxU)) - Math.max(0, Math.min(1, minU));
    const usedHeight = Math.min(1, Math.max(0, maxV)) - Math.max(0, Math.min(1, minV));
    utilization = usedWidth * usedHeight * 100;
  }

  // Count overlapping triangles (O(n²) - could be optimized with spatial hashing)
  let overlapCount = 0;
  for (let i = 0; i < uvTriangles.length; i++) {
    for (let j = i + 1; j < uvTriangles.length; j++) {
      if (uvTrianglesOverlap(uvTriangles[i], uvTriangles[j])) {
        overlapCount++;
      }
    }
  }

  return {
    coverage,
    maxStretch,
    meanStretch,
    utilization,
    densityVariance,
    overlapCount,
    totalFaces,
    facesWithUVs,
    facesMissingUVs
  };
}

/**
 * Generate suggestions based on metrics
 */
export function generateUVSuggestions(metrics: UVQualityMetrics, targetTier: number = 3): UVQualitySuggestion[] {
  const suggestions: UVQualitySuggestion[] = [];
  const thresholds = UV_QUALITY_THRESHOLDS[targetTier] || UV_QUALITY_THRESHOLDS[3];

  // Coverage issues
  if (metrics.coverage < 100) {
    suggestions.push({
      action: 'add_uvs',
      target: `${metrics.facesMissingUVs} faces`,
      reason: `${metrics.facesMissingUVs} faces are missing UV coordinates`,
      severity: metrics.coverage < thresholds.minCoverage ? 'error' : 'warning'
    });
  }

  // Stretch issues
  if (metrics.maxStretch > thresholds.maxStretch) {
    suggestions.push({
      action: 'reduce_stretch',
      reason: `UV stretch ratio of ${metrics.maxStretch.toFixed(2)} exceeds threshold of ${thresholds.maxStretch}`,
      severity: metrics.maxStretch > thresholds.maxStretch * 2 ? 'error' : 'warning'
    });
  }

  // Density variance issues
  if (metrics.densityVariance > thresholds.maxDensityVariance) {
    suggestions.push({
      action: 'normalize_density',
      reason: `Texel density varies by ${metrics.densityVariance.toFixed(2)}x (target: < ${thresholds.maxDensityVariance}x)`,
      severity: 'warning'
    });
  }

  // Overlap issues
  if (metrics.overlapCount > thresholds.maxOverlap) {
    suggestions.push({
      action: 'fix_overlap',
      target: `${metrics.overlapCount} overlaps`,
      reason: `${metrics.overlapCount} UV triangles overlap (target: ${thresholds.maxOverlap})`,
      severity: metrics.overlapCount > 10 ? 'error' : 'warning'
    });
  }

  // Utilization suggestions (info level)
  if (metrics.utilization < 50) {
    suggestions.push({
      action: 'improve_packing',
      reason: `UV space utilization is only ${metrics.utilization.toFixed(1)}% - consider repacking`,
      severity: 'info'
    });
  }

  return suggestions;
}

/**
 * Determine the highest quality tier achieved by the metrics
 */
export function getAchievedTier(metrics: UVQualityMetrics): number {
  for (let tier = 4; tier >= 0; tier--) {
    const thresholds = UV_QUALITY_THRESHOLDS[tier];
    if (
      metrics.coverage >= thresholds.minCoverage &&
      metrics.maxStretch <= thresholds.maxStretch &&
      metrics.densityVariance <= thresholds.maxDensityVariance &&
      metrics.overlapCount <= thresholds.maxOverlap
    ) {
      return tier;
    }
  }
  return -1; // Failed basic validation
}

/**
 * Complete UV quality assessment
 */
export function assessUVQuality(mesh: Mesh, targetTier: number = 3): UVQualityResult {
  const metrics = evaluateUVQuality(mesh);
  const suggestions = generateUVSuggestions(metrics, targetTier);
  const achievedTier = getAchievedTier(metrics);
  const passed = achievedTier >= targetTier;

  return {
    metrics,
    passed,
    suggestions,
    achievedTier
  };
}

/**
 * Format UV quality result for display
 */
export function formatUVQualityResult(result: UVQualityResult): string {
  const lines: string[] = [
    '=== UV Quality Assessment ===',
    '',
    'Metrics:',
    `  Coverage: ${result.metrics.coverage.toFixed(1)}%`,
    `  Max Stretch: ${result.metrics.maxStretch.toFixed(2)}`,
    `  Mean Stretch: ${result.metrics.meanStretch.toFixed(2)}`,
    `  Utilization: ${result.metrics.utilization.toFixed(1)}%`,
    `  Density Variance: ${result.metrics.densityVariance.toFixed(2)}x`,
    `  Overlaps: ${result.metrics.overlapCount}`,
    '',
    `Achieved Tier: ${result.achievedTier}`,
    `Status: ${result.passed ? 'PASSED' : 'FAILED'}`,
  ];

  if (result.suggestions.length > 0) {
    lines.push('', 'Suggestions:');
    for (const suggestion of result.suggestions) {
      const icon = suggestion.severity === 'error' ? '❌' : suggestion.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`  ${icon} ${suggestion.reason}`);
    }
  }

  return lines.join('\n');
}
