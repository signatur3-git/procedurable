/**
 * Advanced Validation System
 * P2-M2d-006: Builder Validation API
 *
 * Provides structured feedback for agent iteration:
 * - Mesh validity checks
 * - Domain-specific validation (furniture ergonomics, stability, etc.)
 * - Structured results for parsing
 */

import { Mesh } from '../geometry/Mesh';
import { checkMeshValidity } from './MeshChecks';
import { getMeshBounds } from './MeshValidation';

/**
 * Validation check result
 */
export interface ValidationCheck {
  /** Name of the check (e.g., "mesh_validity", "ergonomics_seat_height") */
  check: string;

  /** Status: pass, warning, or fail */
  status: 'pass' | 'warning' | 'fail';

  /** Human-readable reason */
  reason: string;

  /** Optional metric name (e.g., "seat_height", "area") */
  metric?: string;

  /** Measured value */
  value?: number;

  /** Expected/recommended value or range */
  expected?: number | { min: number; max: number };

  /** Suggestion for improvement */
  suggestion?: string;
}

/**
 * Complete validation results
 */
export interface ValidationResults {
  /** Overall pass/fail */
  valid: boolean;

  /** All check results */
  checks: ValidationCheck[];

  /** Summary counts */
  summary: {
    passed: number;
    warnings: number;
    failed: number;
  };
}

/**
 * Validation context with builder metadata
 */
export interface ValidationContext {
  builderName: string;
  mesh: Mesh;
  measurements?: Map<string, { value: number; source?: string }>;
  decisions?: Map<string, any>;
  tags?: string[];
}

/**
 * Run all validation checks on a builder
 */
export function validateBuilder(context: ValidationContext): ValidationResults {
  const checks: ValidationCheck[] = [];

  // 1. Mesh validity checks
  checks.push(...runMeshValidityChecks(context));

  // 2. Geometry quality checks
  checks.push(...runGeometryQualityChecks(context));

  // 3. Domain-specific checks
  checks.push(...runDomainSpecificChecks(context));

  // Calculate summary
  const passed = checks.filter(c => c.status === 'pass').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const failed = checks.filter(c => c.status === 'fail').length;

  return {
    valid: failed === 0,
    checks,
    summary: { passed, warnings, failed }
  };
}

/**
 * Mesh validity checks (indices, degenerate faces, etc.)
 */
function runMeshValidityChecks(context: ValidationContext): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const meshCheck = checkMeshValidity(context.mesh);

  if (meshCheck.ok) {
    checks.push({
      check: 'mesh_validity',
      status: 'pass',
      reason: 'Mesh structure is valid (all indices in range, no NaN values)'
    });
  } else {
    checks.push({
      check: 'mesh_validity',
      status: 'fail',
      reason: meshCheck.errors.join('; '),
      suggestion: 'Check vertex placement and face definitions'
    });
  }

  // Degenerate triangles as warning
  if (meshCheck.warnings.length > 0) {
    checks.push({
      check: 'mesh_degeneracy',
      status: 'warning',
      reason: `Found ${meshCheck.warnings.length} degenerate triangles`,
      suggestion: 'Review geometry for near-coincident vertices'
    });
  }

  return checks;
}

/**
 * Geometry quality checks (bounds, complexity, etc.)
 */
function runGeometryQualityChecks(context: ValidationContext): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const bounds = getMeshBounds(context.mesh);

  // Check for empty mesh
  if (context.mesh.vertices.length === 0) {
    checks.push({
      check: 'geometry_empty',
      status: 'fail',
      reason: 'Mesh has no vertices',
      suggestion: 'Add geometry using vertex/face commands'
    });
    return checks;
  }

  if (context.mesh.faces.length === 0) {
    checks.push({
      check: 'geometry_no_faces',
      status: 'warning',
      reason: 'Mesh has vertices but no faces',
      suggestion: 'Add faces to create surfaces'
    });
  }

  // Check for unreasonably large models
  const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z);
  if (maxDim > 100) {
    checks.push({
      check: 'geometry_scale_large',
      status: 'warning',
      reason: `Mesh is very large (${maxDim.toFixed(1)}m)`,
      metric: 'max_dimension',
      value: maxDim,
      expected: { min: 0.1, max: 10 },
      suggestion: 'Check measurement units (expected meters)'
    });
  } else if (maxDim < 0.01) {
    checks.push({
      check: 'geometry_scale_small',
      status: 'warning',
      reason: `Mesh is very small (${(maxDim * 1000).toFixed(1)}mm)`,
      metric: 'max_dimension',
      value: maxDim,
      expected: { min: 0.1, max: 10 },
      suggestion: 'Check measurement units (expected meters)'
    });
  } else {
    checks.push({
      check: 'geometry_scale',
      status: 'pass',
      reason: 'Mesh scale is reasonable',
      metric: 'max_dimension',
      value: maxDim
    });
  }

  // Check for reasonable complexity
  const triCount = context.mesh.faces.reduce((sum, f) => sum + (f.indices.length - 2), 0);
  if (triCount > 100000) {
    checks.push({
      check: 'geometry_complexity',
      status: 'warning',
      reason: `Very high triangle count (${triCount})`,
      metric: 'triangle_count',
      value: triCount,
      suggestion: 'Consider reducing subdivision or detail level'
    });
  }

  return checks;
}

/**
 * Domain-specific validation (furniture ergonomics, stability, etc.)
 */
function runDomainSpecificChecks(context: ValidationContext): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const builderName = context.builderName.toLowerCase();

  // Detect domain from builder name
  if (builderName.includes('chair') || builderName.includes('seat')) {
    checks.push(...validateChair(context));
  } else if (builderName.includes('table') || builderName.includes('desk')) {
    checks.push(...validateTable(context));
  } else if (builderName.includes('door')) {
    checks.push(...validateDoor(context));
  }

  // Stability check for anything with legs
  if (context.measurements?.has('leg_height') || builderName.includes('leg')) {
    checks.push(...validateStability(context));
  }

  return checks;
}

/**
 * Chair-specific ergonomics validation
 */
function validateChair(context: ValidationContext): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const measurements = context.measurements;

  // Seat height ergonomics (standard: 0.4-0.5m)
  const seatHeight = measurements?.get('seat_height')?.value;
  if (seatHeight !== undefined) {
    if (seatHeight < 0.35 || seatHeight > 0.55) {
      checks.push({
        check: 'ergonomics_seat_height',
        status: 'warning',
        reason: `Seat height ${seatHeight.toFixed(2)}m is outside ergonomic range`,
        metric: 'seat_height',
        value: seatHeight,
        expected: { min: 0.4, max: 0.5 },
        suggestion: 'Standard dining chair: 0.45-0.48m'
      });
    } else {
      checks.push({
        check: 'ergonomics_seat_height',
        status: 'pass',
        reason: 'Seat height is ergonomic',
        metric: 'seat_height',
        value: seatHeight
      });
    }
  }

  // Seat dimensions (standard: 0.4-0.5m width/depth)
  const seatWidth = measurements?.get('seat_width')?.value;
  if (seatWidth !== undefined) {
    if (seatWidth < 0.35 || seatWidth > 0.6) {
      checks.push({
        check: 'ergonomics_seat_width',
        status: 'warning',
        reason: `Seat width ${seatWidth.toFixed(2)}m may be uncomfortable`,
        metric: 'seat_width',
        value: seatWidth,
        expected: { min: 0.4, max: 0.5 },
        suggestion: 'Standard seat: 0.4-0.5m wide'
      });
    } else {
      checks.push({
        check: 'ergonomics_seat_width',
        status: 'pass',
        reason: 'Seat width is comfortable',
        metric: 'seat_width',
        value: seatWidth
      });
    }
  }

  // Back height (if present)
  const backHeight = measurements?.get('back_height')?.value;
  if (backHeight !== undefined) {
    if (backHeight < 0.2 || backHeight > 0.6) {
      checks.push({
        check: 'ergonomics_back_height',
        status: 'warning',
        reason: `Back height ${backHeight.toFixed(2)}m may not provide adequate support`,
        metric: 'back_height',
        value: backHeight,
        expected: { min: 0.3, max: 0.5 },
        suggestion: 'Typical back height: 0.3-0.4m above seat'
      });
    } else {
      checks.push({
        check: 'ergonomics_back_height',
        status: 'pass',
        reason: 'Back height provides good support',
        metric: 'back_height',
        value: backHeight
      });
    }
  }

  return checks;
}

/**
 * Table-specific validation
 */
function validateTable(context: ValidationContext): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const measurements = context.measurements;

  // Table height (standard: 0.7-0.75m for dining)
  const height = measurements?.get('height')?.value;
  if (height !== undefined) {
    if (height < 0.65 || height > 0.8) {
      checks.push({
        check: 'ergonomics_table_height',
        status: 'warning',
        reason: `Table height ${height.toFixed(2)}m is outside standard range`,
        metric: 'height',
        value: height,
        expected: { min: 0.7, max: 0.75 },
        suggestion: 'Dining table: 0.72-0.74m, Desk: 0.72-0.75m'
      });
    } else {
      checks.push({
        check: 'ergonomics_table_height',
        status: 'pass',
        reason: 'Table height is ergonomic',
        metric: 'height',
        value: height
      });
    }
  }

  // Table dimensions (reasonable size)
  const topWidth = measurements?.get('top_width')?.value;
  const topDepth = measurements?.get('top_depth')?.value;

  if (topWidth !== undefined && topDepth !== undefined) {
    const area = topWidth * topDepth;
    if (area < 0.5) {
      checks.push({
        check: 'usability_table_area',
        status: 'warning',
        reason: `Table surface area ${area.toFixed(2)}m² is very small`,
        metric: 'surface_area',
        value: area,
        expected: { min: 0.8, max: 6.0 },
        suggestion: 'Single dining: ~0.8m², 4-person: 1.5-2.5m²'
      });
    } else if (area > 10) {
      checks.push({
        check: 'usability_table_area',
        status: 'warning',
        reason: `Table surface area ${area.toFixed(2)}m² is very large`,
        metric: 'surface_area',
        value: area,
        expected: { min: 0.8, max: 6.0 },
        suggestion: 'Consider if this is intentional (conference table?)'
      });
    } else {
      checks.push({
        check: 'usability_table_area',
        status: 'pass',
        reason: 'Table surface area is practical',
        metric: 'surface_area',
        value: area
      });
    }
  }

  return checks;
}

/**
 * Door-specific validation
 */
function validateDoor(context: ValidationContext): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const measurements = context.measurements;

  // Door height (standard: 2.0-2.1m)
  const height = measurements?.get('height')?.value || measurements?.get('door_height')?.value;
  if (height !== undefined) {
    if (height < 1.8 || height > 2.2) {
      checks.push({
        check: 'standards_door_height',
        status: 'warning',
        reason: `Door height ${height.toFixed(2)}m is unusual`,
        metric: 'height',
        value: height,
        expected: { min: 2.0, max: 2.1 },
        suggestion: 'Standard door: 2.0-2.1m (residential)'
      });
    } else {
      checks.push({
        check: 'standards_door_height',
        status: 'pass',
        reason: 'Door height is standard',
        metric: 'height',
        value: height
      });
    }
  }

  // Door width (standard: 0.8-0.9m)
  const width = measurements?.get('width')?.value || measurements?.get('door_width')?.value;
  if (width !== undefined) {
    if (width < 0.7 || width > 1.2) {
      checks.push({
        check: 'standards_door_width',
        status: 'warning',
        reason: `Door width ${width.toFixed(2)}m is unusual`,
        metric: 'width',
        value: width,
        expected: { min: 0.8, max: 0.9 },
        suggestion: 'Standard door: 0.8-0.9m, Min accessible: 0.82m'
      });
    } else {
      checks.push({
        check: 'standards_door_width',
        status: 'pass',
        reason: 'Door width is standard',
        metric: 'width',
        value: width
      });
    }
  }

  return checks;
}

/**
 * Stability validation (for furniture with legs)
 */
function validateStability(context: ValidationContext): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const bounds = getMeshBounds(context.mesh);

  // Center of mass approximation (geometric center)
  const com = bounds.center;

  // Check if COM is near ground level (y close to 0)
  if (com.y < 0 || com.y > bounds.size.y * 0.7) {
    checks.push({
      check: 'stability_center_of_mass',
      status: 'warning',
      reason: `Center of mass at y=${com.y.toFixed(2)}m may indicate stability issues`,
      metric: 'com_height',
      value: com.y,
      suggestion: 'Ensure legs extend to ground (y=0) and mass is balanced'
    });
  }

  // Check aspect ratio (tall/narrow objects may be unstable)
  const aspectRatio = bounds.size.y / Math.max(bounds.size.x, bounds.size.z);
  if (aspectRatio > 5) {
    checks.push({
      check: 'stability_aspect_ratio',
      status: 'warning',
      reason: `High aspect ratio (${aspectRatio.toFixed(1)}:1) may be unstable`,
      metric: 'aspect_ratio',
      value: aspectRatio,
      expected: { min: 1, max: 3 },
      suggestion: 'Widen base or lower height for better stability'
    });
  }

  return checks;
}
