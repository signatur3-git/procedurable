# Alignment Matrix - Problems × Solutions

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

| Builder | Loft | Lathe | Sweep | Spline | Subdiv | 2D Shapes | 2D Bool | CSG 3D | Materials | L-System | Cloth | Constraints | UVs | Bevel/Normals | Deformers | Export |
|---------|:----:|:-----:|:-----:|:------:|:------:|:---------:|:-------:|:------:|:---------:|:--------:|:-----:|:----------:|:---:|:------------:|:---------:|:------:|
| **Status** | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| | | | | | | | | | | | | | | | | |
| **FURNITURE** | | | | | | | | | | | | | | | | |
| Bookshelf | • | | | | | | | | • | | | ○ | ○ | ○ | | ○ |
| Desk | • | | | | | | | ○ | • | | | ○ | ○ | • | | ○ |
| Bed | • | | | | ○ | | | | • | ○ | ○ | ○ | ○ | | ○ | ○ |
| Sofa | • | | | | • | | | | • | | | ○ | ○ | | • | ○ |
| | | | | | | | | | | | | | | | | |
| **VESSELS** | | | | | | | | | | | | | | | | |
| Vase | | • | | • | | | | | • | | | | ○ | | | ○ |
| Bottle | | • | | • | | | | | • | | | | ○ | | | ○ |
| Bowl/Cup/Mug | | • | • | • | | | | | • | | | | ○ | | | ○ |
| | | | | | | | | | | | | | | | | |
| **ARCHITECTURE** | | | | | | | | | | | | | | | | |
| Simple Room | | | | | | • | | • | • | | | • | ○ | • | | ○ |
| Door | | | | | | • | • | • | • | | | ○ | ○ | • | | ○ |
| Window | | | | | | • | | • | • | | | ○ | ○ | • | | ○ |
| Staircase | • | | • | • | | | | | • | | | • | ○ | • | | ○ |
| | | | | | | | | | | | | | | | | |
| **BOTANICAL** | | | | | | | | | | | | | | | | |
| Simple Tree | | | • | • | | | | | • | • | | ○ | | | ○ | ○ |
| Potted Plant | | • | • | • | | | | | • | ○ | | ○ | ○ | | ○ | ○ |
| Flower | | | • | | | | | | • | | | ○ | | | ○ | ○ |
| | | | | | | | | | | | | | | | | |
| **MECHANICAL** | | | | | | | | | | | | | | | | |
| Gear | | | | | | • | • | | • | | | ○ | ○ | • | | ○ |
| Pipe Assembly | | | • | • | | | | | • | | | • | ○ | ○ | | ○ |
| Simple Machine | | • | | | | | | • | • | | | ○ | ○ | • | | ○ |
| | | | | | | | | | | | | | | | | |
| **SIGNAGE** | | | | | | | | | | | | | | | | |
| Wall Sign | | | | | | • | • | ○ | • | | | ○ | • | • | | ○ |
| Standing Sign | • | | | | | • | • | | • | | | ○ | • | • | | ○ |
| | | | | | | | | | | | | | | | | |
| **CLOTHING** | | | | | | | | | | | | | | | | |
| T-Shirt | | | | | | • | | | • | | • | • | ○ | | • | ○ |
| Pants | | | | | | • | | | • | | • | • | ○ | | • | ○ |
| Hat | | • | | | • | | | | • | | | ○ | ○ | | ○ | ○ |
| | | | | | | | | | | | | | | | | |
| **CHARACTERS** | | | | | | | | | | | | | | | | |
| Stylized Char | | | | | • | | | | • | | | ○ | ○ | | ○ | ○ |
| Person | • | | • | • | • | | | | • | | • | • | • | • | ○ | • |
| Animal | | | • | • | • | | | | • | | | • | ○ | | ○ | • |
| | | | | | | | | | | | | | | | | |
| **ENVIRONMENTS (NEW)** | | | | | | | | | | | | | | | | |
| Room Layout (Multi-Room) | | | | | | • | | • | • | | | • | ○ | • | | ○ |
| Streetscape Block | | | • | • | | • | | | • | ○ | | • | ○ | • | ○ | ○ |
| | | | | | | | | | | | | | | | | |
| **CLUTTER (NEW)** | | | | | | | | | | | | | | | | |
| Tabletop Clutter Set | | • | • | • | | | | | • | | | • | ○ | ○ | ○ | ○ |
| Books / Papers | • | | | | | | | | • | | | • | ○ | ○ | • | ○ |
| | | | | | | | | | | | | | | | | |
| **DEVICES (NEW)** | | | | | | | | | | | | | | | | |
| Desk Lamp | | • | • | • | ○ | | | | • | | | • | ○ | • | ○ | ○ |
| Monitor / TV | • | | | | | | | | • | | | ○ | • | • | | ○ |
| | | | | | | | | | | | | | | | | |
| **SOFT GOODS (NEW)** | | | | | | | | | | | | | | | | |
| Curtain / Blanket | | | | | ○ | | | | • | | • | • | ○ | | • | ○ |

---

## Tool Usage Count (Updated)

| Tool | Status | Notes |
|------|--------|-------|
| Loft | ✅ | Core for furniture/architecture |
| Lathe | ✅ | Vessels, pots, parts |
| Sweep | ✅ | Handles, pipes, organic tubes |
| Spline | ✅ | Required for sweep paths |
| Subdivision | ✅ | Organic smoothing |
| 2D Shapes | ⬜ | Next major unlock (gears, text, patterns) |
| 2D Boolean | ⬜ | Text holes, complex profiles |
| CSG 3D | ⬜ | Openings, mechanical cutouts |
| Constraints/Packing | ⬜ | Fix overlap/placement and scene plausibility |
| UVs | ⬜ | Required for serious materials + export |
| Bevel/Normals | ⬜ | Required for hard-surface quality |
| Deformers | ⬜ | Needed for soft goods, realism, non-perfectness |
| Export | ⬜ | glTF, sockets, colliders |

---

## Key Insights (Expanded)

1. **Constraints/Packing is the fastest quality multiplier for scenes**.
   It directly addresses chair overlap and clutter placement.
2. **2D Shapes is still the biggest breadth unlock** (gears/signage/moldings/clothing patterns).
3. **UVs + Bevel/Normals** are the minimum bar for "production-looking" hard-surface assets.
4. Deformers + static drape matter once we move into soft goods & clothing.
