# Code Structure Evaluation

**Date**: 2026-01-31
**Scope**: `src/` directory — folder structure, component relationships, builder pipeline, missing abstractions
**Status**: ✅ **RESTRUCTURING COMPLETE** (2026-01-31)

---

## 0. Final Structure (Implemented)

The restructuring described in this document has been completed. The new folder structure is:

```
src/
├── platform/                "Core infrastructure"
│   ├── math/                    Vec3, Mat4, Transform, AABB, Spline, Random, MathService
│   ├── spatial/                 ScalarField, PoissonDisk, Scatter, Instance
│   ├── geometry/                Mesh, Vertex, Face, EdgeLoop, Path2D, Shape2D, Extrude, Sweep, Subdivision
│   ├── scene/                   SceneNode, SceneGraph, Placement
│   ├── materials/               MaterialLibrary
│   └── modifiers/               (placeholder for modifier stack)
│
├── generation/              "Content creation pipeline"
│   ├── builder/                 TracedBuilder, YamlBuilderParser, ExpressionService, SharedContext, SceneBuilder
│   ├── text/                    FontParser, ProceduralFont, TextToShape
│   ├── validation/              ValidationAPI, MeshChecks, MeshValidation
│   └── export/                  (placeholder for exporters)
│
├── servers/                 "External interfaces"
│   ├── authoring/               DSL server, commands
│   ├── mcp/                     MCP server variants
│   ├── dashboard/               Three.js preview
│   └── knowledge/               (placeholder for knowledge server)
│
├── storage/                 "Persistence layer"
│   └── StorageProvider, FileSystemStorage
│
├── demos/                   "Example content"
│   └── ChairBuilder, TableBuilder, PersonBuilder, MeshMapBaker
│
└── tests/
```

**Benefits achieved:**
- Top-level cognitive load reduced from 10+ folders to 6 domain groupings
- Clear separation between infrastructure (platform), engine (generation), interfaces (servers), and examples (demos)
- Each folder answers one question: "What is this for?"
- Dependency direction is clear: platform ← generation ← servers
- Room for future additions (modifiers, export, knowledge) is pre-allocated

---

## 1. Previous Folder Layout (Historical Reference)

```
src/
├── core/           13 files — math, spatial, scene node, RNG, instancing
├── geometry/       10 files — mesh, shapes, extrusion, sweep, subdivision
├── text/            3 files — font parsing, text-to-shape
├── builder/        11 files — TracedBuilder, YAML parser, scene graph,
│                              placement, materials, hardcoded builders
├── validation/      3 files — mesh checks, quality API
├── authoring/       3 files + 11 command handlers
├── mcp/             3 files — MCP server variants
├── storage/         3 files — provider interface + filesystem
├── dashboard/       1 file  — Three.js preview
└── tests/          15 files
```

### Problems identified

| Issue | Where | Why it matters |
|-------|-------|----------------|
| **`builder/` is a grab bag** | SceneGraph, SceneBuilder, Placement, MaterialLibrary, ExpressionService, MeshMapBaker, and 4 hardcoded builders all live together with TracedBuilder and YamlBuilderParser | A newcomer can't tell which files are *infrastructure* vs. *example content*. It's the largest folder and the hardest to navigate. |
| **Two competing SceneNode/SceneGraph** | `core/SceneNode.ts` (class-based, Transform + Mesh) vs. `builder/SceneGraph.ts` (interface-based, tags + AABB) | They solve different problems but share names. The `core` one is a proper transform hierarchy; the `builder` one is a semantic query index. Neither references the other. |
| **`core/` contains non-core things** | `PoissonDisk`, `Scatter`, `ScalarField`, `Instance` are *tools* that use core math — they aren't foundational types. `SceneNode` is a scene-graph concept, not a math primitive. | The folder name "core" implies Vec3/Mat4/Transform level primitives. Having spatial algorithms here inflates its scope. |
| **No `materials/` folder** | `MaterialLibrary.ts` lives in `builder/`. Material definitions, slots, and assignment have no home of their own. | As material slots and PBR attributes grow (BACKLOG C3), they'll be buried inside the builder folder. |
| **Hardcoded builders live with infrastructure** | `ChairBuilder.ts`, `TableBuilder.ts`, `PersonBuilder.ts`, `DiningChairBuilder.ts` sit next to `TracedBuilder.ts` | These are example/demo content, not platform code. They blur the line between "what the system provides" and "what a user creates". |
| **No clear `pipeline/` or `modifiers/` concept** | Subdivision lives in `geometry/`, materials in `builder/`, validation in `validation/`. There's no place for a modifier stack, deformers, or post-processing steps. | A builder currently has to manually call subdivision, then validation, then export. There's no composable pipeline. |

---

## 2. The Builder Pipeline — How Tools Are Used in Sequence

A builder currently follows this implicit sequence:

```
1. Decisions      →  decide(), decideNumber(), decideCount()
2. Measurements   →  defineMeasurement(), defineDerived()
3. Geometry       →  createCircleLoop(), loftLoops(), capLoop()
                     OR: extrude(Shape2D), lathe(), sweep()
4. Composition    →  compose() sub-builders
5. (manual)       →  subdivision, mesh transforms
6. Build          →  build() → TracedOutput
7. (external)     →  validation, export
```

### What works well

- **Steps 1–4 are coherent.** TracedBuilder provides a fluent API that reads naturally. Decisions feed measurements, measurements feed geometry expressions. This is the core strength.
- **Tracing is thorough.** Every operation gets a trace entry. This is genuinely useful for debugging and quality gates.
- **Seeded randomness is correctly implemented.** Fork-based RNG for sub-builders maintains determinism.
- **Composition via `compose()` is solid.** Offset, rotation, scale, constraints, instance-vs-merge — all the right knobs exist.

### What's missing or awkward

**A. No modifier stack / post-processing pipeline**

After `build()`, there's no standard way to apply a sequence of operations:
- Subdivision (exists in `geometry/Subdivision.ts` but must be called manually)
- Bevel/chamfer (not yet implemented, BACKLOG C2)
- Deformers — bend, twist, taper, noise (not yet implemented, BACKLOG C5)
- Material assignment (happens during build, not after)
- UV generation (not yet implemented, BACKLOG C4)

A modifier stack would let builders declare intent without immediately executing:

```yaml
modifiers:
  - type: subdivision
    levels: 1
  - type: bevel
    edges: sharp
    radius: 0.005
  - type: deform_bend
    axis: y
    angle: 15
    origin: [0, 0.5, 0]
```

This is **virtual at first** — the YAML declares it, the system evaluates lazily or on `build()`. This matches how 3D tools (Blender, Houdini) work and would significantly reduce boilerplate.

**B. No standard "part" abstraction**

Builders create geometry as a single Mesh. There's no way to tag sub-regions of the mesh as named parts (e.g. "seat", "leg_front_left", "backrest") with their own material, bounding box, and metadata. The SceneGraph in `builder/` is close but operates at the *scene* level, not the *part* level within a single builder output.

**C. Validation is disconnected from the build**

`ValidationAPI.ts` exists but it's called externally via the `builder.quality` DSL command. It should be possible to declare validation constraints as part of the builder definition:

```yaml
quality:
  target_tier: 2
  constraints:
    min_faces_per_part: 6
    max_degenerate_ratio: 0.05
    required_materials: 2
```

This already aligns with BACKLOG track A (quality gates).

**D. Export is an afterthought**

There's no `export/` folder or abstraction. Export to OBJ, glTF, or PSD (BACKLOG B2, C6) will need a place to live. Currently there are `export_obj` and `export_glb` commands inlined in `authoring/commands/builder.ts`.

---

## 3. Proposed Restructuring

### 3.1 Cognitive Load Consideration

The flat structure originally proposed (17 folders) reduces the problem of "what does this folder contain?" but increases the problem of "where do I even start?" A developer opening `src/` sees 17 peer folders with no hierarchy.

**Solution**: Add one organizational layer that groups by *domain*. This reduces top-level cognitive load to 6 entries while preserving fine-grained organization within each domain.

### 3.2 Final Structure with Organizational Layer

```
src/
├── platform/                "Core infrastructure — math, geometry, scenes"
│   ├── math/                    "What are the numeric primitives?"
│   │   ├── Vec3.ts
│   │   ├── Mat4.ts
│   │   ├── Transform.ts
│   │   ├── AABB.ts
│   │   ├── Spline.ts
│   │   ├── Random.ts
│   │   └── MathService.ts
│   │
│   ├── spatial/                 "How do I distribute things in space?"
│   │   ├── ScalarField.ts
│   │   ├── PoissonDisk.ts
│   │   ├── Scatter.ts
│   │   └── Instance.ts
│   │
│   ├── geometry/                "How do I create and manipulate meshes?"
│   │   ├── Mesh.ts
│   │   ├── Vertex.ts
│   │   ├── Face.ts
│   │   ├── EdgeLoop.ts
│   │   ├── Path2D.ts
│   │   ├── Shape2D.ts
│   │   ├── MeshOperations.ts
│   │   ├── MeshTransform.ts
│   │   ├── Extrude.ts
│   │   ├── Sweep.ts
│   │   └── Subdivision.ts
│   │
│   ├── scene/                   "How do I organize objects in a scene?"
│   │   ├── SceneNode.ts
│   │   ├── SceneGraph.ts
│   │   └── Placement.ts
│   │
│   ├── materials/               "How do I define surface properties?"
│   │   └── MaterialLibrary.ts
│   │
│   └── modifiers/               "What post-processing can I apply?"
│       ├── ModifierStack.ts
│       ├── SubdivisionModifier.ts
│       └── (future: BevelModifier, DeformModifier, UVModifier)
│
├── generation/              "Builder engine — how content gets created"
│   ├── builder/                 "How does the authoring engine work?"
│   │   ├── TracedBuilder.ts
│   │   ├── YamlBuilderParser.ts
│   │   ├── ExpressionService.ts
│   │   ├── SharedContext.ts
│   │   └── SceneBuilder.ts
│   │
│   ├── text/                    "How do I turn text into geometry?"
│   │   ├── FontParser.ts
│   │   ├── ProceduralFont.ts
│   │   └── TextToShape.ts
│   │
│   ├── validation/              "How do I check quality?"
│   │   ├── ValidationAPI.ts
│   │   ├── MeshChecks.ts
│   │   └── MeshValidation.ts
│   │
│   └── export/                  "How do I get results out?"
│       └── (future: ObjExporter, GltfExporter, PsdExporter)
│
├── servers/                 "External interfaces — MCP, authoring, dashboard"
│   ├── authoring/               "How does the DSL server work?"
│   │   ├── server.ts
│   │   ├── command-parser.ts
│   │   ├── command-registry.ts
│   │   └── commands/
│   │
│   ├── mcp/                     "How does the MCP integration work?"
│   │   ├── server.ts
│   │   ├── http-server.ts
│   │   └── minimal-server.ts
│   │
│   ├── dashboard/               "How does the preview UI work?"
│   │   └── main.ts
│   │
│   └── knowledge/               "Domain knowledge for intelligent generation"
│       └── (future: KnowledgeServer, ObjectSchemas, WorkflowHints)
│
├── storage/                 "Persistence layer"
│   ├── StorageProvider.ts
│   ├── FileSystemStorage.ts
│   └── index.ts
│
├── demos/                   "Example content — not platform code"
│   ├── ChairBuilder.ts
│   ├── TableBuilder.ts
│   ├── PersonBuilder.ts
│   └── MeshMapBaker.ts
│
└── tests/
```

### 3.3 What Changed

| Change | Rationale |
|--------|-----------|
| **Added organizational layer** | Groups 17 folders into 6 top-level domains (platform, generation, servers, storage, demos, tests). Reduces cognitive load when first opening the project. |
| `core/` → `platform/math/` | Name matches contents. Vec3 and Mat4 are math, not "core platform." The `platform/` parent signals these are foundational. |
| Spatial algorithms → `platform/spatial/` | ScalarField, PoissonDisk, Scatter, Instance are tools that *use* math. Separating them clarifies the dependency direction. |
| `platform/scene/` extracted | SceneNode, SceneGraph, Placement all deal with "where things go in a scene." Putting them together resolves the two-SceneNode confusion. |
| `platform/materials/` extracted | Gives materials room to grow (slots, PBR, textures) without cluttering builder/. |
| `platform/modifiers/` added | Home for the modifier stack concept. Even if only SubdivisionModifier exists initially, the folder signals the pattern. |
| `generation/` domain | Groups builder engine, text, validation, export — all concerned with "how content gets created." |
| `servers/` domain | Groups authoring, mcp, dashboard, knowledge — all external interfaces that consume the generation layer. |
| `servers/knowledge/` added | Placeholder for domain knowledge server (see SYSTEM_FLOW.md for concept). |
| `generation/export/` added | Gives export formats a proper home instead of being inlined in command handlers. |
| `demos/` extracted | Hardcoded builders are example content. Separating them makes it obvious that TracedBuilder is infrastructure and ChairBuilder is a demo. |
| `builder/` slimmed down | Now contains only the 5 files that form the authoring engine core. |

### 3.4 Dependency Direction (Clean Layering)

```
                     ┌──────────────────────────────────────────────────────┐
                     │                    platform/                         │
                     │  math/ ← spatial/ ← geometry/                        │
                     │                   ← scene/    ← materials/           │
                     │                               ← modifiers/           │
                     └─────────────────────────┬────────────────────────────┘
                                               │
                                               ▼
                     ┌──────────────────────────────────────────────────────┐
                     │                   generation/                        │
                     │  builder/ ← text/                                    │
                     │          ← validation/                               │
                     │          ← export/                                   │
                     └─────────────────────────┬────────────────────────────┘
                                               │
                                               ▼
                     ┌──────────────────────────────────────────────────────┐
                     │                     servers/                         │
                     │  authoring/ ← mcp/                                   │
                     │            ← dashboard/                              │
                     │            ← knowledge/                              │
                     └──────────────────────────────────────────────────────┘

storage/ (independent, used by servers/)
demos/   (depends on generation/, example content only)
tests/   (can reach everything)
```

No circular dependencies. Each layer only imports from layers above it in the diagram.

---

## 4. The Modifier Stack Concept

This is the biggest missing abstraction. Here's what a minimal version looks like:

```typescript
// modifiers/ModifierStack.ts

interface Modifier {
  type: string;
  params: Record<string, any>;
  apply(mesh: Mesh): Mesh;  // immutable: returns new mesh
}

class ModifierStack {
  private modifiers: Modifier[] = [];

  add(modifier: Modifier): this {
    this.modifiers.push(modifier);
    return this;
  }

  /** Apply all modifiers in sequence */
  apply(mesh: Mesh): Mesh {
    let result = mesh;
    for (const mod of this.modifiers) {
      result = mod.apply(result);
    }
    return result;
  }

  /** Preview: return list of modifier descriptions (virtual, no execution) */
  describe(): string[] {
    return this.modifiers.map(m => `${m.type}(${JSON.stringify(m.params)})`);
  }
}
```

### Why "virtual first" matters

A YAML builder can declare modifiers without the implementation existing yet:

```yaml
modifiers:
  - type: subdivision
    levels: 1
  - type: bevel          # not yet implemented
    edges: sharp
    radius: 0.005
```

The parser records them. `ModifierStack.apply()` skips unknown types with a warning. This means builders can express intent ahead of the implementation, and when bevel ships, existing builders automatically benefit.

### Integration with TracedBuilder

```typescript
// In TracedBuilder.build():
build(): TracedOutput {
  let finalMesh = this.mesh;
  if (this.modifierStack.length > 0) {
    finalMesh = this.modifierStack.apply(finalMesh);
  }
  // ... rest of build
}
```

---

## 5. Other Missing Features Not in the Plan

| Feature | Why it's needed | Size |
|---------|----------------|------|
| **Part tagging on mesh regions** | Builders need to say "these faces are the seat" for material assignment, quality checks, and export. Without it, everything is one anonymous blob. | M |
| **Builder result caching** | `compose()` re-runs sub-builders every time. If a table composes 4 identical chairs, it runs the chair builder 4 times. A cache keyed on (builderName, seed, overrides) would help. | S |
| **Constraint propagation** | Parent builders pass constraints via `__constraints__` in overrides — this works but is implicit. A first-class constraint system would make dependency graphs visible. | M |
| **Undo/history in authoring** | The authoring server has no undo. Each DSL command is fire-and-forget. A command journal would enable undo and session replay. | M |
| **Typed DSL return values** | Commands return `any`. Adding typed results (e.g., `BuilderRunResult`, `MeasurementValue`) would improve agent integration. | S |

---

## 6. Does Restructuring Reduce Cognitive Load?

Yes, and here's the specific claim:

**Current state**: To understand how a builder works, you need to look in 4+ folders:
- `builder/` for TracedBuilder, but also SceneGraph, Placement, Materials
- `core/` for math AND spatial algorithms AND scene nodes
- `geometry/` for mesh operations
- `validation/` for quality checks (maybe)

**After restructuring**: Each question maps to one folder:
- "How does the builder engine work?" → `builder/` (5 files)
- "What math is available?" → `math/` (7 files)
- "How do I place things in space?" → `spatial/` (4 files)
- "What's an example builder?" → `demos/`

The builder folder shrinks from 11 files to 5. A new contributor reads `builder/TracedBuilder.ts` and sees only infrastructure, not example code interleaved with it.

The modifier stack gives a single place to understand post-processing, instead of hunting through geometry/ for Subdivision.ts and wondering "where does bevel go when it exists?"

---

## 7. Recommendation

1. **Do the restructuring before starting Track A/B work.** Moving files is cheap now (no external consumers). It gets expensive later as more code accumulates.
2. **Add `ModifierStack` as part of B1 (cleanup).** Even with just `SubdivisionModifier`, it establishes the pattern.
3. **Add part tagging to TracedBuilder** as a lightweight extension — a `Map<string, number[]>` from part name to face indices. This unblocks material slots (C3) and quality per-part checks (A2).
4. **Move hardcoded builders to `demos/`** immediately. They're useful references but shouldn't look like platform code.
