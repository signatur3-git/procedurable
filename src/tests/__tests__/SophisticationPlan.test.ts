/**
 * Sophistication Plan Tests (A4-002)
 *
 * Tests compareSophisticationPlan() for plan-to-gate comparison.
 */

import { describe, it, expect } from '@jest/globals';
import { compareSophisticationPlan, SophisticationPlan, ValidationContext } from '../../generation/validation/ValidationAPI';
import { Mesh } from '../../platform/geometry/Mesh';
import { Vertex } from '../../platform/geometry/Vertex';
import { Face } from '../../platform/geometry/Face';
import { Vec3 } from '../../platform/math/Vec3';

// ── Helpers ──────────────────────────────────────────────────────────────

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
  const faces = [
    new Face([0, 1, 2, 3], color),
    new Face([5, 4, 7, 6], color),
    new Face([4, 0, 3, 7], color),
    new Face([1, 5, 6, 2], color),
    new Face([3, 2, 6, 7], color),
    new Face([4, 5, 1, 0], color),
  ];
  return new Mesh(verts, faces);
}

function makeTraces(groupNames: string[], prefixes?: Record<string, string>): Map<string, any> {
  const traces = new Map<string, any>();
  for (const name of groupNames) {
    const prefix = prefixes?.[name] || 'loft';
    traces.set(`${prefix}:${name}`, { type: prefix, name });
  }
  return traces;
}

function makeDecisions(names: string[]): Map<string, any> {
  const decisions = new Map<string, any>();
  for (const name of names) {
    decisions.set(name, { value: 'test', source: 'default' });
  }
  return decisions;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('compareSophisticationPlan', () => {
  const simplePlan: SophisticationPlan = {
    builder: 'TestChair',
    domain: 'furniture/seating',
    tier_0_placeholder: {
      description: 'Bounding volumes',
      parts: ['seat_box', 'leg_cylinders'],
      tools_needed: ['box'],
      decisions: ['seat_height']
    },
    tier_1_silhouette: {
      description: 'Recognizable shape',
      parts: {
        seat: 'Flat slab',
        legs: 'Tapered cylinders',
        back: 'Panel'
      },
      tools_needed: ['box', 'loft'],
      decisions: ['leg_taper', 'has_stretchers'],
      upgrades_from_t0: ['Legs use loft']
    },
    tier_2_form_resolved: {
      description: 'Believable chair',
      parts: {
        seat: { geometry: 'Box with edges' },
        legs: { geometry: 'Loft per style' },
        back: { geometry: 'Style variants' },
        stretchers: { geometry: 'Rods' }
      },
      tools_needed: ['loft', 'lathe', 'multi_material'],
      decisions_that_affect_geometry: [
        'back_style -> different back geometry',
        'leg_style -> different cross-section'
      ],
      materials: ['wood', 'cushion']
    }
  };

  it('passes when all planned parts, decisions, and tools are present', () => {
    const mesh = makeBox(0.45, 0.45, 0.45);
    const traces = makeTraces(['seat', 'legs', 'back'], { seat: 'face', legs: 'loft', back: 'loft' });
    const decisions = makeDecisions(['seat_height', 'leg_taper', 'has_stretchers']);

    const context: ValidationContext = {
      builderName: 'TestChair',
      mesh,
      traces,
      decisions,
      qualityMeta: { current_tier: 1 }
    };

    const result = compareSophisticationPlan(simplePlan, context, 1);

    expect(result.builder).toBe('TestChair');
    expect(result.tier_checked).toBe(1);
    // All parts from tier 0+1 should be checked
    const partChecks = result.checks.filter(c => c.category === 'parts');
    expect(partChecks.length).toBeGreaterThan(0);

    // All tier 0+1 decisions should be checked
    const decisionChecks = result.checks.filter(c => c.category === 'decisions');
    expect(decisionChecks.every(c => c.status === 'pass')).toBe(true);
  });

  it('detects missing parts', () => {
    const mesh = makeBox(0.45, 0.45, 0.45);
    // Only seat - missing legs and back
    const traces = makeTraces(['seat'], { seat: 'face' });
    const decisions = makeDecisions(['seat_height']);

    const context: ValidationContext = {
      builderName: 'TestChair',
      mesh,
      traces,
      decisions,
      qualityMeta: { current_tier: 1 }
    };

    const result = compareSophisticationPlan(simplePlan, context, 1);

    const failedParts = result.checks.filter(c => c.category === 'parts' && c.status === 'fail');
    expect(failedParts.length).toBeGreaterThan(0);
    // legs and back should be missing
    const failedNames = failedParts.map(c => c.name);
    expect(failedNames).toContain('legs');
    expect(failedNames).toContain('back');
  });

  it('detects uncovered decisions', () => {
    const mesh = makeBox(0.45, 0.45, 0.45);
    const traces = makeTraces(['seat', 'legs', 'back'], { seat: 'face', legs: 'loft', back: 'loft' });
    // Missing has_stretchers decision
    const decisions = makeDecisions(['seat_height', 'leg_taper']);

    const context: ValidationContext = {
      builderName: 'TestChair',
      mesh,
      traces,
      decisions,
      qualityMeta: { current_tier: 1 }
    };

    const result = compareSophisticationPlan(simplePlan, context, 1);

    const failedDecisions = result.checks.filter(c => c.category === 'decisions' && c.status === 'fail');
    expect(failedDecisions.length).toBeGreaterThan(0);
    expect(failedDecisions.some(c => c.name === 'has_stretchers')).toBe(true);
  });

  it('checks tier 2 with decisions_that_affect_geometry', () => {
    const mesh = makeBox(0.45, 0.45, 0.45);
    const traces = makeTraces(
      ['seat', 'legs', 'back', 'stretchers'],
      { seat: 'face', legs: 'loft', back: 'loft', stretchers: 'loft' }
    );
    // Include tier 2 decisions
    const decisions = makeDecisions([
      'seat_height', 'leg_taper', 'has_stretchers',
      'back_style', 'leg_style'
    ]);

    const context: ValidationContext = {
      builderName: 'TestChair',
      mesh,
      traces,
      decisions,
      qualityMeta: { current_tier: 2 }
    };

    const result = compareSophisticationPlan(simplePlan, context, 2);

    expect(result.tier_checked).toBe(2);
    // back_style and leg_style from decisions_that_affect_geometry should be checked
    const decisionChecks = result.checks.filter(c => c.category === 'decisions');
    const decisionNames = decisionChecks.map(c => c.name);
    expect(decisionNames).toContain('back_style');
    expect(decisionNames).toContain('leg_style');
  });

  it('skips deferred tiers', () => {
    const planWithDeferred: SophisticationPlan = {
      builder: 'TestVase',
      domain: 'vessels',
      tier_1_silhouette: {
        description: 'Lathed profile',
        parts: { body: 'Lathed vase' },
        tools_needed: ['lathe'],
        decisions: ['height_variation']
      },
      tier_3_detail: {
        description: 'Deferred',
        parts: { surface: 'displacement' },
        tools_needed: ['noise_displacement'],
        deferred: true,
        notes: 'Not yet implemented'
      }
    };

    const mesh = makeBox(0.1, 0.25, 0.1);
    const traces = makeTraces(['body'], { body: 'mesh' });
    const decisions = makeDecisions(['height_variation']);

    const context: ValidationContext = {
      builderName: 'TestVase',
      mesh,
      traces,
      decisions,
      qualityMeta: { current_tier: 3 }
    };

    // Even checking tier 3, deferred parts shouldn't fail
    const result = compareSophisticationPlan(planWithDeferred, context, 3);
    const partChecks = result.checks.filter(c => c.category === 'parts');
    // Only body should be checked (tier_3 is deferred)
    expect(partChecks.every(c => c.name !== 'surface')).toBe(true);
  });

  it('returns correct summary counts', () => {
    const mesh = makeBox(0.45, 0.45, 0.45);
    const traces = makeTraces(['seat'], { seat: 'face' });
    const decisions = makeDecisions(['seat_height']);

    const context: ValidationContext = {
      builderName: 'TestChair',
      mesh,
      traces,
      decisions,
      qualityMeta: { current_tier: 0 }
    };

    const result = compareSophisticationPlan(simplePlan, context, 0);

    expect(result.summary.passed + result.summary.failed + result.summary.skipped)
      .toBe(result.checks.length);
  });
});
