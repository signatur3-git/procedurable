# Quality Tiers

Three levels of geometric quality currently supported, with automated validation gates.

> **Updated:** 2026-02-03 (Phase 2 complete — all Tier 0-2 gates implemented)

## Overview

| Tier | Name | Triangles | Materials | Status |
|------|------|-----------|-----------|--------|
| 0 | Placeholder | < 100 | 0-1 | ✅ Automated gates |
| 1 | Sketch | 100-1,000 | 1 | ✅ Automated gates |
| 2 | Form-Resolved | 1,000-10,000 | 2+ | ✅ Automated gates |
| 3 | Detail-Resolved | 10,000-100,000 | 3+ | ⬜ Phase 3+ |
| 4 | Art-Directed | 100,000+ | Full PBR | ⬜ Future |

## Tier 0: Placeholder

**What it looks like:** Bounding boxes. A chair is a tall box (back) + flat box (seat) + thin boxes (legs).

**Automated checks:**
- Mesh exists and is valid
- Bounding box approximates real-world dimensions

**When to use:** Scene layout, spatial planning, testing composition before investing in geometry.

## Tier 1: Sketch / Silhouette

**What it looks like:** Recognizable shape but simplified. A chair has a flat seat, rectangular legs, a flat back panel. Everything is sharp-edged, single-material.

**Automated checks:**
- No degenerate geometry
- Reasonable proportions
- Minimum 100 triangles
- Recognizable as intended object

**Use case:** Rapid prototyping, testing composition and placement before investing in detail.

**Note:** Agents now have quality gates that signal when Tier 1 is insufficient, with machine-readable suggestions for upgrading to Tier 2.

## Tier 2: Form-Resolved ✅

**What it looks like:** All parts have 3D volume. Legs are rounded (lathe, not extrude). Edges are beveled. At least 2 materials. Different decisions produce visibly different results.

**Automated checks:**
- >= 6 faces per distinct part
- >= 1,000 total triangles
- >= 2 distinct material assignments
- All meshes are closed (watertight)
- Every `choice` decision produces geometrically distinct output
- No stick-figure parts (minimum cross-section per part)

**Platform requirements (all complete):**
- Bevel/chamfer [C2] ✅ — for edge treatment
- Material slots [C3] ✅ — for multi-material
- Quality gates [A2] ✅ — for automated checking
- Decision coverage testing [A3] ✅ — for verifying decisions matter

**This was the Phase 2 target — now achieved.** DiningChair and Vase are flagship Tier 2 examples with 100% decision coverage.

## Tier 3: Detail-Resolved (Phase 3+)

**What it looks like:** Edge bevels visible. Joinery details (mortise & tenon hints). Cross-sections are accurate (not circular approximations). Surface variation from noise/deformers. UV coordinates for texturing.

**Automated checks:**
- >= 10,000 triangles
- >= 3 materials
- Bevel present on hard edges
- UV coordinates assigned
- Surface normal smoothing appropriate
- Part-level detail (screws, joints, trim)

**Platform requirements:**
- Everything in Tier 2 ✅, plus:
- UV generation [C4] ✅
- Deformers [C5] ✅
- Part-level tagging (needs work)

**Status:** Infrastructure is ready from Phase 2. Tier 3 gates not yet automated.

## Tier 4: Art-Directed (Future)

**What it looks like:** Portfolio quality. Full PBR materials with textures. LOD variants for different viewing distances. Export-ready glTF with proper scene hierarchy. Animation-ready if applicable.

**Status:** Requires procedural textures (G3), LOD system (G2), and rigging (E-track) from Phase 3.

## Quality Declaration in YAML

```yaml
quality:
  target_tier: 2
  current_tier: 1
  tier_gaps:
    - id: legs_flat
      description: "Legs are rectangular prisms"
      fix: "Use lathe with turned leg profile"
      affects: [leg_front_left, leg_front_right, leg_back_left, leg_back_right]

    - id: no_bevel
      description: "All edges are sharp"
      fix: "Add bevel modifier, width 0.003, segments 2"
      affects: [all]

    - id: single_material
      description: "Only one material (vertex color)"
      fix: "Add material slots: frame=oak, cushion=fabric"
      affects: [seat, back]
```

This makes the gap between current and target quality **explicit, actionable, and machine-readable**.
