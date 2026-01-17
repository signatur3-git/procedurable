# Milestone Acceptance Ladders (Sophistication Levels)

> **Purpose:** Keep milestone acceptance criteria explicit without bloating MASTER_PLAN or BACKLOG.
> Each Phase 2 milestone should declare three sophistication levels (L0-L2).

---

## Ladder Definition

1. **Level 0 — Sketch (Prototype):** Rough implementation for validation and demos.
2. **Level 1 — Production Baseline:** Correctness, repeatability, tooling integration, and authoring support.
3. **Level 2 — Sophisticated:** Domain-aware features, high-quality output, and advanced workflows.

**Rule:** Milestone "complete" means **Level 1** is satisfied.

---

## P2-M4: Text & Advanced 2D

### Level 0 — Sketch (Prototype)
- Rough letter approximations (procedural font) are acceptable for demos.
- Polygonized curves are acceptable for early validation.

### Level 1 — Production Baseline (Exit Criteria)
- Bezier-preserving Path2D with configurable tessellation tolerance.
- Text holes via 2D boolean operations (A, O, R, P, B).
- Extruded text supports bevels and consistent normals.
- Text-on-2D-path distortion with predictable spacing.

### Level 2 — Sophisticated (Typography-Aware)
- Typography metrics (baseline, x-height, ascender/descender) and kerning/ligatures.
- Calligraphic stroke modeling (variable stroke width, pen angle).
- Text-on-3D-path distortion with curvature-aware normals and stable UVs.

---

## Template for Future Milestones

```
## P2-MX: <Milestone Name>

### Level 0 — Sketch (Prototype)
- ...

### Level 1 — Production Baseline (Exit Criteria)
- ...

### Level 2 — Sophisticated (Domain-Aware)
- ...
```
