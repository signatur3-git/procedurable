# Alignment Matrix - Problems × Solutions

> ⚠️ **NOTE:** This document has been merged into `UNIFIED_ALIGNMENT.md`.
> See Section 1 of that document for the current Builders × Geometry Tools matrix.
> This file is kept for reference but may be removed in the future.

> Cross-reference of target builders vs required tools.
> Reveals optimal build order and gaps in current Phase 2 plan.

---

## Matrix Legend

- ✅ Tool built AND exposed via DSL
- 🔧 Tool built but NOT exposed via DSL
- ⬜ Tool not built
- • = Required for this builder
- ○ = Optional/enhances this builder

---

## Alignment Matrix (Expanded)

> This matrix now includes additional domains from `PROBLEM_DOMAIN.md` and additional tool pillars from `SOLUTION_DOMAIN.md`.
> The goal is to surface **missing high-leverage tooling** (constraints, UVs, bevels, deformers, export) early.
> Phase 3 columns (MorphTargets, Rigging, Animation, Physics) included for planning.

| Builder | Loft | Lathe | Sweep | Spline | Subdiv | 2D Shapes | 2D Bool | CSG 3D | Materials | L-System | Cloth | Constraints | UVs | Bevel/Normals | Deformers | Export | MorphTargets | Rigging | Animation | Fields | Scatter | Instancing | Chunking |
|---------|:----:|:-----:|:-----:|:------:|:------:|:---------:|:-------:|:------:|:---------:|:--------:|:-----:|:----------:|:---:|:------------:|:---------:|:------:|:------------:|:-------:|:---------:|:------:|:-------:|:----------:|:--------:|
| **Status** | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| | | | | | | | | | | | | | | | | | | | |
| **FURNITURE** | | | | | | | | | | | | | | | | | | | |
| Bookshelf | • | | | | | | | | • | | | ○ | ○ | ○ | | ○ | | | |
| Desk | • | | | | | | | ○ | • | | | ○ | ○ | • | | ○ | | | |
| Bed | • | | | | ○ | | | | • | ○ | ○ | ○ | ○ | | ○ | ○ | | | |
| Sofa | • | | | | • | | | | • | | | ○ | ○ | | • | ○ | | | |
| | | | | | | | | | | | | | | | | | | | |
| **VESSELS** | | | | | | | | | | | | | | | | | | | |
| Vase | | • | | • | | | | | • | | | | ○ | | | ○ | | | |
| Bottle | | • | | • | | | | | • | | | | ○ | | | ○ | | | |
| Bowl/Cup/Mug | | • | • | • | | | | | • | | | | ○ | | | ○ | | | |
| | | | | | | | | | | | | | | | | | | | |
| **ARCHITECTURE** | | | | | | | | | | | | | | | | | | | |
| Simple Room | | | | | | • | | • | • | | | • | ○ | • | | ○ | | | |
| Door | | | | | | • | • | • | • | | | ○ | ○ | • | | ○ | | | |
| Window | | | | | | • | | • | • | | | ○ | ○ | • | | ○ | | | |
| Staircase | • | | • | • | | | | | • | | | • | ○ | • | | ○ | | | |
| | | | | | | | | | | | | | | | | | | | |
| **BOTANICAL** | | | | | | | | | | | | | | | | | | | |
| Simple Tree | | | • | • | | | | | • | • | | ○ | | | ○ | ○ | | | |
| Potted Plant | | • | • | • | | | | | • | ○ | | ○ | ○ | | ○ | ○ | | | |
| Flower | | | • | | | | | | • | | | ○ | | | ○ | ○ | | | |
| | | | | | | | | | | | | | | | | | | | |
| **MECHANICAL** | | | | | | | | | | | | | | | | | | | |
| Gear | | | | | | • | • | | • | | | ○ | ○ | • | | ○ | | | |
| Pipe Assembly | | | • | • | | | | | • | | | • | ○ | ○ | | ○ | | | |
| Simple Machine | | • | | | | | | • | • | | | ○ | ○ | • | | ○ | | | ○ |
| | | | | | | | | | | | | | | | | | | | |
| **SIGNAGE** | | | | | | | | | | | | | | | | | | | |
| Wall Sign | | | | | | • | • | ○ | • | | | ○ | • | • | | ○ | | | |
| Standing Sign | • | | | | | • | • | | • | | | ○ | • | • | | ○ | | | |
| | | | | | | | | | | | | | | | | | | | |
| **CLOTHING** | | | | | | | | | | | | | | | | | | | |
| T-Shirt | | | | | | • | | | • | | • | • | ○ | | • | ○ | | | |
| Pants | | | | | | • | | | • | | • | • | ○ | | • | ○ | | | |
| Hat | | • | | | • | | | | • | | | ○ | ○ | | ○ | ○ | | | |
| | | | | | | | | | | | | | | | | | | | |
| **CHARACTERS** | | | | | | | | | | | | | | | | | | | |
| Stylized Char | | | | | • | | | | • | | | ○ | ○ | | ○ | ○ | ○ | ○ | ○ |
| Person | • | | • | • | • | | | | • | | • | • | • | • | ○ | • | • | • | • |
| Animal | | | • | • | • | | | | • | | | • | ○ | | ○ | • | ○ | • | • |
| | | | | | | | | | | | | | | | | | | | |
| **ENVIRONMENTS** | | | | | | | | | | | | | | | | | | | |
| Room Layout | | | | | | • | | • | • | | | • | ○ | • | | ○ | | | |
| Streetscape | | | • | • | | • | | | • | ○ | | • | ○ | • | ○ | ○ | | | |
| | | | | | | | | | | | | | | | | | | | |
| **CLUTTER** | | | | | | | | | | | | | | | | | | | |
| Tabletop Clutter | | • | • | • | | | | | • | | | • | ○ | ○ | ○ | ○ | | | |
| Books / Papers | • | | | | | | | | • | | | • | ○ | ○ | • | ○ | | | |
| | | | | | | | | | | | | | | | | | | | |
| **DEVICES** | | | | | | | | | | | | | | | | | | | |
| Desk Lamp | | • | • | • | ○ | | | | • | | | • | ○ | • | ○ | ○ | | | ○ |
| Monitor / TV | • | | | | | | | | • | | | ○ | • | • | | ○ | | | |
| | | | | | | | | | | | | | | | | | | | |
| **SOFT GOODS** | | | | | | | | | | | | | | | | | | | |
| Curtain / Blanket | | | | | ○ | | | | • | | • | • | ○ | | • | ○ | | | |
| | | | | | | | | | | | | | | | | | | | |
| **HYBRIDS (NEW)** | | | | | | | | | | | | | | | | | | | |
| Toilet-Throne | • | | | | | | | | • | | | ○ | ○ | • | | ○ | | | |
| Griffin | | | • | • | • | | | | • | | | • | ○ | | | • | ○ | • | |
| Mermaid | • | | • | • | • | | | | • | | | • | ○ | | | • | • | • | |
| Steampunk [Object] | | • | | | | • | | | • | | | ○ | ○ | • | | ○ | | | |

---

## Tool Usage Count (Updated)

| Tool | Status | Phase | Notes |
|------|--------|-------|-------|
| Loft | ✅ | 1 | Core for furniture/architecture |
| Lathe | ✅ | 1 | Vessels, pots, parts |
| Sweep | ✅ | 1 | Handles, pipes, organic tubes |
| Spline | ✅ | 1 | Required for sweep paths |
| Subdivision | ✅ | 1 | Organic smoothing |
| 2D Shapes | ⬜ | 2 | Next major unlock (gears, text, patterns) |
| 2D Boolean | ⬜ | 2 | Text holes, complex profiles |
| CSG 3D | ⬜ | 2 | Openings, mechanical cutouts |
| Constraints/Packing | ⬜ | 2 | Fix overlap/placement, scene plausibility |
| UVs | ⬜ | 2 | Required for serious materials + export |
| Bevel/Normals | ⬜ | 2 | Required for hard-surface quality |
| Deformers | ⬜ | 2 | Soft goods, realism, non-perfectness |
| Export | ⬜ | 2 | glTF, sockets, colliders |
| Sockets/Seaming | ⬜ | 2.5/3 | Hybrids, modular characters, attachments |
| MorphTargets | ⬜ | 2.5 | Ethnicity, expressions, body types |
| Rigging | ⬜ | 3 | Skeleton, weights, skinning |
| Animation | ⬜ | 3 | Keyframes, clips, curves |
| Physics | ⬜ | 3+ | Mass, dynamics, bake to keyframes |

---

## Key Insights (Expanded)

1. **Constraints/Packing is the fastest quality multiplier for scenes**.
   It directly addresses chair overlap and clutter placement.
2. **2D Shapes is still the biggest breadth unlock** (gears/signage/moldings/clothing patterns).
3. **UVs + Bevel/Normals** are the minimum bar for "production-looking" hard-surface assets.
4. Deformers + static drape matter once we move into soft goods & clothing.
5. **MorphTargets** are needed before Characters (P2-M9) for ethnicity/body type variation.
6. **Phase 3 tools** (Rigging, Animation, Physics) require Phase 2 foundation work.

---

## Phase 3 Tools (Future)

These columns are included for planning purposes. They are NOT Phase 2 scope.

| Tool | Phase | Foundation Needed in Phase 2 |
|------|-------|------------------------------|
| MorphTargets | 2.5 | `Mesh.morphTargets: Map<string, Vec3[]>` storage |
| Rigging | 3 | Extended Vertex (boneIndices, boneWeights) |
| Animation | 3 | Keyframe data structures, reuse Spline for curves |
| Physics | 3+ | Material.density, volume calculation, external lib |

See `SOLUTION_DOMAIN.md` Categories 20-24 for implementation details.
