# System Flow Map (High-Level)

> **Purpose:** Provide a single, high-level view of how data and commands flow through Procedurable.
> This document prevents duplicate implementations by clarifying which services own which responsibilities.

---

## 1) End-to-End Flow Overview

```
Authoring (DSL/YAML)
  → Parser & Validation (YamlBuilderParser)
  → Geometry Assembly (Shape2D / Path2D / Extrude / Boolean)
  → Mesh Output (Mesh / Materials)
  → Dashboard Visualization & Export
```

**Source of truth:** The YAML/DSL parsing pipeline defines canonical geometry data structures.
We should avoid ad-hoc geometry generation outside `src/geometry/*` and `src/builder/*`.

---

## 2) Core Services (Intended Ownership)

| Service | Responsibility | Notes |
|--------|----------------|-------|
| `YamlBuilderParser` | Parse YAML builder files and build geometry commands | Central entry point for builder authoring. |
| `MathService` | Expression evaluation, derived values | All math/condition logic should be routed here. |
| `Shape2D` | 2D polygonal shapes | Used by extrude and 2D ops; avoid duplicate shape formats. |
| `Path2D` | Bezier-preserving vector paths | Source for vector shapes before tessellation. |
| `Extrude` | Convert 2D shapes to 3D meshes | Single owner for extrusion variants. |
| `Boolean2D` / `CSG` | Boolean operations | 2D and 3D boolean ops should be centralized. |
| `FontParser` / `TextToShape` | Text layout, glyph extraction | Typography logic lives here, not in builders. |

---

## 3) Reuse Policy (Avoid Reimplementation)

**Do not duplicate:**
- Expression parsing or conditional logic outside `MathService`.
- Shape definitions outside `Shape2D` / `Path2D`.
- Text layout logic outside `FontParser` / `TextToShape`.
- Extrusion logic outside `Extrude`.

**Preferred extension points:**
- Add new commands to `YamlBuilderParser` rather than custom builder logic.
- Add new geometry features inside `src/geometry/*` with documented APIs.
- Add authoring affordances via DSL commands rather than new ad-hoc file formats.

---

## 4) New Feature Checklist

Before implementing a new feature, answer:
1. **Where should the logic live?** (Which service owns it?)
2. **Is there an existing service that already solves 80%?**
3. **Can we add a command to the DSL/YAML format instead of a new ad-hoc format?**
4. **Does this need unit + integration tests?** (All DSL commands do.)

---

## 5) Supporting References

- `docs/ARCHITECTURE.md` - System design and components
- `docs/DSL_COMMANDS.md` - DSL command inventory
- `docs/YAML_BUILDER_FORMAT.md` - YAML format details
- `docs/BEZIER_CURVE_IMPLEMENTATION.md` - Path2D design details
