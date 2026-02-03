/**
 * Advanced Validation System
 * P2-M2d-006: Builder Validation API
 *
 * Provides structured feedback for agent iteration:
 * - Mesh validity checks
 * - Domain-specific validation (furniture ergonomics, stability, etc.)
 * - Structured results for parsing
 */

import { Mesh } from '../../platform/geometry/Mesh';
import { checkMeshValidity, checkMeshTopology, checkMeshUVs } from './MeshChecks';
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
  traces?: Map<string, any>;  // Trace entries for geometry group counting
  qualityMeta?: {             // From YAML quality: section
    target_tier?: number;
    current_tier?: number;
    tier_gaps?: string[];
    parts?: Record<string, { tier: number; notes?: string }>;
    decision_coverage?: {
      geometry_affecting?: string[];
      decorative_only?: string[];
      coverage_percentage?: number;
    };
  };
  decisionCoverageReport?: DecisionCoverageReport;  // A3-002: Optional pre-computed coverage
}

// ============================================================================
// QUALITY GATES (A2-001)
// ============================================================================

/**
 * Machine-readable suggestion for improving quality
 */
export interface QualityGateSuggestion {
  /** Action to take: "add_geometry", "add_material", "increase_faces", "fix_degenerate", "add_parts", "reduce_faces" */
  action: string;
  /** Which part or aspect this applies to */
  target: string;
  /** Human-readable explanation */
  reason: string;
  /** Machine-readable metric key */
  metric: string;
  /** Current measured value */
  current_value: number;
  /** Value needed to pass this gate */
  required_value: number;
  /** Which tier requires this */
  tier: number;
}

/**
 * Result of quality tier evaluation
 */
export interface QualityGateResult {
  /** Target tier (from YAML quality section, or requested tier, default 1) */
  target_tier: number;
  /** Highest tier where ALL gates pass */
  achieved_tier: number;
  /** Individual gate results */
  gates: Array<{
    tier: number;
    name: string;
    status: 'pass' | 'fail';
    detail?: string;
  }>;
  /** Machine-readable suggestions for each failure */
  suggestions: QualityGateSuggestion[];
  /** Summary */
  summary: {
    passed: number;
    failed: number;
    achieved_tier: number;
  };
}

// ============================================================================
// DECISION COVERAGE (A3-001)
// ============================================================================

/**
 * Result for a single decision's coverage test
 */
export interface DecisionCoverageItem {
  /** Decision name */
  name: string;
  /** Decision type (choice, number, boolean, count) */
  type: 'choice' | 'number' | 'boolean' | 'count';
  /** Available options for choice decisions */
  options?: any[];
  /** Coverage status */
  status: 'covered' | 'uncovered' | 'partial' | 'error';
  /** Detailed results per option/value */
  optionResults?: Array<{
    value: any;
    vertexCount: number;
    faceCount: number;
    differs: boolean;
  }>;
  /** Error message if status is 'error' */
  error?: string;
  /** Human-readable notes */
  notes?: string;
}

/**
 * Complete decision coverage report for a builder
 */
export interface DecisionCoverageReport {
  /** Builder name */
  builderName: string;
  /** Total decisions tested */
  totalDecisions: number;
  /** Number fully covered (all options produce different geometry) */
  covered: number;
  /** Number uncovered (all options produce same geometry) */
  uncovered: number;
  /** Number partially covered (some options differ) */
  partial: number;
  /** Number that failed to test */
  errors: number;
  /** Coverage percentage (covered / total * 100) */
  coveragePercent: number;
  /** Per-decision results */
  decisions: DecisionCoverageItem[];
  /** Seed used for baseline run */
  seed: number;
}

/**
 * Test decision coverage for a builder.
 * Runs the builder multiple times with each decision option forced,
 * comparing vertex/face counts to determine if decisions affect output.
 *
 * @param yamlDefinition - Parsed YAML builder definition
 * @param executeBuilder - Function to run the builder with overrides
 * @param seed - Seed for baseline run (default 42)
 */
export async function testDecisionCoverage(
  yamlDefinition: any,
  executeBuilder: (overrides: Record<string, any>) => Promise<{ mesh: { vertices: any[]; faces: any[] } }>,
  seed: number = 42
): Promise<DecisionCoverageReport> {
  const builderName = yamlDefinition.name || 'Unknown';
  const decisions = yamlDefinition.decisions || {};
  const decisionNames = Object.keys(decisions);

  const results: DecisionCoverageItem[] = [];

  // Get baseline run (no overrides)
  let baseline: { vertexCount: number; faceCount: number };
  try {
    const baselineOutput = await executeBuilder({});
    baseline = {
      vertexCount: baselineOutput.mesh.vertices.length,
      faceCount: baselineOutput.mesh.faces.length
    };
  } catch (err: any) {
    // Can't get baseline - mark all as errors
    return {
      builderName,
      totalDecisions: decisionNames.length,
      covered: 0,
      uncovered: 0,
      partial: 0,
      errors: decisionNames.length,
      coveragePercent: 0,
      decisions: decisionNames.map(name => ({
        name,
        type: decisions[name].type,
        status: 'error' as const,
        error: `Baseline failed: ${err.message}`
      })),
      seed
    };
  }

  // Test each decision
  for (const name of decisionNames) {
    const decision = decisions[name];
    const item: DecisionCoverageItem = {
      name,
      type: decision.type,
      status: 'uncovered'
    };

    try {
      switch (decision.type) {
        case 'choice': {
          const options = decision.options || [];
          item.options = options;
          item.optionResults = [];

          let differentCount = 0;
          const seenCounts = new Set<string>();
          seenCounts.add(`${baseline.vertexCount}:${baseline.faceCount}`);

          for (const option of options) {
            try {
              const output = await executeBuilder({ [name]: option });
              const vertexCount = output.mesh.vertices.length;
              const faceCount = output.mesh.faces.length;
              const key = `${vertexCount}:${faceCount}`;
              const differs = !seenCounts.has(key) || (vertexCount !== baseline.vertexCount || faceCount !== baseline.faceCount);
              seenCounts.add(key);

              item.optionResults.push({
                value: option,
                vertexCount,
                faceCount,
                differs: seenCounts.size > 1 // Multiple distinct outputs
              });

              if (differs) differentCount++;
            } catch (err: any) {
              item.optionResults.push({
                value: option,
                vertexCount: 0,
                faceCount: 0,
                differs: false
              });
            }
          }

          // Determine coverage status
          // Check if we have more than 1 distinct vertex:face combination
          if (seenCounts.size >= options.length) {
            item.status = 'covered';
          } else if (seenCounts.size > 1) {
            item.status = 'partial';
            item.notes = `${seenCounts.size}/${options.length} options produce different geometry`;
          } else {
            item.status = 'uncovered';
            item.notes = 'All options produce identical geometry';
          }
          break;
        }

        case 'number': {
          // Test with min, max, and mid values
          const min = decision.min ?? 0;
          const max = decision.max ?? 1;
          const mid = (min + max) / 2;
          const testValues = [min, mid, max];

          item.optionResults = [];
          const seenCounts = new Set<string>();
          seenCounts.add(`${baseline.vertexCount}:${baseline.faceCount}`);

          for (const value of testValues) {
            try {
              const output = await executeBuilder({ [name]: value });
              const vertexCount = output.mesh.vertices.length;
              const faceCount = output.mesh.faces.length;
              const key = `${vertexCount}:${faceCount}`;
              seenCounts.add(key);

              item.optionResults.push({
                value,
                vertexCount,
                faceCount,
                differs: seenCounts.size > 1
              });
            } catch (err: any) {
              item.optionResults.push({
                value,
                vertexCount: 0,
                faceCount: 0,
                differs: false
              });
            }
          }

          if (seenCounts.size >= testValues.length) {
            item.status = 'covered';
          } else if (seenCounts.size > 1) {
            item.status = 'partial';
          } else {
            item.status = 'uncovered';
          }
          break;
        }

        case 'boolean': {
          item.optionResults = [];
          const seenCounts = new Set<string>();
          seenCounts.add(`${baseline.vertexCount}:${baseline.faceCount}`);

          for (const value of [true, false]) {
            try {
              const output = await executeBuilder({ [name]: value });
              const vertexCount = output.mesh.vertices.length;
              const faceCount = output.mesh.faces.length;
              const key = `${vertexCount}:${faceCount}`;
              seenCounts.add(key);

              item.optionResults.push({
                value,
                vertexCount,
                faceCount,
                differs: seenCounts.size > 1
              });
            } catch (err: any) {
              item.optionResults.push({
                value,
                vertexCount: 0,
                faceCount: 0,
                differs: false
              });
            }
          }

          item.status = seenCounts.size >= 2 ? 'covered' : 'uncovered';
          break;
        }

        case 'count': {
          // Test with min, max, and a few intermediate values
          const min = decision.min ?? 1;
          const max = decision.max ?? 10;
          const testValues = [min, Math.floor((min + max) / 2), max];

          item.optionResults = [];
          const seenCounts = new Set<string>();
          seenCounts.add(`${baseline.vertexCount}:${baseline.faceCount}`);

          for (const value of testValues) {
            try {
              const output = await executeBuilder({ [name]: value });
              const vertexCount = output.mesh.vertices.length;
              const faceCount = output.mesh.faces.length;
              const key = `${vertexCount}:${faceCount}`;
              seenCounts.add(key);

              item.optionResults.push({
                value,
                vertexCount,
                faceCount,
                differs: seenCounts.size > 1
              });
            } catch (err: any) {
              item.optionResults.push({
                value,
                vertexCount: 0,
                faceCount: 0,
                differs: false
              });
            }
          }

          if (seenCounts.size >= testValues.length) {
            item.status = 'covered';
          } else if (seenCounts.size > 1) {
            item.status = 'partial';
          } else {
            item.status = 'uncovered';
          }
          break;
        }

        default:
          item.status = 'error';
          item.error = `Unknown decision type: ${decision.type}`;
      }
    } catch (err: any) {
      item.status = 'error';
      item.error = err.message;
    }

    results.push(item);
  }

  // Calculate summary
  const covered = results.filter(r => r.status === 'covered').length;
  const uncovered = results.filter(r => r.status === 'uncovered').length;
  const partial = results.filter(r => r.status === 'partial').length;
  const errors = results.filter(r => r.status === 'error').length;
  const coveragePercent = results.length > 0
    ? Math.round((covered / results.length) * 100)
    : 0;

  return {
    builderName,
    totalDecisions: results.length,
    covered,
    uncovered,
    partial,
    errors,
    coveragePercent,
    decisions: results,
    seed
  };
}

// ============================================================================
// SOPHISTICATION PLAN COMPARISON (A4-002)
// ============================================================================

/**
 * A tier section within a sophistication plan
 */
export interface SophisticationPlanTier {
  description: string;
  parts: string[] | Record<string, any>;
  tools_needed: string[];
  decisions?: string[];
  decisions_that_affect_geometry?: string[];
  upgrades_from_t0?: string[];
  materials?: string[];
  deferred?: boolean;
  requires_tools_not_yet_built?: string[];
  notes?: string;
}

/**
 * Parsed sophistication plan
 */
export interface SophisticationPlan {
  builder: string;
  domain: string;
  tier_0_placeholder?: SophisticationPlanTier;
  tier_1_silhouette?: SophisticationPlanTier;
  tier_2_form_resolved?: SophisticationPlanTier;
  tier_3_detail?: SophisticationPlanTier;
  [key: string]: any;
}

/**
 * Individual check result for plan comparison
 */
export interface PlanCheck {
  category: 'parts' | 'decisions' | 'tools';
  name: string;
  status: 'pass' | 'fail' | 'skip';
  detail?: string;
}

/**
 * Result of comparing a sophistication plan against builder output
 */
export interface PlanComparisonResult {
  builder: string;
  tier_checked: number;
  checks: PlanCheck[];
  summary: {
    passed: number;
    failed: number;
    skipped: number;
  };
}

/**
 * Get the tier section from a plan for a given tier number
 */
function getPlanTier(plan: SophisticationPlan, tier: number): SophisticationPlanTier | undefined {
  const keys: Record<number, string> = {
    0: 'tier_0_placeholder',
    1: 'tier_1_silhouette',
    2: 'tier_2_form_resolved',
    3: 'tier_3_detail'
  };
  return plan[keys[tier]] as SophisticationPlanTier | undefined;
}

/**
 * Extract part names from a tier's parts field.
 * Parts can be a list of strings or a map of part_name -> description.
 */
function extractPartNames(parts: string[] | Record<string, any>): string[] {
  if (Array.isArray(parts)) {
    return parts.map(p => p.replace(/_x\d+$/, '').split('_')[0]);
  }
  return Object.keys(parts);
}

/**
 * Compare a sophistication plan against builder output.
 * Checks that planned parts, decisions, and tools are present.
 *
 * @param plan - Parsed sophistication plan YAML
 * @param context - Validation context from builder run (must include traces and decisions)
 * @param tier - Which tier to check against (defaults to achieved or target tier)
 */
export function compareSophisticationPlan(
  plan: SophisticationPlan,
  context: ValidationContext,
  tier?: number
): PlanComparisonResult {
  const tierToCheck = tier ?? context.qualityMeta?.current_tier ?? 1;
  const checks: PlanCheck[] = [];

  // Collect plan requirements from tier 0 up to the checked tier
  const allPlannedParts = new Set<string>();
  const allPlannedDecisions = new Set<string>();
  const allPlannedTools = new Set<string>();

  for (let t = 0; t <= tierToCheck; t++) {
    const tierSection = getPlanTier(plan, t);
    if (!tierSection) continue;
    if (tierSection.deferred) continue;

    // Collect parts
    if (tierSection.parts) {
      for (const name of extractPartNames(tierSection.parts)) {
        allPlannedParts.add(name);
      }
    }

    // Collect decisions
    const decisionList = tierSection.decisions || [];
    for (const d of decisionList) {
      allPlannedDecisions.add(d);
    }
    // Also from decisions_that_affect_geometry (extract decision name before "->")
    const affectingList = tierSection.decisions_that_affect_geometry || [];
    for (const entry of affectingList) {
      const name = entry.split('->')[0].trim();
      allPlannedDecisions.add(name);
    }

    // Collect tools
    if (tierSection.tools_needed) {
      for (const tool of tierSection.tools_needed) {
        allPlannedTools.add(tool);
      }
    }
  }

  // Check parts exist in traces
  const traceGroups = context.traces ? countGeometryGroups(context.traces) : [];
  const traceGroupSet = new Set(traceGroups.map(g => g.toLowerCase()));

  for (const part of allPlannedParts) {
    const partLower = part.toLowerCase();
    const found = traceGroupSet.has(partLower) ||
      traceGroups.some(g => g.toLowerCase().startsWith(partLower));
    checks.push({
      category: 'parts',
      name: part,
      status: found ? 'pass' : 'fail',
      detail: found ? `Found in geometry traces` : `Not found in geometry traces. Available: ${traceGroups.join(', ')}`
    });
  }

  // Check decisions exist in builder
  const builderDecisions = context.decisions ? new Set(Array.from(context.decisions.keys())) : new Set<string>();

  for (const decision of allPlannedDecisions) {
    const found = builderDecisions.has(decision);
    checks.push({
      category: 'decisions',
      name: decision,
      status: found ? 'pass' : 'fail',
      detail: found ? 'Decision exists in builder' : 'Decision not found in builder'
    });
  }

  // Check tools usage in traces
  const toolMapping: Record<string, string[]> = {
    box: ['face:', 'mesh:'],
    loft: ['loft:'],
    lathe: ['mesh:'],  // lathe produces mesh: entries
    circle: ['loft:'],
    cylinder: ['loft:', 'mesh:'],
    conditional_geometry: [],  // Can't directly check; skip
    multi_material: [],        // Checked via color count instead
    subdivide: ['mesh:'],
    sweep: ['mesh:']
  };

  const traceKeys = context.traces ? Array.from(context.traces.keys()) : [];

  for (const tool of allPlannedTools) {
    const prefixes = toolMapping[tool];
    if (prefixes === undefined || prefixes.length === 0) {
      // Unknown or uncheckable tool - skip
      checks.push({
        category: 'tools',
        name: tool,
        status: 'skip',
        detail: 'Cannot verify tool usage from traces'
      });
      continue;
    }
    const found = prefixes.some(prefix => traceKeys.some(k => k.startsWith(prefix)));
    checks.push({
      category: 'tools',
      name: tool,
      status: found ? 'pass' : 'fail',
      detail: found ? 'Tool output found in traces' : 'No trace entries match this tool type'
    });
  }

  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  const skipped = checks.filter(c => c.status === 'skip').length;

  return {
    builder: plan.builder,
    tier_checked: tierToCheck,
    checks,
    summary: { passed, failed, skipped }
  };
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
 * Mesh validity checks (indices, degenerate faces, topology, etc.)
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

  // Topology checks (non-manifold edges, winding consistency, isolated vertices)
  const topoCheck = checkMeshTopology(context.mesh);

  if (topoCheck.nonManifoldEdges.length > 0) {
    checks.push({
      check: 'mesh_topology_manifold',
      status: 'fail',
      reason: `Found ${topoCheck.nonManifoldEdges.length} non-manifold edge(s) (shared by >2 faces)`,
      suggestion: 'Ensure each edge is shared by at most 2 faces'
    });
  }

  if (topoCheck.inconsistentWindingPairs.length > 0) {
    checks.push({
      check: 'mesh_topology_winding',
      status: 'warning',
      reason: `Found ${topoCheck.inconsistentWindingPairs.length} face pair(s) with inconsistent winding`,
      suggestion: 'Check face vertex order - adjacent faces should wind in opposite directions on shared edge'
    });
  }

  if (topoCheck.isolatedVertices.length > 0) {
    checks.push({
      check: 'mesh_topology_isolated',
      status: 'warning',
      reason: `Found ${topoCheck.isolatedVertices.length} isolated vertex(s) not used by any face`,
      suggestion: 'Remove unused vertices or add faces that reference them'
    });
  }

  // Note boundary edges (informational, not an error for many valid meshes)
  if (topoCheck.boundaryEdges.length > 0 && context.mesh.faces.length > 1) {
    checks.push({
      check: 'mesh_topology_watertight',
      status: 'pass',  // Not an error, just informational
      reason: `Mesh has ${topoCheck.boundaryEdges.length} boundary edge(s) - not watertight`
    });
  }

  if (topoCheck.ok) {
    checks.push({
      check: 'mesh_topology',
      status: 'pass',
      reason: 'Mesh topology is valid (no non-manifold edges, consistent winding, no isolated vertices)'
    });
  }

  // UV validation checks
  const uvCheck = checkMeshUVs(context.mesh);

  if (uvCheck.stats.verticesWithoutUV > 0 && uvCheck.stats.verticesWithUV > 0) {
    // Mixed UV coverage is a problem - some vertices have UVs, some don't
    checks.push({
      check: 'uv_coverage_mixed',
      status: 'warning',
      reason: `Mixed UV coverage: ${uvCheck.stats.verticesWithUV} vertices with UVs, ${uvCheck.stats.verticesWithoutUV} without`,
      suggestion: 'Ensure all vertices have UVs or use box projection to add them'
    });
  } else if (uvCheck.stats.verticesWithoutUV > 0) {
    // No UVs at all - informational for now
    checks.push({
      check: 'uv_coverage_none',
      status: 'pass',  // Not an error - some meshes intentionally skip UVs
      reason: `Mesh has no UV coordinates (${context.mesh.vertices.length} vertices)`
    });
  } else if (uvCheck.stats.verticesWithUV > 0) {
    checks.push({
      check: 'uv_coverage',
      status: 'pass',
      reason: `All ${uvCheck.stats.verticesWithUV} vertices have UV coordinates`
    });
  }

  if (uvCheck.stats.degenerateFaces > 0) {
    checks.push({
      check: 'uv_degenerate',
      status: 'warning',
      reason: `${uvCheck.stats.degenerateFaces} faces have degenerate UVs (collapsed to line/point)`,
      suggestion: 'Degenerate UVs cause texture distortion - check face UV layout'
    });
  }

  if (uvCheck.stats.distortedFaces > 0) {
    checks.push({
      check: 'uv_distortion',
      status: 'warning',
      reason: `${uvCheck.stats.distortedFaces} faces have severely distorted UVs (10x+ stretch ratio)`,
      suggestion: 'High UV distortion causes texture stretching - consider UV unwrapping'
    });
  }

  if (uvCheck.errors.length > 0) {
    checks.push({
      check: 'uv_validity',
      status: 'fail',
      reason: uvCheck.errors.join('; '),
      suggestion: 'Check for NaN or Infinity UV values'
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

// ============================================================================
// QUALITY TIER EVALUATION (A2-001, A2-002)
// ============================================================================

/**
 * Count faces per geometry group from traces.
 * Returns a map of group base name → face count for checking min faces per part (A2-002).
 * Groups are normalized (e.g., "seat_bottom", "seat_top" → "seat")
 *
 * Counts actual faces:
 * - face: entries = 1 face each
 * - loft: entries = faceCount from details (if available) or 1
 * - mesh: entries = facesAdded from details (if available) or 1 (for extrude2d)
 */
function countFacesPerGroup(traces: Map<string, any>): Map<string, number> {
  const groupFaces = new Map<string, number>();
  for (const [key, trace] of traces) {
    let faceCount = 0;
    let baseName = '';

    if (key.startsWith('face:')) {
      // face: entries represent 1 face each
      faceCount = 1;
      const faceName = key.split(':')[1];
      baseName = faceName.split('_')[0];
    } else if (key.startsWith('loft:')) {
      // loft: entries have faceCount in details
      faceCount = trace?.details?.faceCount ?? 1;
      const loftName = key.split(':')[1];
      baseName = loftName.split('_')[0];
    } else if (key.startsWith('mesh:')) {
      // mesh: entries (from extrude2d, etc.) have facesAdded in details
      faceCount = trace?.details?.facesAdded ?? 1;
      const meshName = key.split(':')[1];
      baseName = meshName.split('_')[0];
    } else if (key.startsWith('compose:')) {
      // compose: entries might have sub-meshes, count as 1 group contribution
      // (sub-mesh faces are already counted in their own builder's traces)
      faceCount = 0; // Don't double-count composed geometry
      continue;
    } else {
      continue; // Skip non-geometry traces
    }

    if (baseName && faceCount > 0) {
      groupFaces.set(baseName, (groupFaces.get(baseName) || 0) + faceCount);
    }
  }
  return groupFaces;
}

/**
 * Find geometry groups with fewer than the minimum required faces.
 * Returns array of { group, faceCount } for groups that fail.
 */
function findUnderFacedGroups(traces: Map<string, any>, minFaces: number): Array<{ group: string; faceCount: number }> {
  const groupFaces = countFacesPerGroup(traces);
  const failing: Array<{ group: string; faceCount: number }> = [];
  for (const [group, count] of groupFaces) {
    if (count < minFaces) {
      failing.push({ group, faceCount: count });
    }
  }
  return failing;
}

/**
 * Check mesh for closed (watertight) topology.
 * A closed mesh has every edge shared by exactly 2 faces.
 * Returns { total: number of edges, closed: number of properly shared edges }
 */
function checkClosedMesh(mesh: Mesh): { totalEdges: number; closedEdges: number; openEdges: string[] } {
  // Build edge count map: edge key → count of faces sharing it
  const edgeCounts = new Map<string, number>();

  for (let faceIdx = 0; faceIdx < mesh.faces.length; faceIdx++) {
    const face = mesh.faces[faceIdx];
    const indices = face.indices;

    for (let i = 0; i < indices.length; i++) {
      const a = indices[i];
      const b = indices[(i + 1) % indices.length];
      // Canonical edge key (smaller index first)
      const edgeKey = a < b ? `${a}-${b}` : `${b}-${a}`;
      edgeCounts.set(edgeKey, (edgeCounts.get(edgeKey) || 0) + 1);
    }
  }

  let closedEdges = 0;
  const openEdges: string[] = [];

  for (const [edgeKey, count] of edgeCounts) {
    if (count === 2) {
      closedEdges++;
    } else {
      // Edge is either boundary (count=1) or non-manifold (count>2)
      openEdges.push(edgeKey);
    }
  }

  return {
    totalEdges: edgeCounts.size,
    closedEdges,
    openEdges
  };
}

/**
 * Count distinct geometry groups from traces.
 * Groups are identified by face:/loft:/compose:/mesh: trace entries.
 */
function countGeometryGroups(traces: Map<string, any>): string[] {
  const groups = new Set<string>();
  for (const key of traces.keys()) {
    if (key.startsWith('face:') || key.startsWith('loft:') || key.startsWith('compose:') || key.startsWith('mesh:')) {
      // Extract the group name (e.g., "face:seat" → "seat", "loft:leg_0" → "leg_0", "mesh:gear_body" → "gear_body")
      const name = key.split(':')[1];
      // Normalize: "leg_0", "leg_1" → "leg" (strip trailing _N for counting distinct parts)
      const baseName = name.replace(/_\d+$/, '');
      groups.add(baseName);
    }
  }
  return Array.from(groups);
}

/**
 * Count distinct colors/materials used in faces
 */
function countDistinctColors(mesh: Mesh): number {
  const colorKeys = new Set<string>();
  for (const face of mesh.faces) {
    if (face.color) {
      // Quantize to avoid floating point differences
      const key = `${Math.round(face.color.r * 255)},${Math.round(face.color.g * 255)},${Math.round(face.color.b * 255)}`;
      colorKeys.add(key);
    } else {
      colorKeys.add('default');
    }
  }
  return colorKeys.size;
}

/**
 * Count degenerate triangles (zero area or near-zero area)
 */
function countDegenerateTriangles(mesh: Mesh): { total: number; degenerate: number } {
  let total = 0;
  let degenerate = 0;
  const EPSILON = 1e-10;

  for (const face of mesh.faces) {
    const triCount = face.indices.length - 2;
    total += triCount;

    // Check first triangle of each face (simplified check)
    if (face.indices.length >= 3) {
      const v0 = mesh.vertices[face.indices[0]];
      const v1 = mesh.vertices[face.indices[1]];
      const v2 = mesh.vertices[face.indices[2]];
      if (v0 && v1 && v2) {
        // Cross product magnitude = 2 * triangle area
        const p0 = v0.position ?? v0, p1 = v1.position ?? v1, p2 = v2.position ?? v2;
        const ax = p1.x - p0.x, ay = p1.y - p0.y, az = p1.z - p0.z;
        const bx = p2.x - p0.x, by = p2.y - p0.y, bz = p2.z - p0.z;
        const cx = ay * bz - az * by;
        const cy = az * bx - ax * bz;
        const cz = ax * by - ay * bx;
        const area2 = cx * cx + cy * cy + cz * cz;
        if (area2 < EPSILON) {
          degenerate += triCount;
        }
      }
    }
  }

  return { total, degenerate };
}

/**
 * Evaluate quality tier for a builder output.
 *
 * Checks gates for Tier 1 and Tier 2, returns the highest achieved tier
 * along with machine-readable suggestions for each failure.
 */
export function evaluateQualityTier(context: ValidationContext, requestedTier?: number): QualityGateResult {
  const targetTier = requestedTier ?? context.qualityMeta?.target_tier ?? 1;
  const gates: QualityGateResult['gates'] = [];
  const suggestions: QualityGateSuggestion[] = [];

  const mesh = context.mesh;
  const bounds = getMeshBounds(mesh);
  const triCount = mesh.faces.reduce((sum, f) => sum + (f.indices.length - 2), 0);
  const faceCount = mesh.faces.length;
  const geometryGroups = context.traces ? countGeometryGroups(context.traces) : [];
  const groupCount = geometryGroups.length;
  const colorCount = countDistinctColors(mesh);
  const { total: totalTris, degenerate: degenerateTris } = countDegenerateTriangles(mesh);
  const degenerateRatio = totalTris > 0 ? degenerateTris / totalTris : 0;
  const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z);

  // ── Tier 1 Gates ──────────────────────────────────────────────────────

  // T1-1: Minimum face count (not a placeholder)
  if (faceCount >= 6) {
    gates.push({ tier: 1, name: 'min_face_count', status: 'pass', detail: `${faceCount} faces` });
  } else {
    gates.push({ tier: 1, name: 'min_face_count', status: 'fail', detail: `${faceCount} faces (need ≥6)` });
    suggestions.push({
      action: 'add_geometry', target: 'mesh', reason: 'Mesh has too few faces for Tier 1',
      metric: 'face_count', current_value: faceCount, required_value: 6, tier: 1
    });
  }

  // T1-2: Minimum triangle count (recognizable shape)
  if (triCount >= 20) {
    gates.push({ tier: 1, name: 'min_triangle_count', status: 'pass', detail: `${triCount} triangles` });
  } else {
    gates.push({ tier: 1, name: 'min_triangle_count', status: 'fail', detail: `${triCount} triangles (need ≥20)` });
    suggestions.push({
      action: 'add_geometry', target: 'mesh', reason: 'Mesh needs more triangles for a recognizable silhouette',
      metric: 'triangle_count', current_value: triCount, required_value: 20, tier: 1
    });
  }

  // T1-3: At least 2 distinct geometry groups (parts)
  if (groupCount >= 2) {
    gates.push({ tier: 1, name: 'min_geometry_groups', status: 'pass', detail: `${groupCount} groups: ${geometryGroups.join(', ')}` });
  } else {
    gates.push({ tier: 1, name: 'min_geometry_groups', status: 'fail', detail: `${groupCount} groups (need ≥2)` });
    suggestions.push({
      action: 'add_parts', target: 'mesh', reason: 'Builder needs multiple distinct parts',
      metric: 'geometry_groups', current_value: groupCount, required_value: 2, tier: 1
    });
  }

  // T1-4: Degenerate triangle ratio < 10%
  if (degenerateRatio < 0.10) {
    gates.push({ tier: 1, name: 'degenerate_ratio', status: 'pass', detail: `${(degenerateRatio * 100).toFixed(1)}%` });
  } else {
    gates.push({ tier: 1, name: 'degenerate_ratio', status: 'fail', detail: `${(degenerateRatio * 100).toFixed(1)}% (need <10%)` });
    suggestions.push({
      action: 'fix_degenerate', target: 'mesh', reason: 'Too many degenerate triangles',
      metric: 'degenerate_ratio', current_value: Math.round(degenerateRatio * 100), required_value: 10, tier: 1
    });
  }

  // T1-5: Bounds are reasonable (0.01m - 100m)
  if (maxDim >= 0.01 && maxDim <= 100) {
    gates.push({ tier: 1, name: 'bounds_reasonable', status: 'pass', detail: `max dimension ${maxDim.toFixed(2)}m` });
  } else {
    gates.push({ tier: 1, name: 'bounds_reasonable', status: 'fail', detail: `max dimension ${maxDim.toFixed(2)}m (need 0.01-100m)` });
    suggestions.push({
      action: 'fix_scale', target: 'mesh', reason: 'Mesh scale is outside reasonable range',
      metric: 'max_dimension', current_value: maxDim, required_value: maxDim < 0.01 ? 0.01 : 100, tier: 1
    });
  }

  // T1-6: No zero-volume bounding box
  const volume = bounds.size.x * bounds.size.y * bounds.size.z;
  if (volume > 1e-9) {
    gates.push({ tier: 1, name: 'non_zero_volume', status: 'pass', detail: `volume ${volume.toFixed(6)}m³` });
  } else {
    gates.push({ tier: 1, name: 'non_zero_volume', status: 'fail', detail: 'Mesh has zero or near-zero volume' });
    suggestions.push({
      action: 'add_geometry', target: 'mesh', reason: 'Mesh is flat or has no volume',
      metric: 'volume', current_value: volume, required_value: 0.000001, tier: 1
    });
  }

  // ── Tier 2 Gates ──────────────────────────────────────────────────────

  // T2-1: Higher triangle count (form-resolved)
  if (triCount >= 100) {
    gates.push({ tier: 2, name: 'min_triangle_count_t2', status: 'pass', detail: `${triCount} triangles` });
  } else {
    gates.push({ tier: 2, name: 'min_triangle_count_t2', status: 'fail', detail: `${triCount} triangles (need ≥100)` });
    suggestions.push({
      action: 'increase_faces', target: 'mesh', reason: 'Form-resolved geometry needs more detail',
      metric: 'triangle_count', current_value: triCount, required_value: 100, tier: 2
    });
  }

  // T2-2: At least 3 geometry groups
  if (groupCount >= 3) {
    gates.push({ tier: 2, name: 'min_geometry_groups_t2', status: 'pass', detail: `${groupCount} groups` });
  } else {
    gates.push({ tier: 2, name: 'min_geometry_groups_t2', status: 'fail', detail: `${groupCount} groups (need ≥3)` });
    suggestions.push({
      action: 'add_parts', target: 'mesh', reason: 'Tier 2 requires at least 3 distinct parts',
      metric: 'geometry_groups', current_value: groupCount, required_value: 3, tier: 2
    });
  }

  // T2-3: At least 2 distinct materials/colors
  if (colorCount >= 2) {
    gates.push({ tier: 2, name: 'min_materials', status: 'pass', detail: `${colorCount} distinct colors` });
  } else {
    gates.push({ tier: 2, name: 'min_materials', status: 'fail', detail: `${colorCount} color(s) (need ≥2)` });
    suggestions.push({
      action: 'add_material', target: 'mesh', reason: 'Tier 2 requires at least 2 distinct materials',
      metric: 'distinct_colors', current_value: colorCount, required_value: 2, tier: 2
    });
  }

  // T2-4: Degenerate ratio < 2%
  if (degenerateRatio < 0.02) {
    gates.push({ tier: 2, name: 'degenerate_ratio_t2', status: 'pass', detail: `${(degenerateRatio * 100).toFixed(1)}%` });
  } else {
    gates.push({ tier: 2, name: 'degenerate_ratio_t2', status: 'fail', detail: `${(degenerateRatio * 100).toFixed(1)}% (need <2%)` });
    suggestions.push({
      action: 'fix_degenerate', target: 'mesh', reason: 'Tier 2 requires fewer degenerate triangles',
      metric: 'degenerate_ratio', current_value: Math.round(degenerateRatio * 100), required_value: 2, tier: 2
    });
  }

  // T2-5: Max triangle count (not over-detailed)
  if (triCount <= 10000) {
    gates.push({ tier: 2, name: 'max_triangle_count_t2', status: 'pass', detail: `${triCount} triangles` });
  } else {
    gates.push({ tier: 2, name: 'max_triangle_count_t2', status: 'fail', detail: `${triCount} triangles (need ≤10000)` });
    suggestions.push({
      action: 'reduce_faces', target: 'mesh', reason: 'Tier 2 mesh is over-detailed',
      metric: 'triangle_count', current_value: triCount, required_value: 10000, tier: 2
    });
  }

  // T2-6: Min 6 faces per named part (A2-002)
  const MIN_FACES_PER_PART = 6;
  const traces = context.traces;
  if (traces && traces.size > 0) {
    const underFacedGroups = findUnderFacedGroups(traces, MIN_FACES_PER_PART);
    if (underFacedGroups.length === 0) {
      gates.push({ tier: 2, name: 'min_faces_per_part', status: 'pass', detail: `all parts have ≥${MIN_FACES_PER_PART} faces` });
    } else {
      const failingParts = underFacedGroups.map(g => `${g.group}(${g.faceCount})`).join(', ');
      gates.push({ tier: 2, name: 'min_faces_per_part', status: 'fail', detail: `parts with <${MIN_FACES_PER_PART} faces: ${failingParts}` });
      // Add specific suggestion for each failing part
      for (const { group, faceCount } of underFacedGroups) {
        suggestions.push({
          action: 'add_geometry', target: group, reason: `Part '${group}' has only ${faceCount} face(s), needs ≥${MIN_FACES_PER_PART} for Tier 2`,
          metric: 'faces_in_part', current_value: faceCount, required_value: MIN_FACES_PER_PART, tier: 2
        });
      }
    }
  } else {
    // No trace data available - skip this gate (can't evaluate without traces)
    gates.push({ tier: 2, name: 'min_faces_per_part', status: 'pass', detail: 'no trace data (skipped)' });
  }

  // T2-7: ≥80% closed (watertight) mesh edges (A2-002)
  const closedMeshResult = checkClosedMesh(mesh);
  const closedEdgeRatio = closedMeshResult.totalEdges > 0
    ? closedMeshResult.closedEdges / closedMeshResult.totalEdges
    : 0;
  const closedPercent = Math.round(closedEdgeRatio * 100);
  const REQUIRED_CLOSED_PERCENT = 80;
  if (closedPercent >= REQUIRED_CLOSED_PERCENT) {
    gates.push({ tier: 2, name: 'closed_mesh', status: 'pass', detail: `${closedPercent}% closed edges` });
  } else {
    gates.push({ tier: 2, name: 'closed_mesh', status: 'fail', detail: `${closedPercent}% closed edges (need ≥${REQUIRED_CLOSED_PERCENT}%)` });
    suggestions.push({
      action: 'close_mesh', target: 'mesh',
      reason: `Mesh is only ${closedPercent}% closed. ${closedMeshResult.openEdges.length} open edges need to be connected.`,
      metric: 'closed_edge_percent', current_value: closedPercent, required_value: REQUIRED_CLOSED_PERCENT, tier: 2
    });
  }

  // T2-8: Decision coverage ≥90% (A3-002)
  // Only evaluated if a coverage report is provided (requires running builder multiple times)
  const REQUIRED_COVERAGE_PERCENT = 90;
  const coverageReport = context.decisionCoverageReport;
  if (coverageReport) {
    const coveragePercent = coverageReport.coveragePercent;
    if (coveragePercent >= REQUIRED_COVERAGE_PERCENT) {
      gates.push({
        tier: 2,
        name: 'decision_coverage',
        status: 'pass',
        detail: `${coveragePercent}% decisions covered (${coverageReport.covered}/${coverageReport.totalDecisions})`
      });
    } else {
      gates.push({
        tier: 2,
        name: 'decision_coverage',
        status: 'fail',
        detail: `${coveragePercent}% decisions covered (need ≥${REQUIRED_COVERAGE_PERCENT}%)`
      });
      // Add suggestions for each uncovered decision
      for (const decision of coverageReport.decisions) {
        if (decision.status === 'uncovered') {
          suggestions.push({
            action: 'implement_decision',
            target: decision.name,
            reason: `Decision '${decision.name}' is declared but does not affect geometry. ${decision.notes || 'All options produce identical output.'}`,
            metric: 'decision_coverage',
            current_value: 0,
            required_value: 1,
            tier: 2
          });
        } else if (decision.status === 'partial') {
          suggestions.push({
            action: 'complete_decision',
            target: decision.name,
            reason: `Decision '${decision.name}' only partially affects geometry. ${decision.notes || 'Some options produce identical output.'}`,
            metric: 'decision_coverage',
            current_value: 0.5,
            required_value: 1,
            tier: 2
          });
        }
      }
    }
  }
  // If no coverage report is provided, skip this gate (it would require running the builder multiple times)

  // ── Compute achieved tier ─────────────────────────────────────────────

  const tier1Gates = gates.filter(g => g.tier === 1);
  const tier2Gates = gates.filter(g => g.tier === 2);
  const tier1Pass = tier1Gates.every(g => g.status === 'pass');
  const tier2Pass = tier2Gates.every(g => g.status === 'pass');

  let achievedTier = 0;
  if (tier1Pass) achievedTier = 1;
  if (tier1Pass && tier2Pass) achievedTier = 2;

  const passed = gates.filter(g => g.status === 'pass').length;
  const failed = gates.filter(g => g.status === 'fail').length;

  // Filter suggestions to only those relevant to the target tier
  const relevantSuggestions = suggestions.filter(s => s.tier <= targetTier);

  return {
    target_tier: targetTier,
    achieved_tier: achievedTier,
    gates: gates.filter(g => g.tier <= targetTier),
    suggestions: relevantSuggestions,
    summary: { passed, failed, achieved_tier: achievedTier }
  };
}
