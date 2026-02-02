# Master Plan - Procedurable

> **Version:** 3.0 (2026-02-03 revision — Phase 3 planning)
> **Purpose:** Vision, strategy, and philosophy. The "why" and "what".
> **Tactical Work:** See `BACKLOG.md` for work items.
> **Supersedes:** Previous master plan (archived in git history).

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `BACKLOG.md` | Work items, stories, acceptance criteria |
| `FEASIBILITY_STUDY.md` | Honest assessment of what's achievable and when |
| `QUALITY_TIERS.md` | Quality level definitions and automated gates |
| `ARCHITECTURE.md` | System design and technical decisions |
| `PROBLEM_DOMAIN.md` | Target builders and their requirements |
| `SOLUTION_DOMAIN.md` | Geometry tools inventory and status |
| `AUTHORING_PROBLEM_DOMAIN.md` | Builder authoring challenges |
| `AUTHORING_SOLUTION_DOMAIN.md` | Authoring infrastructure inventory |
| `PROCEDURAL_TECHNIQUES.md` | Noise, patterns, layout algorithms |

---

## Vision

**Procedurable is a decision-driven procedural authoring platform.** Authors (human and AI agent) define "builders" -- procedural generators that make decisions the way a 3D artist would. The platform provides the foundational tools, quality standards, and feedback loops that let builders produce professional-quality digital assets.

### Core Principles

1. **Decisions are first-class.** Every style choice, proportion, material selection is a named, traceable, overridable decision. A builder without meaningful decisions is just a script.

2. **Quality has tiers.** Every builder declares its target quality tier and is held to measurable standards. "It renders" is not "it's done." See `QUALITY_TIERS.md`.

3. **Authoring, not rendering.** Procedurable authors decisions and structure. Renderers and engines consume the output. We are not building a 3D engine.

4. **Agents are authors.** The platform must give AI agents the same affordances as human authors: discovery, creation, structured feedback, and iteration.

5. **Deterministic and reproducible.** Same seed produces same result. Always.

---

## What Exists (Completed Infrastructure)

### Phase 1: Infrastructure (Complete)
- MCP server (4 tools, stable protocol)
- Authoring server (DSL commands, hot-reload, WebSocket)
- YAML builder format (decisions, measurements, derived, geometry, composition)
- Real-time dashboard (Three.js preview, seed browsing)
- Storage provider (filesystem, ready for S3)
- 29+ DSL commands, all tested

### Phase 2 Completed (2026-01-31 to 2026-02-03)
- **Quality system:** Quality gates (Tier 0-2), decision coverage testing, sophistication plans, plan-to-gate comparison
- **Scene format:** PSD v0.1 with serialization, deserialization, tag aggregation, spatial queries, overview/drill-down
- **Metadata:** Persistent store with furniture dimensions, style palettes, material properties, builder relationships
- **Builder authoring DSL:** Template generation, section editing, sophistication-guided creation
- **Builder negotiation:** Attachment points with port alignment, request/offer protocol, transition zone blending
- **Geometry tools:** 2D booleans, bevel/chamfer, material slots (PBR), UV generation, noise/bend/twist/taper deformers, mirror/radial array
- **Export:** glTF 2.0 (geometry, materials, UVs, scenes, instances)
- **Topology:** Automated mesh validation, winding fixes across all geometry operations
- **Architecture:** Codebase reorganized to 6 domain folders, parser refactored to 22 command handlers
- **Demos:** DiningChair Tier 2 (100% decision coverage), Vase Tier 2, Gear (partial)

### Known Gaps Carried to Phase 3
- D3 Gear needs involute teeth (cosmetic)
- D4 Furnished Room not started (Table NaN bug blocks DiningScene)
- Skeleton/weights/morph targets are stubs only (→ Track E)
- No style system beyond flat metadata (→ Track F)
- No terrain mesh generation (→ Track G)

### Code Structure Reorganization (Completed 2026-01-31)

The codebase has been restructured from 10+ flat folders to 6 domain-organized groups:

```
src/
├── platform/     Core infrastructure (math, geometry, spatial, scene, materials, modifiers)
├── generation/   Content pipeline (builder, text, validation, export)
├── servers/      External interfaces (authoring, mcp, dashboard, knowledge)
├── storage/      Persistence layer
├── demos/        Example builders (not platform code)
└── tests/        Test suites
```

**Benefits:**
- Clear separation of infrastructure vs. engine vs. interfaces vs. examples
- Reduced cognitive load at top level (6 folders vs. 10+)
- Room for future components (modifiers/, knowledge/, export/)
- Dependencies flow cleanly: platform ← generation ← servers

See `CODE_STRUCTURE_EVALUATION.md` for full details.

---

## Phase 2: The Authoring Platform (Complete)

> Phase 2 made the authoring platform excellent: quality enforcement, scene description, metadata, foundational geometry tools, and inter-builder communication. **49 of 51 stories complete.** Full details in `BACKLOG_PHASE2_ARCHIVE.md`.

### Phase 2 Summary

| Track | Milestones | Status |
|-------|-----------|--------|
| **A: Quality & Standards** | A1 Quality Declaration, A2 Quality Gates, A3 Decision Coverage, A4 Sophistication Plans | ✅ All complete |
| **B: Platform Components** | B1 Foundation Cleanup, B2 PSD Scene Format, B3 Metadata Store, B4 Builder Authoring DSL, B5 Builder Negotiation | ✅ All complete |
| **C: Geometry Tools** | C0 Topology Fixes, C1 2D Booleans, C2 Bevel/Chamfer, C3 Material Slots, C4 UV Generation, C5 Deformers, C6 glTF Export, C7 Symmetry | ✅ All complete |
| **D: Domain Demos** | D1 DiningChair Tier 2, D2 Vase Tier 2 | ✅ Complete |
| **D: Domain Demos** | D3 Gear Tier 2, D4 Furnished Room | 🟡 Partial / ⬜ Not started |

### What Phase 2 Built
- **Quality:** Automated quality gates (Tier 0-2), decision coverage testing, sophistication plans, plan-to-gate comparison
- **Scene format:** PSD v0.1 with tags, bounds, materials, spatial queries, overview/drill-down, tag aggregation
- **Metadata:** Persistent key-value store with domain knowledge (furniture dimensions, style palettes, materials, builder relationships)
- **Builder authoring:** Template generation, section editing, sophistication-guided creation — all via DSL
- **Builder negotiation:** Attachment points with port alignment, request/offer protocol via SharedContext, transition zone blending via loft
- **Geometry:** 2D booleans, bevel/chamfer, material slots (PBR-ready), UV generation (box/lathe/sweep/extrude), noise/bend/twist/taper deformers, mirror/radial array, glTF export (geometry + materials + scenes + instances)
- **Architecture:** Codebase reorganized into 6 domain folders, YamlBuilderParser refactored from 2005 to 118 lines with 22 command handlers

---

## Phase 3: Dynamic Models, Domain Knowledge, and Complex Scenes

> **Goal:** Export dynamic models with rigs for animation. Build complex scenes driven by domain knowledge. Enable agents to define new knowledge and builders with only very rare code changes.

### Track E: Rigging & Animation Data

**Goal:** Builders declare skeletons, weights, and morph targets in YAML. Rigged models export to glTF for animation in external tools.

| Milestone | Purpose |
|-----------|---------|
| E1: Skeleton Declaration | `skeleton:` section in YAML — joints with parent, position, constraints; composition merges skeletons |
| E2: Vertex Weights | Rule-based weight painting: proximity, region, gradient rules evaluated against mesh + skeleton |
| E3: Morph Targets | Named vertex offset sets, blendable by weight; topology validation; dashboard sliders |
| E4: glTF Skeleton Export | Skins, joints, inverse bind matrices, JOINTS_0/WEIGHTS_0 accessors, morph target export |

### Track F: Knowledge & Style System

**Goal:** Domain rules and styles as data, not code. Agents define new knowledge without TypeScript changes.

| Milestone | Purpose |
|-----------|---------|
| F1: Executable Constraints | Constraint schemas (expression, unique, range, reference rules) stored in metadata, evaluated by platform |
| F2: Style Definitions | Style as first-class data: decision defaults, material palette, proportion rules, pattern preferences; cascades through composition |
| F3: Role-Based Composition | Compose by role + style instead of builder name; builder role registry resolves candidates |
| F4: Cross-Builder Constraints | Proportion rules across siblings; assembly connection metadata for mechanical queries |

### Track G: World & Scene Capabilities

**Goal:** Complex scenes with terrain, LOD, and a full procedural PBR texture pipeline.

| Milestone | Purpose |
|-----------|---------|
| G1: Height Field Mesh | Terrain from scalar fields; chunk-aligned tiling; pad flattening via B5 negotiation |
| G2: LOD System | LOD-conditional composition; view-dependent generation with distance-based tier selection |
| G3: UV Pipeline | Fix per-operation UVs, smart unwrapping, texture atlasing, UV quality gates |
| G4: Procedural Textures | UV-space noise evaluation, material layering, mesh analysis (curvature, AO), domain generators |
| G5: Decals & Text | Planar/cylindrical decal projection, text rasterization into textures, logo placement |
| G6: Texture Baking | Bake procedural materials to PBR texture files (albedo, normal, roughness, metallic, AO) |
| G7: Billboard Primitives | Camera-facing quads for particles, effects, and vegetation cards |

#### G3-G6: The PBR Texture Pipeline

The texture system is a major undertaking, comparable in scope to the geometry system. Key principles:

1. **Baked textures, not runtime shaders.** Builders produce PNG/JPEG texture files deterministically. glTF exports reference these files. This avoids compute-intensive runtime evaluation and ensures portability.

2. **Optional for previews.** Dashboard can render plain material colors without textures for fast iteration. Texture baking is an explicit step.

3. **Housekeeping for temp textures.** Baked textures go to a managed cache. Cleanup commands prevent unbounded growth.

4. **Three.js PBR rendering.** Dashboard uses `MeshStandardMaterial` with baked texture maps for full PBR preview when available.

See `PBR_TEXTURE_EVALUATION.md` for the full design exploration.

### Track H: Phase 3 Demos

**Goal:** Vision-inspired scenes that prove the system end-to-end.

| Demo | Tests | Key Dependencies |
|------|-------|-----------------|
| H1: Rigged Creature | Skeleton composition, weights, rigged glTF export | E1-E4 |
| H2: Styled Room | Style cascading, role-based composition, material theming | F2, F3 |
| H3: Chess Board | Domain constraints, legal position generation, PSD semantic queries | F1 |
| H4: Village on Terrain | Terrain + negotiation + LOD + scatter | G1, G2, B5 ✅ |
| H5: Textured Furniture | Full PBR textures with wear, decals, branded variants | G3-G6 |

### Track Dependencies

```
E1 ──→ E2 ──→ E4
E1 ──→ E3 ──→ E4 (morph target export)
F1 ──→ F2 ──→ F3 ──→ F4
G1 ──→ G2 (view-dependent)
G3 ──→ G4 ──→ G5 ──→ G6 (texture pipeline)
G7 (independent)

E4 ──→ H1 (rigged creature)
F2 + F3 ──→ H2 (styled room)
F1 ──→ H3 (chess board)
G1 + G2 ──→ H4 (village)
G6 ──→ H5 (textured furniture)
```

### Recommended Execution (7 Waves)

1. **Wave 1:** E1-001 + F1-001 + G1-001 + G3-001 (skeleton, constraints, terrain, UV fixes — all independent)
2. **Wave 2:** E1-002 + E2-001 + F1-002 + F2-001 + G3-002 (builds on Wave 1)
3. **Wave 3:** E3-001 + F1-003 + F2-002 + F2-003 + G1-002 + G2-001 + G4-001
4. **Wave 4:** E2-002 + E3-002 + E4-001 + E4-002 + F3-001 + G4-002 + G5-001 + G7-001
5. **Wave 5:** F3-002 + F4-001 + F4-002 + G2-002 + G5-002 + G6-001
6. **Wave 6:** G6-002 + G6-003 (texture baking and housekeeping)
7. **Wave 7:** H1-001 + H2-001 + H3-001 + H4-001 + H5-001 (demos)

---

## Deferred Work (Not Forgotten)

These remain valid goals but are explicitly deferred beyond Phase 3.

### Promoted to Phase 3
The following items from the Phase 2 deferred list are now **active in Phase 3 tracks:**
- ~~Animation & Physics~~ → **Track E** (skeleton, weights, morph targets)
- ~~Style System~~ → **Track F** (style definitions, role-based composition)
- ~~Morph Targets / Blend Shapes~~ → **E3** (morph target system)
- ~~LOD / View-Dependent Generation~~ → **G2** (LOD system)
- ~~Advanced Materials~~ (partial) → **G3** (procedural textures, material layering)

### Still Deferred

| Area | Why Deferred | Prerequisite |
|------|-------------|--------------|
| 3D Boolean CSG | Complex, only for architecture | C1 ✅ proves approach |
| Botanical / L-Systems | Vegetation generation | C5 ✅, G1 (terrain) |
| Cloth & Soft Bodies | Character domain only | E-track + deformers |
| Characters / PersonBuilder | Capstone | E + F + morph targets |
| Renderer Package | Deployment concern | C6 ✅ |
| Voxelization / Grid Snapping | LEGO/Minecraft styles | F2 (styles) |
| Event-Driven Placement | Narrative scenes | F1 (constraints) |
| Multi-Pass Composition | True multi-phase execution | B5 ✅ proves ordering works |
| Agent Memory Across Sessions | Learning from iterations | B3 ✅ |
| Builder Snapshot / Rollback | Undo for agent loop | B4 ✅ + git |

---

## Agent Authoring Vision (Revised)

AI agents should be able to:

1. **Discover** -- List builders, query interfaces, understand variation axes
   - *Status: ✅ Built (system.list_builders, builder.get_interface)*

2. **Plan** -- Create sophistication plans before writing geometry; understand what quality tier is achievable with available tools
   - *Status: ✅ Built (A4 — sophistication plans, plan-to-gate comparison)*

3. **Create** -- Author new YAML builders through DSL commands or file edits; compose builders into scenes
   - *Status: ✅ Built (B4 — template generation, section editing, plan-guided creation)*

4. **Evaluate** -- Run quality gates, check decision coverage, compare against sophistication plan
   - *Status: ✅ Built (A2 quality gates, A3 decision coverage, A4 plan comparison)*

5. **Iterate** -- Fix quality gate failures, upgrade tier, accumulate domain knowledge
   - *Status: ✅ Built (A2 machine-readable suggestions, B3 metadata store)*

6. **Accumulate** -- Store world metadata, style guides, builder relationships across sessions
   - *Status: ✅ Built (B3 — MetadataStore with domain knowledge seeds)*

7. **Negotiate** -- Compose builders that adapt to each other: publish spatial requirements, receive offers from environment builders, declare attachment points and blend zones
   - *Status: ✅ Built (B5 — ports, requirements/offers, blend zones)*

8. **Reason about scenes** -- Query large scenes hierarchically (overview then drill-down), compute spatial relationships, understand semantic roles without reading builder source
   - *Status: ✅ Built (B2-003 — overview, inspect, distance, prims_within, tag aggregation)*

9. **Define domain knowledge** -- Create constraint schemas, style definitions, and builder role registries without code changes
   - *Status: Phase 3 (F1 executable constraints, F2 style definitions, F3 role registry)*

10. **Export rigged models** -- Declare skeletons and weights in YAML, export to glTF for animation in external tools
    - *Status: Phase 3 (E1-E4)*

---

## Quality Rules (New)

These supplement the existing development rules:

1. **Every builder declares `quality.target_tier` and `quality.current_tier`.** No exceptions.
2. **Every decision must affect output.** Decision coverage testing enforces this.
3. **Tier 1 is not acceptable for committed builders.** Tier 0 is for prototyping only.
4. **Quality gates run automatically.** Failed gates block completion.
5. **Sophistication plans precede geometry.** Plan what each tier looks like before building.
6. **Agents must fix quality failures before declaring done.** Structured failure output is a TODO list, not a warning.

---

## Development Rules

1. **Follow the plan.** Don't add features not in the current tracks.
2. **Quality over features.** A Tier 2 chair is more valuable than Tier 1 everything.
3. **Fix bugs immediately.** But don't pivot the architecture.
4. **One milestone at a time per track.** Finish before starting the next.
5. **All DSL commands require tests.** No shipping untested commands.
6. **Expose before building.** DSL-expose built tools before writing new ones.
7. **Domain-driven tools.** Build tools by upgrading real builders, not in isolation.
8. **Document what's deferred.** Explicitly say what's not being built and why.

---

## Success Criteria

### Phase 2 (Complete)
1. ✅ All committed builders declare and meet Tier 2 quality
2. ✅ Quality gates run automatically and catch regressions
3. ✅ Decision coverage is >= 90% across all builders
4. ✅ PSD v0.1 format is defined and builders serialize to it
5. ✅ An agent can create a new builder from description and have it pass Tier 2 gates
6. ✅ glTF export works for at least furniture and vessel domains
7. 🟡 Composed scene (furnished room) — blocked by Table fix; DiningScene partially works

### Phase 3
Phase 3 is complete when:

1. A builder can declare a skeleton with joints, weights, and constraints in YAML, and export a rigged glTF that can be posed in Blender
2. An agent can define a new domain constraint schema (e.g., chess rules) via DSL without any TypeScript changes
3. Setting `style: X` at a scene level cascades meaningful visual changes (geometry + materials) to all composed children
4. A terrain builder processes negotiation requirements from building builders and produces adapted terrain
5. At least one demo scene from each Track H milestone passes Tier 2 quality gates
6. All Phase 3 demos export to valid glTF files
7. No Phase 3 feature required modifying platform geometry operations for domain-specific logic (domain logic lives in metadata/constraints/styles)
8. A builder can declare procedural PBR materials and bake them to texture files (albedo, normal, roughness, metallic, AO)
9. The dashboard can render baked PBR textures using Three.js MeshStandardMaterial
10. Decals and text can be procedurally projected into baked textures
11. Texture housekeeping commands exist to manage baked texture cache
