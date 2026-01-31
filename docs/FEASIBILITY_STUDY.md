# Feasibility Study: Procedurable as an Artist-Agent Authoring Platform

> **Date:** 2026-01-31
> **Branch:** `claude/feasibility-study-vvEzv`
> **Purpose:** Honest assessment of what Procedurable can realistically achieve, where the abstraction layers risk becoming unmanageable, and a scoped path forward.

---

## 1. What Procedurable Is Trying to Be

Procedurable aspires to be a **toolkit for building "virtual artists"** -- procedural generators (builders) that make decisions the way a human artist would (style, proportion, composition, material, production). These builders are authored by humans or AI agents through a layered system:

```
AI Agent / Human Author
    ↓  MCP protocol
MCP Server (stable, 4 tools)
    ↓  HTTP proxy
Authoring Server (DSL commands, hot-reload)
    ↓  YAML parsing
Builder Engine (TracedBuilder, geometry, materials)
    ↓  WebSocket
Dashboard (Three.js visualization)
```

The ambition extends from single objects (chairs, vases) through composed scenes (dining rooms) to infinite streaming worlds (terrain, cities, biomes).

---

## 2. What Exists Today (Honest Inventory)

### Solid Foundations (High Confidence)

| Layer | Status | Assessment |
|-------|--------|------------|
| MCP Server | Stable | 4 tools, rarely changes. Clean separation. |
| Authoring Server | Stable | DSL command system, hot-reload, WebSocket. |
| YAML Builder Format | Mature | Decisions, measurements, derived, geometry, composition. |
| Core Math | Solid | Seeded RNG, expressions, Perlin/FBM, coordinate hashing. |
| Geometry Primitives | Good | Box, sphere, loft, lathe, sweep, subdivide, extrude. |
| Composition System | Good | Compose, repeat, conditional, placement, instancing. |
| World Foundations | Good | Scalar fields, Poisson disk, instancing, chunk contract. |
| Tracing/Debugging | Solid | Decision, measurement, geometry, composition traces. |
| Dashboard | Functional | Three.js preview, seed browsing, WebSocket updates. |

### Partially Built (Needs Work)

| Feature | State | Gap |
|---------|-------|-----|
| Text/Typography | 3/8 stories | No glyph holes, no text-on-path, no typography controls. |
| Agent Authoring | 6/7 stories | Introspection done; semantic scene graph incomplete. |
| 2D Shapes & Extrusion | Complete but... | Gear demo unfinished; Shape2D/Path2D consolidation pending. |
| Architecture Consolidation (M3b) | Not started | Blocks further M4 work; service ownership unclear. |

### Not Built (Large Gaps)

- 3D Boolean CSG
- Botanical systems (L-systems, branch geometry)
- Advanced materials (layer stacks, PBR, procedural textures)
- Cloth & soft bodies
- Characters (the "capstone" that needs everything)
- UVs, bevels, normals control
- Deformers (bend/twist/taper/noise)
- Export pipeline (glTF)
- Renderer package

---

## 3. The Abstraction Problem

The user's intuition is correct: **there are too many abstraction layers between intent and output for the current stage of development.**

### The Layer Stack

```
Layer 7:  Agent intent ("make a cozy dining scene")
Layer 6:  Semantic scene graph (tagged parts, spatial queries)
Layer 5:  Builder composition (YAML compose/placement)
Layer 4:  Geometry operations (loft, sweep, extrude, CSG)
Layer 3:  Mesh primitives (vertices, faces, edge loops)
Layer 2:  Math/expression evaluation
Layer 1:  Core types (Vec3, Mat4, AABB, Transform)
Layer 0:  Runtime (Node.js, Three.js rendering)
```

**The problem:** Layers 4-7 are all partially built, meaning every new feature touches multiple incomplete layers simultaneously. A single builder like "Tree" requires L-systems (not built), sweep along paths (built), instancing (built), field-driven scatter (built), and materials (partially built). Each missing piece cascades.

### Specifically What's Out of Reach Right Now

1. **PersonBuilder (P2-M9):** Requires subdivision, sweep, blend shapes, cloth, materials -- most of which don't exist yet. This is correctly identified as a capstone but the path to it is very long.

2. **Infinite Worlds:** The chunk contract and coordinate seeding exist, but without CSG (architecture), L-systems (vegetation), and proper LOD/export, a world is just scattered boxes on terrain.

3. **Agent-as-Author:** An agent can discover builders and run them, but cannot yet *create* new builders intelligently because the semantic feedback loop (build → evaluate → revise) doesn't exist.

---

## 4. What IS Feasible (Smart Scoping)

### The Key Insight

Procedurable's value isn't in being a complete 3D engine. It's in being a **structured authoring platform where decisions are first-class citizens**. The YAML builder format with decisions, measurements, and composition is genuinely novel and well-designed. The question is: what can we build on top of this that delivers real value without requiring every geometry feature to be complete?

### Feasible Near-Term Goals (3-6 month horizon)

#### A. "Builder Authoring Platform" (HIGH feasibility)

The MCP → Authoring Server → YAML pipeline is solid. An agent can already:
- List builders, inspect interfaces
- Run builders with overrides
- Compose builders into scenes
- Get traced, deterministic output

**What's missing to make this truly useful:**
1. A way for agents to **create new YAML builders** through the DSL (not just run existing ones)
2. Structured validation feedback (the semantic scene graph, mostly built)
3. A world metadata collection mechanism (see Section 5)

#### B. "Prop & Furniture Generator" (HIGH feasibility)

The geometry stack (loft, lathe, sweep, subdivide, extrude) already supports the furniture and vessel domains well. With the existing composition system, scenes like dining rooms work.

**What's missing:**
1. Bevel/chamfer for hard-surface finish quality
2. Better material control (layer stacks)
3. glTF export

#### C. "Procedural Signage & Mechanical Parts" (MEDIUM feasibility)

Text-to-shape works for basic cases. 2D shapes and extrusion are functional. But:
- Glyph holes (letter A, O, etc.) need fixing
- Path2D/Shape2D consolidation is pending
- 2D booleans would unlock gears, mechanical parts

#### D. "World Template System" (MEDIUM feasibility)

Terrain + scatter + instancing work. A "world template" that places builders on procedural terrain is achievable. But it won't have:
- Architecture (needs CSG)
- Vegetation (needs L-systems)
- Roads/rivers (needs path-based world features)

#### E. "Full Virtual Artist" (LOW feasibility in near term)

The PersonBuilder capstone, cloth simulation, full material pipelines, animation-ready topology -- these are 12-18 months of focused work minimum.

---

## 5. Proposed New Components

Based on the user's specific questions, here are assessments of proposed additions:

### 5.1 World Metadata Collector (Agent Knowledge Base)

> *"A component where agents can incrementally collect world metadata that can be used for new builders"*

**Feasibility: HIGH**

This is a lightweight, high-value addition. Concept:

```
┌──────────────────────────────────────────────────┐
│  World Metadata Store                             │
│                                                   │
│  Agents discover & record:                        │
│  ├── Available builders + their interfaces        │
│  ├── Builder relationships (chair needs table)    │
│  ├── Style palettes (modern: these materials)     │
│  ├── Spatial rules (chairs face table center)     │
│  ├── Domain knowledge (ergonomic standards)       │
│  └── Generation history (what worked, scores)     │
│                                                   │
│  Storage: YAML/JSON files alongside builders      │
│  API: DSL commands (metadata.set, metadata.get)   │
│  Use: Agents query before building new builders   │
└──────────────────────────────────────────────────┘
```

**Why it's feasible:** It's essentially a structured key-value store with domain schemas. The storage infrastructure exists. The DSL command pattern is well-established. This doesn't require new geometry -- it's pure data.

**What it enables:** Agents can accumulate knowledge across sessions. A "style guide" becomes a queryable metadata document. Builder dependencies become explicit.

### 5.2 Semantic Scene Description Format (Intermediate Representation)

> *"An intermediate semantic scene graph based file format for static and dynamic meshes, inspired by Pixar's USD, but with weight information"*

**Feasibility: MEDIUM (with careful scoping)**

This is the most architecturally significant proposal. Let's break it down:

#### What USD Provides (and what we'd want)
- **Scene hierarchy** (transforms, parent-child)
- **Composition arcs** (references, variants, overrides)
- **Schema-typed prims** (Mesh, Material, Camera, Light, Skeleton)
- **Time-sampled attributes** (animation)
- **Variant sets** (LOD, style alternatives)

#### What Procedurable Needs From This

A "Procedurable Scene Description" (PSD) format that serves as the **output** of builders and the **input** to renderers/exporters:

```yaml
# Conceptual PSD format
psd_version: "0.1"
scene:
  name: "DiningScene"
  seed: 42

  prims:
    - path: /DiningScene/Table
      type: Mesh
      builder: Table
      seed: 42
      tags: [furniture, surface, container]
      transform: { translate: [0, 0, 0] }
      geometry:
        vertices: [...]     # or reference to generated mesh
        faces: [...]
        weights: []          # bone weights (empty until rigging)
      materials:
        - name: oak_wood
          faces: [0..42]
      bounds: { min: [-0.6, 0, -0.4], max: [0.6, 0.76, 0.4] }
      sockets:
        - name: surface_center
          transform: { translate: [0, 0.76, 0] }

    - path: /DiningScene/Chair_1
      type: Instance
      prototype: /prototypes/DiningChair
      transform: { translate: [0.8, 0, 0], rotate: [0, -90, 0] }
      tags: [furniture, seating]
      overrides:
        seat_height: 0.45

  prototypes:
    - path: /prototypes/DiningChair
      type: Mesh
      builder: DiningChair
      tags: [furniture, seating]
      geometry: { ... }
      skeleton:               # Phase 3: empty for now
        joints: []
        weights: []
```

#### Scoped Approach (Feasible Now)

Rather than building a full USD-like system, implement it in layers:

**Layer 1 (Now): Scene Graph with Tags and Bounds**
- Already 80% built via `SceneGraph.ts` and the semantic scene graph work in M2d
- Add: serialization to/from YAML, tag queries, bounds queries
- This is the "queryable output" that agents need

**Layer 2 (Next): Instance Prototypes and Overrides**
- Already partially built via the instancing system
- Add: prototype storage, override tracking, shared mesh references

**Layer 3 (Later): Skeleton/Weight Stubs and Material Slots**
- Stub bone weight arrays in vertex data
- Named material slots instead of just vertex colors
- This prepares for Phase 3 without building Phase 3

**Layer 4 (Future): Time-Sampling and Animation**
- Phase 3 concern; just leave the schema extensible

### 5.3 Elementary/Foundational Tool Assessment

> *"What are the elementary/foundational tools needed that allow authors to define builders?"*

Here's the honest minimum toolkit for useful builder authoring:

#### Already Have (Solid)
1. **Decision system** -- weighted choice, number range, boolean, conditional
2. **Measurement system** -- named dimensions with expressions
3. **Composition system** -- compose, repeat, conditional, placement
4. **Profile-based geometry** -- loft, lathe, sweep
5. **Subdivision** -- Catmull-Clark smoothing
6. **Extrusion** -- 2D shape to 3D mesh
7. **Scatter** -- Poisson disk with field-driven density
8. **Instancing** -- transform-only references
9. **Tracing** -- full decision/geometry audit trail

#### Missing but Foundational
1. **2D Booleans** -- union/subtract/intersect 2D shapes (unlocks mechanical, architectural profiles)
2. **Bevel/Chamfer** -- edge treatment (every hard-surface asset needs this)
3. **Deformers** -- bend/twist/noise displacement (breaks CG-perfect look)
4. **Material Slots** -- named material regions, not just vertex colors
5. **UV Generation** -- automatic UVs for lathe/sweep/extrude output
6. **glTF Export** -- get geometry into other tools/engines

#### Not Foundational (Can Defer)
- 3D CSG (complex, error-prone -- defer until architecture domain)
- L-systems (only needed for botanical)
- Cloth simulation (only needed for characters/fabric)
- Blend shapes (only needed for characters)
- Rigging/animation (Phase 3)

---

## 6. Recommended Path Forward

### Principle: Build the Authoring Platform, Not the Engine

The most defensible value proposition is: **Procedurable is a platform where decisions are first-class, builders are composable, and agents can author procedurally.** The geometry features should serve this, not lead it.

### Phase 2 Revised Scope (Recommended)

#### Sprint 1: Foundation Cleanup
1. Complete P2-M3b (architecture consolidation, service ownership)
2. Fix text glyph holes (the "A" and "O" problem)
3. Complete P2-M2d-007 (last agent authoring story)

#### Sprint 2: Semantic Scene Description (Layer 1)
1. Define PSD v0.1 schema (YAML-based scene graph with tags, bounds, materials)
2. Builder output serializes to PSD
3. DSL commands for scene queries (`scene.query_by_tag`, `scene.get_bounds`)
4. Agent can read and reason about builder output structurally

#### Sprint 3: World Metadata Collector
1. Metadata store with DSL commands
2. Style guide schema (palette, proportions, rules)
3. Builder dependency graph
4. Agent session knowledge persistence

#### Sprint 4: Missing Foundational Tools
1. 2D Booleans (for profiles)
2. Bevel/chamfer (for finish quality)
3. Material slots (named regions)
4. Basic UV generation (for lathe/sweep/extrude)

#### Sprint 5: Export & Demo
1. glTF export (mesh + materials)
2. PSD → glTF pipeline
3. Demo: agent authors a complete furnished room from description

### What This Defers
- PersonBuilder (capstone, still too far)
- Cloth simulation
- L-systems / botanical
- Infinite world streaming (the contract exists; runtime doesn't)
- Animation / rigging (Phase 3)

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Abstraction layers become unmaintainable | MEDIUM | HIGH | M3b consolidation first; strict service ownership. |
| Geometry gaps block useful builders | MEDIUM | MEDIUM | Focus on furniture/vessel/signage domains first; they work with existing tools. |
| Agent authoring doesn't deliver value without full geometry | LOW | HIGH | The metadata + scene description work is geometry-independent. |
| PSD format becomes overengineered | MEDIUM | MEDIUM | Start with Layer 1 only; expand based on actual need. |
| Three.js dashboard becomes bottleneck | LOW | LOW | Dashboard is view-only; PSD is the real output. |

---

## 8. Conclusion

**Is the full vision feasible?** Yes, but not all at once. The abstraction stack is deep, and trying to build all layers simultaneously is the main risk.

**Is a useful subset feasible now?** Yes. The authoring platform (MCP + DSL + YAML builders + decisions + composition) is genuinely solid. The proposed additions (world metadata, semantic scene description) are high-value, relatively low-risk, and don't require the missing geometry features.

**The smart scope:** Stop trying to be a full 3D engine. Double down on being the best **decision-driven procedural authoring platform** with a clear scene description format that other tools can consume. Build the foundational geometry tools (2D booleans, bevel, UVs, export) as they're needed for specific builder domains, not as speculative infrastructure.

The separation of concerns is: **Procedurable authors decisions and structure. Renderers and engines handle the pixels.**

---

## Related Documents

- `MASTER_PLAN.md` -- Vision and strategy
- `BACKLOG.md` -- Tactical work items
- `ARCHITECTURE.md` -- System design
- `AUTHORING_PROBLEM_DOMAIN.md` -- What authors need
- `AUTHORING_SOLUTION_DOMAIN.md` -- Authoring infrastructure inventory
- `IMPLEMENTATION_REVIEW.md` -- Current quality assessment
- `SYSTEM_FLOW.md` -- Data flow and service ownership
