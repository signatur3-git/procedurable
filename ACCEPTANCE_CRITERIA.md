# Procedurable – Acceptance Criteria, Sanity Checks, and Demo Roadmap

This document replaces the lost “plan” and turns the big vision into **objective pass/fail gates**.

The goal is to validate (or invalidate) this premise:

> **Premise:** We can generate useful 3D scenes and assets from measurements / CAD-like rules + seed-driven variation, with minimal artist labor, while leaving the door open for sophisticated rigs later.

---

## 0) Quick glossary

- **Determinism:** same seed + same spec → identical output.
- **Spec:** a compact user intention description (e.g. `"bedroom, modern, 2 people"`).
- **Builder:** orchestrates sub-builders and placement.
- **MeshModeler:** Blender-like connected modeling operations (extrude/bridge/inset…)
- **SafePrimitives:** validated “safe” construction blocks (boxes/rods/panels) with known bounds.
- **SceneNode:** scene graph + transform hierarchy; flattens to a render mesh.

---

## 1) Acceptance criteria (what “good” looks like)

### A. Reproducibility / determinism
**A1.** Given the same **seed + scene spec**, the generator produces:
- identical **object counts** and types
- identical **vertex/face counts** per object
- identical **AABB** (axis-aligned bounding box) per object within ε (e.g. 1e-6)

**A2.** Given different seeds, output varies (not just positions)—at least **N distinct variants** per asset family across 20 seeds (N target: 10) while still respecting constraints.

### B. Geometric validity
**B1.** Mesh validity checks pass for every generated mesh:
- no NaNs/Infinity
- all face indices valid
- all faces have ≥ 3 vertices after triangulation

**B2.** Normal/winding sanity:
- outward normal majority check passes for closed “solid” primitives (cylinders/boxes/panels)
- no obvious inverted surfaces in demo

**B3.** Topological expectations (for connected modeling):
- MeshModeler-built assets intended to be single shells are **connected** (one component) *or* explicitly tagged as multi-part.

### C. Dimensional correctness (real-world measurements)
**C1.** Everything declares units (meters) and adheres to dimension conventions.

**C2.** Furniture/room clearances:
- chair sits on floor (minY≈0 after placement)
- table legs reach floor (minY≈0)
- persons stand on floor (minY≈0)
- furniture stays within room boundaries within tolerance

### D. Composability / builder delegation
**D1.** “City→district→building…” style delegation works for at least one interior stack:

- `IndoorSceneBuilder` delegates to:
  - `RoomBuilder`
  - `FurnitureBuilder` (table + N chairs + 1 prop)
  - `PlantBuilder`
  - `PersonBuilder` (0–2)

**D2.** Every builder returns a consistent type:
- either `SceneNode` hierarchy (preferred), or
- a `GeneratedAsset` wrapper containing mesh + metadata

**D3.** Scene flattening is stable:
- `SceneNode.toMesh()` reproduces the same mesh each time (no accidental mutation).

### E. Minimal artist input (core premise)
We need to define how strict we are. Two tiers:

**Tier 1 (realistic, recommended):**
- seed + 2–6 style tokens + optional constraints
- no manual modeling; no custom meshes required

**Tier 2 (hard mode):**
- seed-only (style inferred)

**E1.** Tier 1 demo must produce a coherent indoor scene using only:
- `seed`
- `style` (e.g. modern/rustic)
- `room size` (or default)
- `occupants` (0–2)

**E2.** The demo scene must be “plausible enough” without artist touch:
- correct scale
- no exploded geometry
- no obvious severe intersections

### F. Rigging readiness (future proofing)
We don’t need animation now, but we need *riggable assets later*.

**F1.** Person generator produces:
- a skeleton graph (bones) that is a tree (single root, no cycles)
- seam metadata for attach points (neck, shoulders, hips)

**F2.** Skin weights (optional early gate):
- if weights exist, weights per vertex sum to ~1 (±0.05)

**F3.** Seam compatibility checks exist:
- joining head↔neck, arm↔shoulder, leg↔hip is predictable across seeds.

### G. Performance budgets (prototype-level)
**G1.** Generating an indoor scene with ~10–30 meshes happens within a chosen budget:
- target: < 200ms generation in dev (soft gate)

**G2.** Render budget stays reasonable:
- vertex count < ~300k for demo scene (soft gate)

---

## 2) Sanity checks (theoretical validation suite)

These are “if we can’t satisfy these, the premise is shaky.”

### Primitive invariants
- bounds invariants for SafePrimitives
- normal direction sanity per primitive family

### Assembly invariants
- transform invariants: `SceneNode` flattening matches expected transforms
- placement invariants: floor contact and wall bounds
- overlap invariants: cheap AABB overlap heuristic below threshold

### Seam invariants
We need a seam contract:
- seam has `center`, `normal`, `radius`, `loopIndices`
- compatibility predicate:
  - vertex counts match (or resample)
  - radii match within tolerance
  - normals are opposite-ish

### Rig invariants
- bones form a DAG tree
- weights (if present) normalize

---

## 3) A demo that actually validates the concept

A good validation demo is *not* “it renders.” It is: “This could replace an artist for early prototype content.”

### Demo contract (input)
A single JSON-ish spec:

```ts
interface IndoorSceneSpec {
  seed: number;
  style: 'modern' | 'rustic' | 'minimal';
  room: { width?: number; depth?: number; height?: number };
  occupants: 0 | 1 | 2;
  props: { plants: number; chairs?: number; tables?: number };
}
```

### Demo output (what we must show)
- A finished room with:
  - 1 table + 2–6 chairs
  - 1–3 plants
  - 0–2 persons
- A console “report”:
  - deterministic stamp: seed/spec hash
  - counts: verts/faces per asset
  - validity: PASS/FAIL per mesh
  - placement: PASS/FAIL (floor + wall bounds)

### Why this validates the premise
- It exercises measurement-based modeling (dimensional correctness)
- It exercises hierarchical builders (delegation)
- It exercises connected modeling where needed (UV-ready direction)
- It demonstrates we can add rigs & seams without artists

---

## 4) Roadmap with kill-switch milestones

Each milestone has a **pass/fail gate**. If it fails, we reconsider the premise or change approach.

### Milestone 1 — Foundation trust
**Gate:** tests cover bounds + normals for core primitives AND MeshModeler outputs.
- Expand primitive tests to include `SafePrimitives` and a few `MeshModeler` shapes.
- Add a “mesh validity” checker.

**Fail means:** modeling ops are too unstable to extend safely.

### Milestone 2 — Canonical builder pipeline
**Gate:** one canonical pipeline exists and other demos are archived.
- `SceneNode` is the universal composition type.
- Builders produce `SceneNode` + metadata.

**Fail means:** the repo stays fragile; changes will break unrelated paths.

### Milestone 3 — Indoor scene generator (Tier 1)
**Gate:** `IndoorSceneSpec` generates a plausible room scene across 20 seeds.
- Must pass placement checks.
- Must show material/style variance.

**Fail means:** the “minimal artist input” premise is weak for interiors.

### Milestone 4 — Connected hero asset + UV readiness
**Gate:** at least one furniture piece is generated as a connected mesh suitable for UV unwrap.
- We don’t need perfect UVs yet, but we must be able to assign stable procedural UVs.

**Fail means:** we need to invest in UV strategy early or adopt a different representation.

### Milestone 5 — Seam assembly + rig proxy
**Gate:** build a humanoid proxy with seams + bones that can be assembled reliably.
- Show seam compatibility report.

**Fail means:** characters require more authored archetypes or a different pipeline.

---

## 5) What’s currently true in this repo

- ✅ `SceneNode` exists and flattens meshes.
- ✅ `SafePrimitives` exists with validation hooks.
- ✅ `MeshModeler` exists and already includes seams/bones/weights scaffolding.
- ⚠️ Docs (`README.md`, `PROJECT_SUMMARY.md`, `WHAT_YOU_SHOULD_SEE.md`) are out of sync with current reality.
- ⚠️ There are multiple competing builder/modeling paths in `src/builder/*`, `src/builders/*`, and `src/cad/*Designer*`.

---

## 6) Recommended next concrete tasks (2–4 hours)

1. **Write `meshValidityTests.ts`**
   - validate indices, NaNs, degenerate faces

2. **Write a `sceneReport.ts`**
   - prints deterministic stamp, counts, placement checks

3. **Create an `IndoorSceneBuilder`** (even if layout is crude)
   - consumes `IndoorSceneSpec`
   - delegates to Room/Furniture/Plant/Person

4. **Archive old demos**
   - move experimental mains into `src/demos/*`
   - keep one canonical `src/main.ts`

---

If you want, the next change I can implement is #1 + #2 (tests + reporting), because that gives you objective acceptance measurements immediately.

