# Quality Tiers & Sophistication Framework for Procedurable Builders

> **Date:** 2026-01-31
> **Purpose:** Define what "good enough" means at each level, give agents concrete criteria to self-evaluate, and prevent premature declaration of completion.

---

## 1. The Problem

Agents produce stick-figure-quality output and call it done. This happens because:

1. **No quality criteria exist in the builder format.** There is nothing in a YAML builder that says "this is draft quality" or "this needs beveled edges." The agent writes geometry that renders without errors and stops.

2. **Validation only checks correctness, not quality.** The existing `ValidationAPI` checks mesh validity (no NaN, indices in range), scale, and basic ergonomics. It doesn't check whether a chair back is a single floating quad or a properly modeled panel with thickness.

3. **No reference point for what "done" looks like.** An agent has no way to compare its output against expectations for the target quality level.

4. **Decisions exist but don't connect to geometry.** The DiningChair declares `back_style: [solid, slat, ladder, spindle]` but the geometry section only implements a single quad regardless of style. The decision is decorative, not functional.

---

## 2. Quality Tier Definitions

Every builder should declare its target tier and current tier. This makes the gap visible.

### Tier 0: Placeholder / Bounding Volume
**What it looks like:** Boxes representing approximate volumes. A chair is 3-4 boxes.
**Purpose:** Layout testing, spatial planning, composition prototyping.
**Geometry:** Primitives only (box, cylinder). No lofts, no profiles.
**Decisions:** Dimensions only (height, width, depth).
**Triangle budget:** < 100 triangles.
**When this is acceptable:** Scene layout, collision volumes, early composition testing.

### Tier 1: Sketch / Silhouette Correct
**What it looks like:** The object is recognizable from its silhouette. A chair has a seat, four legs, and a back -- but they're simple cylinders and slabs.
**Purpose:** Shape language exploration, proportion testing.
**Geometry:** Lofts, basic lathe. No edge treatment. Single-material parts.
**Decisions:** Proportions and major style choices (round vs square legs).
**Triangle budget:** 100-1,000 triangles.
**When this is acceptable:** Background objects, distant LOD, rapid prototyping.
**This is where DiningChair.yaml currently sits** (and where agents typically stop).

### Tier 2: Form-Resolved / Solid Model
**What it looks like:** Each part has proper 3D volume. The seat has thickness and edge radius. Legs have proper cross-sections. The back is a panel, not a floating quad.
**Purpose:** Mid-ground assets, furniture catalogs, indoor scenes.
**Geometry requirements:**
- All parts are closed meshes (watertight or visually closed)
- No single-face "panels" -- everything has thickness
- Edge profiles match the style (rounded for organic, chamfered for modern)
- Conditional decisions produce different geometry (slat back ≠ solid back)
- At least 2 materials/colors distinguishing parts
**Decisions:** Style choices that map to real geometry differences. Material selections.
**Triangle budget:** 1,000-10,000 triangles.
**When this is acceptable:** Most game/viz assets, hero furniture, product visualization.

### Tier 3: Detail-Resolved / Production Asset
**What it looks like:** Close-up ready. Joinery is visible or implied. Edge bevels catch light. Material boundaries are clean. Hardware (screws, brackets) exists where structurally necessary.
**Purpose:** Hero assets, close-up shots, product renders.
**Geometry requirements:**
- Everything from Tier 2 plus:
- Edge bevels/chamfers on hard edges
- Joinery details (mortise-tenon implied through geometry, dowel caps visible)
- Proper cross-sections (legs aren't perfect circles -- they have flats or fluting)
- Surface variation (subtle noise displacement for "handmade" feel)
- UVs for texture mapping
**Decisions:** Wood species affecting grain direction. Construction method affecting joinery visibility. Finish type (lacquer smooth vs hand-rubbed matte).
**Triangle budget:** 10,000-100,000 triangles.
**When this is acceptable:** Product visualization, architectural visualization, hero shots.

### Tier 4: Art-Directed / Portfolio Quality
**What it looks like:** Could appear in a studio portfolio. Every edge is intentional. Materials are layered (base + wear + finish). Proportions reference real design traditions.
**Purpose:** Showcase, portfolio, cinematic.
**Geometry requirements:**
- Everything from Tier 3 plus:
- Subdivision-ready topology (edge loops at curvature changes)
- Material layer stacks (base color + wear mask + finish)
- Proper UV unwrap with consistent texel density
- LOD variants
- Export-ready (glTF with materials)
**Not achievable with current tools.** This is the aspirational target.

---

## 2.1 Reference Builders

Each tier has a reference implementation that demonstrates exactly what that quality level looks like. Compare your builders against these references.

| Tier | Reference Builder | Description |
|------|------------------|-------------|
| 0 | [`builders/examples/ChairTier0.yaml`](../builders/examples/ChairTier0.yaml) | Bounding boxes only. Boxes for seat, legs, back. |
| 1 | [`builders/examples/ChairTier1.yaml`](../builders/examples/ChairTier1.yaml) | Silhouette correct. Lofted legs, proper seat slab, flat back panel. |
| 2 | [`builders/examples/ChairTier2.yaml`](../builders/examples/ChairTier2.yaml) | Form-resolved. back_style produces different geometry, multi-material, closed meshes. |

### What Makes Each Tier

**Tier 0 → Tier 1 transition:**
- Replace box primitives with lofts (legs)
- Add proper proportioned parts
- Add conditional geometry (stretchers)

**Tier 1 → Tier 2 transition:**
- Decisions produce DIFFERENT geometry (not just metadata)
- All meshes are closed volumes
- Multiple materials distinguish parts
- Named parts have proper 3D thickness

### Using References for Quality Assessment

1. Open your builder alongside the reference
2. Check: Does your builder have the same structural parts?
3. Check: Do your decisions actually change the output like the reference?
4. Check: Does your builder use the same tool complexity (lofts, conditionals, etc.)?

---

## 3. Builder Quality Declaration (Proposed YAML Addition)

```yaml
# Added to every builder
quality:
  target_tier: 2           # What this builder SHOULD achieve
  current_tier: 1          # What it currently achieves (honest self-assessment)
  tier_gaps:               # What's missing to reach target
    - "Back is a single quad -- needs thickness and style variants"
    - "No edge treatment on seat (sharp box edges)"
    - "Decisions back_style/seat_shape don't affect geometry"
    - "Single material -- needs wood + upholstery distinction"

  # Per-part assessment
  parts:
    seat:
      tier: 1
      notes: "Raw box, no edge radius, no contour"
    legs:
      tier: 2
      notes: "Tapered loft with caps, reasonable quality"
    back:
      tier: 0
      notes: "Single floating quad, not a real panel"
    stretchers:
      tier: 1
      notes: "Simple cylinders, acceptable for stretchers"
```

This is the single most impactful change. When an agent sees `current_tier: 1` and `target_tier: 2` with explicit gaps listed, it has a concrete TODO list instead of declaring victory.

---

## 4. Quality Gate System (Automated Checks)

Extend `ValidationAPI` with tier-aware checks that **fail the build** if the declared tier isn't met.

### Tier 1 Gates (Silhouette)
- [ ] All declared parts exist in geometry output
- [ ] Bounding box proportions match real-world expectations (from measurements)
- [ ] No zero-volume parts (degenerate faces only)
- [ ] At least N distinct geometry groups (a chair needs >= 3: seat, legs, back)

### Tier 2 Gates (Form-Resolved)
- [ ] No single-face parts (minimum 6 faces for any named part = a box)
- [ ] All decision options produce distinct geometry (diff mesh between option A and option B)
- [ ] Closed mesh check per part (no boundary edges, or boundary edges are intentional)
- [ ] Material variety: at least 2 distinct materials/colors
- [ ] Part dimensions are proportionally consistent (leg thickness vs seat thickness)

### Tier 3 Gates (Detail-Resolved)
- [ ] Edge bevel present on hard edges (detectable via edge angle analysis)
- [ ] Surface vertex count suggests detail (not just stretched quads)
- [ ] Variation across seeds: at least N measurements change between seeds
- [ ] No perfectly parallel/perpendicular surfaces (subtle angle variation = "handmade")

### Implementation Approach

```typescript
// New: QualityGate checks added to ValidationAPI
interface QualityGateResult {
  tier: number;
  gates_passed: string[];
  gates_failed: string[];
  achieved_tier: number;  // Highest tier where ALL gates pass
  suggestions: string[];  // Specific actions to reach next tier
}

function evaluateQualityTier(context: ValidationContext): QualityGateResult {
  // Run tier 1 gates
  // If all pass, run tier 2 gates
  // Return achieved tier + specific failures
}
```

---

## 5. Sophistication Planning Workflow

Before writing geometry, an agent should produce a **sophistication plan** -- a document that describes what the builder will do at each tier and what tools/techniques are needed.

### Example: Chair Sophistication Plan

```yaml
# chair-sophistication-plan.yaml
builder: DiningChair
domain: furniture/seating

tier_0_placeholder:
  description: "Bounding volumes for layout"
  parts: [seat_box, leg_cylinders_x4, back_box]
  tools_needed: [box, cylinder]
  decisions: [seat_height, seat_width, seat_depth]

tier_1_silhouette:
  description: "Recognizable chair shape"
  parts:
    seat: "Flat slab with correct proportions"
    legs: "Tapered cylinders (loft)"
    back: "Rectangular panel"
  tools_needed: [box, loft, circle]
  decisions: [leg_style, has_stretchers]
  upgrades_from_t0:
    - "Legs use loft for taper instead of raw cylinders"
    - "Back panel exists (even if thin)"

tier_2_form_resolved:
  description: "Solid, believable chair"
  parts:
    seat:
      geometry: "Box with rounded top edges (subdivide or profile extrude)"
      detail: "Slight concave contour on sitting surface"
    legs:
      geometry: "Loft with proper cross-section per style"
      detail: "Square legs get chamfered corners, round legs taper smoothly"
      variation: "leg_style actually changes cross-section geometry"
    back:
      geometry: "Different per back_style:"
      variants:
        solid: "Panel with thickness, slight curve, rounded top edge"
        slat: "N vertical slats with gaps, each a lofted bar"
        ladder: "N horizontal rungs between uprights"
        spindle: "N turned spindles (lathe profile)"
    stretchers:
      geometry: "Turned rods between legs"
      detail: "Slightly thicker at center (lathe profile)"
  tools_needed: [loft, lathe, subdivide, conditional_geometry, multi_material]
  decisions_that_affect_geometry:
    - "back_style -> completely different back geometry"
    - "leg_style -> different cross-section"
    - "seat_shape -> different seat profile"
  materials:
    - "wood_body: varies by wood_type decision"
    - "cushion: optional, different color"

tier_3_detail:
  description: "Close-up ready chair"
  requires_tools_not_yet_built: [bevel, noise_displacement, UV_generation]
  deferred: true
  notes: "Document what would be needed but don't attempt"
```

### Schema Reference

Sophistication plans use the `.plan.yaml` extension and live in `builders/plans/`. The schema:

```yaml
builder: string          # Builder name (must match a builder YAML)
domain: string           # Domain path (e.g., "furniture/seating")

# One section per tier, keyed as tier_N_<label>:
tier_0_placeholder:
  description: string    # What this tier achieves
  parts: list | map      # Parts at this tier (list for T0, map with details for T1+)
  tools_needed: list     # Geometry tools required (box, loft, lathe, etc.)
  decisions: list        # Decisions active at this tier

tier_1_silhouette:
  description: string
  parts:
    <part_name>: string | map   # String summary or detailed map:
      geometry: string          #   How it's built
      detail: string            #   Surface quality notes
      variation: string         #   How decisions affect it
      variants:                 #   Per-option geometry (for choice decisions)
        <option>: string
  tools_needed: list
  decisions: list
  upgrades_from_t0: list        # What changed from previous tier

tier_2_form_resolved:
  description: string
  parts: map                    # Detailed part descriptions (see above)
  tools_needed: list
  decisions_that_affect_geometry: list  # Decision -> geometry mapping
  materials: list               # Named material slots

tier_3_detail:                  # Optional — document even if deferred
  description: string
  requires_tools_not_yet_built: list
  deferred: boolean
  notes: string
```

Plans are validated against builder output via `builder.check_plan` (see A4-002).

### Why This Matters

1. **Agents plan before building.** The sophistication plan forces the agent to think about what each decision actually does before writing geometry.

2. **Missing tools become visible early.** If Tier 2 requires "different geometry per back_style" and the agent realizes it doesn't know how to do conditional geometry properly, it surfaces that before producing a broken builder.

3. **Reviewers (human or agent) have a spec.** You can compare the builder output against the sophistication plan instead of vague "is this good enough?"

---

## 6. Decision-Geometry Binding Contract

The biggest quality problem in the current builders: **decisions that don't do anything.**

### The Rule

> Every decision option MUST produce a measurably different output. If a decision doesn't change the geometry or materials, it shouldn't exist.

### Enforcement

Add a `decision_coverage` validation that:
1. Runs the builder with each decision option forced
2. Compares the output meshes
3. Fails if any decision option produces identical geometry to another

```yaml
# In the quality section of a builder
decision_coverage:
  back_style:
    solid:   "back geometry uses box with thickness"
    slat:    "back geometry uses N vertical lofted bars"
    ladder:  "back geometry uses N horizontal lofted rungs"
    spindle: "back geometry uses N lathe-turned spindles"
  leg_style:
    round:   "8-segment circle cross-section"
    square:  "4-segment square cross-section"
    tapered: "round with taper_ratio < 0.8"
    turned:  "lathe profile with decorative rings"
```

This section serves as both documentation and a testable contract. The quality gate system can verify that switching `back_style` from "solid" to "slat" actually changes the vertex/face count.

---

## 7. Concrete Quality Metrics (Machine-Checkable)

These can be computed from mesh output without subjective judgment:

| Metric | Tier 1 Min | Tier 2 Min | Tier 3 Min |
|--------|-----------|-----------|-----------|
| Named parts with geometry | 3 | 5 | 8 |
| Min faces per part | 1 | 6 | 12 |
| Distinct materials/colors | 1 | 2 | 3 |
| Decision options that change output | 50% | 90% | 100% |
| Measurements with real-world source | 50% | 80% | 100% |
| Closed meshes (no boundary edges) | 0% | 80% | 100% |
| Seeds producing distinct output | any 2 | any 5 | any 10 |
| Degenerate triangle ratio | < 10% | < 2% | < 0.5% |

---

## 8. Agent Workflow Integration

### Before Starting a Builder
1. Agent reads domain reference (what does a real chair look like?)
2. Agent creates sophistication plan (tiers 0-2 minimum)
3. Agent identifies which tools are available vs missing
4. Agent declares target tier in builder YAML

### During Building
1. Start at Tier 0: get the volumes right
2. Upgrade to Tier 1: get the silhouette right
3. Upgrade to Tier 2: resolve each part properly
4. Run quality gates at each tier transition
5. Only declare done when `achieved_tier >= target_tier`

### After Building
1. Run with 5+ seeds, verify variety
2. Run decision coverage check
3. Run quality gate validation
4. Document remaining gaps in `quality.tier_gaps`

### Quality Gate as Build Blocker

The key behavioral change: **quality gates should produce structured failure output that agents treat as mandatory fixes**, not optional warnings.

Current behavior:
```
Agent: "Built the chair. Here's the preview. Done!"
```

Target behavior:
```
Agent: "Built the chair at Tier 1. Quality gates for Tier 2:"
Agent: "FAIL: back is single-face (need thickness)"
Agent: "FAIL: back_style decision doesn't change geometry"
Agent: "FAIL: only 1 material used"
Agent: "Fixing: adding back panel thickness..."
Agent: [continues until Tier 2 gates pass]
```

---

## 9. Implementation Priority

### Phase 1: Quality Declaration (No Code Changes)
- Add `quality:` section to YAML builder format spec
- Retrofit existing builders with honest tier assessments
- Write sophistication plans for 3 key builders (chair, table, vase)
- **This alone will change agent behavior** by making gaps visible in the file they're editing

### Phase 2: Automated Quality Gates
- Implement `evaluateQualityTier()` in ValidationAPI
- Add part-counting, face-counting, material-counting checks
- Wire into builder execution so results appear in trace output
- Make quality report available via DSL command (`builder.quality`)

### Phase 3: Decision Coverage Testing
- Implement forced-option builder execution
- Mesh diff comparison between option variants
- Report uncovered decisions

### Phase 4: Sophistication Plan as First-Class Format
- Define YAML schema for sophistication plans
- Agent generates plan before builder
- Plan becomes test spec for builder output

---

## 10. What This Doesn't Solve (Honest Limits)

- **Aesthetic judgment.** No automated system can tell you if a chair looks *good*. It can tell you if it has the right parts at the right scale with the right variety. Beauty is still a human/agent judgment call.

- **Missing geometry tools.** Tier 3 requires bevel, noise displacement, and UVs that don't exist yet. The framework correctly identifies these as blockers rather than pretending they're achievable.

- **Agent motivation.** An agent told "build a chair" with no quality context will still produce Tier 1. The framework works by making quality expectations **part of the file format** so agents encounter them naturally.

---

## Related Documents
- `FEASIBILITY_STUDY.md` -- Overall project assessment
- `SOLUTION_DOMAIN.md` -- Available tools inventory
- `AUTHORING_PROBLEM_DOMAIN.md` -- What authors need
