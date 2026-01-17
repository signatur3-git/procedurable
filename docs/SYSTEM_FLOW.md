# System Flow Map (High-Level)

> **Purpose:** Provide a single, high-level view of how data and commands flow through Procedurable.
> This document prevents duplicate implementations by clarifying which services own which responsibilities.

---

## 1) End-to-End Flow Overview

```
Authoring Input
  ├─ YAML builder files (storage)
  └─ DSL commands (agent / dashboard)
        ↓
MCP Server (execute_commands)
        ↓
Authoring Server
  ├─ Command registry + handlers
  └─ YamlBuilderParser
        ↓
Geometry Assembly
  ├─ Shape2D / Path2D
  ├─ Extrude / Boolean
  └─ Mesh + Materials
        ↓
Dashboard Visualization & Export
```

**Source of truth (high-level):**
- **Authoring intent:** YAML + DSL command stack are the canonical inputs.
- **Geometry primitives:** `Shape2D` / `Path2D` define the canonical 2D shape formats.
- **Mesh output:** Mesh + material data represent the canonical 3D output.

Avoid ad-hoc geometry generation outside `src/geometry/*` and `src/builder/*` so all authoring paths converge on the
same primitives.

---

## 2) Core Services (Intended Ownership)

| Service | Responsibility | Primary Location | Notes |
|--------|----------------|------------------|-------|
| `YamlBuilderParser` | Parse YAML builder files and emit geometry commands | `src/builder/YamlBuilderParser.ts` | Central entry point for builder authoring. |
| `ExpressionService` / `MathService` | Expression evaluation, derived values | `src/builder/ExpressionService.ts`, `src/core/MathService.ts` | All math/condition logic should be routed here. |
| `Shape2D` | 2D polygonal shapes | `src/geometry/Shape2D.ts` | Used by extrude and 2D ops; avoid duplicate shape formats. |
| `Path2D` | Bezier-preserving vector paths | `src/geometry/Path2D.ts` | Source for vector shapes before tessellation. |
| `Extrude` | Convert 2D shapes to 3D meshes | `src/geometry/Extrude.ts` | Single owner for extrusion variants. |
| `Boolean2D` / `CSG` | Boolean operations | `src/geometry/*` | 2D and 3D boolean ops should be centralized. |
| `FontParser` / `TextToShape` | Text layout, glyph extraction | `src/text/*` | Typography logic lives here, not in builders. |

---

## 3) Reuse Policy (Avoid Reimplementation)

**Do not duplicate:**
- Expression parsing or conditional logic outside `ExpressionService` / `MathService`.
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

## 5) Consolidation Targets (Concrete Follow-ups)

These are candidates where logic is duplicated or fragmented and should be consolidated:

1. **Shape2D creation mapping**
   - **Current split:** `YamlBuilderParser` and `geometry.shape2d` both map type → `Shape2D.*` constructors.
   - **Target owner:** A shared Shape2D factory helper (or expand `Shape2D.fromDef`) used by both authoring paths.
   - **Follow-up:** Create a shared helper in `src/geometry` and use it from both code paths.

2. **Text outline → extrusion path**
   - **Current split:** `TextToShape` outputs polygon contours, while YAML text extrusion groups holes directly in
     `YamlBuilderParser`.
   - **Target owner:** Text contour grouping should live in `src/text/*`, returning a contour structure that extrude can
     consume directly.
   - **Follow-up:** Move hole grouping + contour pairing into `TextToShape` or a dedicated text utility.

3. **Path tessellation + bezier preservation**
   - **Current split:** `Path2D` can preserve curves, but text and other sources still output polygon contours.
   - **Target owner:** `Path2D` should be the canonical curve container for fonts/YAML/SVG, with tessellation only at
     extrude/render time.
   - **Follow-up:** Extend `FontParser.getGlyphPath()` and downstream text paths to use `Path2D` end-to-end.

---

## 6) Supporting References

- `docs/ARCHITECTURE.md` - System design and components
- `docs/DSL_COMMANDS.md` - DSL command inventory
- `docs/YAML_BUILDER_FORMAT.md` - YAML format details
- `docs/BEZIER_CURVE_IMPLEMENTATION.md` - Path2D design details
