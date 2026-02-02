# Where We're Headed

The target state is a platform where **writing new TypeScript is rare**. Agents author 3D content by:

1. Querying accumulated domain knowledge
2. Composing YAML builders from existing geometry components
3. Validating against automated quality gates
4. Iterating through the DSL, not through code
5. Negotiating with environment builders for context-aware placement
6. Reasoning about scenes through semantic queries

## What "Done" Looks Like

### For an Agent

An agent receives a request: "Create a bookshelf." It:

1. **Queries knowledge** — `world.get furniture.shelving.*` returns standard dimensions, material norms, style attributes
2. **Scaffolds a builder** — `builder.create BookShelf template=shelving` generates a YAML skeleton with domain-appropriate decisions and measurements
3. **Adds geometry** — using existing components (extrude for planks, lathe for decorative elements, sweep for molding) via DSL commands or YAML editing
4. **Validates** — `quality.validate BookShelf tier=2` returns specific, machine-readable pass/fail results
5. **Iterates** — reads failure suggestions programmatically, fixes issues, re-validates
6. **Stores learnings** — `world.set furniture.shelving.lessons "..."` — iteration history auto-recorded

**No TypeScript written.** All authoring happens through the YAML format and DSL commands.

### For a Scene Composer

An agent receives a request: "Create a village on hilly terrain." It:

1. **Plans the scene** — queries knowledge for building types, terrain rules, spacing standards
2. **Creates individual builders** — house, road, bridge, tree — each with ports and requirements
3. **Composes with negotiation** — houses publish "I need flat ground"; terrain adapts; roads publish "I need a cut"; terrain carves road beds
4. **Blends boundaries** — where road meets terrain, blend zones generate smooth transitions
5. **Queries the result** — `scene.overview` gives a summary; `scene.distance house_1 river` checks proximity
6. **Validates holistically** — all builders pass Tier 2 gates; no overlapping geometry; style cascades consistently

### For the Platform

The platform provides:

| Capability | Components | Status |
|------------|-----------|--------|
| Geometry creation | Extrude, Lathe, Sweep, Subdivision, 2D Booleans, Bevel | ✅ Complete |
| Geometry modification | Deformers (noise, bend, twist, taper), Symmetry (mirror, radial array) | ✅ Complete |
| Material assignment | Named slots, PBR-ready, resolver pipeline | ✅ Complete |
| Quality enforcement | Tier-specific gates (machine-readable), decision coverage, sophistication plans | ✅ Complete |
| Agent authoring | Builder creation via DSL, templates, knowledge queries | ✅ Complete |
| Scene composition | Placement, PSD format, spatial queries, tag aggregation | ✅ Complete |
| Builder negotiation | Attachment points, request/offer protocol, blend zones | ✅ Complete |
| Knowledge persistence | World metadata, domain knowledge, material properties | ✅ Complete |
| Export | glTF with materials, hierarchy, UVs, instances | ✅ Complete |
| Rigging & Animation | Skeleton, weights, morph targets | ⬜ Phase 3 |
| Style System | Style definitions, role-based composition, cascading | ⬜ Phase 3 |
| Terrain & LOD | Height fields, view-dependent generation | ⬜ Phase 3 |

## Phase 2 Tracks (Complete)

### Track A: Quality & Standards

**Goal:** Agents know what "good" means and can measure it.

| Story | What It Delivers | Status |
|-------|-----------------|--------|
| A1: Quality Declaration | `quality:` YAML section. Builders state target tier and gaps. | ✅ Complete |
| A2: Quality Gates | Automated Tier 1/2 validation. Machine-readable suggestions agents can act on programmatically. | ✅ Complete |
| A3: Decision Coverage | Tests that every decision option changes the mesh. Flags decorative decisions. | ✅ Complete |
| A4: Sophistication Plans | Format for planning tier upgrades. Reusable across similar builders. | ✅ Complete |

### Track B: Platform Components

**Goal:** Infrastructure for agent-native authoring and inter-builder communication.

| Story | What It Delivers | Status |
|-------|-----------------|--------|
| B1: Consolidation | Fix text glyph holes, complete placement primitives. | ✅ Complete |
| B2: Scene Description (PSD) | Serializable scene format with tag aggregation, summary/drill-down queries, spatial relationship queries. | ✅ Complete |
| B3: World Metadata | Persistent KV store. Style definitions. Domain knowledge. | ✅ Complete |
| B4: Builder Authoring via DSL | Create and edit builders through commands, not file editing. | ✅ Complete |
| B5: Builder Negotiation | Attachment points (ports), request/offer protocol, transition zone blending. | ✅ Complete |

### Track C: Foundational Geometry

**Goal:** Platform geometry tools sufficient for Tier 2+ content.

| Story | What It Delivers | Status |
|-------|-----------------|--------|
| C1: 2D Booleans | Union/subtract/intersect polygons. Unblocks text holes, gear profiles. | ✅ Complete |
| C2: Bevel & Chamfer | Edge treatment. Single biggest visual quality improvement. | ✅ Complete |
| C3: Material Slots | Named regions instead of vertex colors. Multi-material support. | ✅ Complete |
| C4: UV Generation | Automatic texture coordinates. Required for texturing and glTF. | ✅ Complete |
| C5: Deformers | Bend, twist, taper, noise displacement. Organic variation. | ✅ Complete |
| C6: glTF Export | Standard 3D interchange format with materials, hierarchy, and instances. | ✅ Complete |
| C7: Symmetry Operations | Mirror and radial array. Essential for mechanical parts and styles. | ✅ Complete |

### Track D: Domain Demos

**Goal:** Prove the platform works by rebuilding key builders at Tier 2.

| Story | What It Proves | Status |
|-------|---------------|--------|
| D1: DiningChair Tier 2 | Core furniture workflow, quality gates, multi-material | ✅ Complete |
| D2: Vase Tier 2 | Lathe workflow, surface variation, deformers | ✅ Complete |
| D3: Gear Tier 2 | 2D boolean workflow, mechanical precision | 🟡 Partial (needs involute teeth) |
| D4: Furnished Room | Full composition: multiple builders + placement + scene export | ⬜ Blocked by Table fix |

## Phase 3 Tracks (Active)

### Track E: Rigging & Animation Data

**Goal:** Builders declare skeletons, weights, and morph targets in YAML. Rigged models export to glTF for animation.

| Milestone | What It Delivers |
|-----------|-----------------|
| E1: Skeleton Declaration | `skeleton:` section in YAML — joints with parent, position, constraints |
| E2: Vertex Weights | Rule-based weight painting: proximity, region, gradient rules |
| E3: Morph Targets | Named vertex offset sets, blendable by weight; dashboard sliders |
| E4: glTF Skeleton Export | Skins, joints, inverse bind matrices, JOINTS_0/WEIGHTS_0 accessors |

### Track F: Knowledge & Style System

**Goal:** Domain rules and styles as data, not code. Agents define new knowledge without TypeScript changes.

| Milestone | What It Delivers |
|-----------|-----------------|
| F1: Executable Constraints | Constraint schemas (expression, unique, range, reference rules) stored in metadata |
| F2: Style Definitions | Style as first-class data: decision defaults, material palette, proportion rules |
| F3: Role-Based Composition | Compose by role + style instead of builder name; builder role registry |
| F4: Cross-Builder Constraints | Proportion rules across siblings; assembly connection metadata |

### Track G: World & Scene Capabilities

**Goal:** Complex scenes with terrain, LOD, procedural textures, and effects.

| Milestone | What It Delivers |
|-----------|-----------------|
| G1: Height Field Mesh | Terrain from scalar fields; chunk-aligned tiling; pad flattening |
| G2: LOD System | LOD-conditional composition; view-dependent generation |
| G3: Procedural Textures | UV-space noise evaluation (wood grain, stone, patina); material layering |
| G4: Billboard Primitives | Camera-facing quads for particles, effects, and vegetation cards |

### Track H: Phase 3 Demos

| Demo | What It Proves | Key Dependencies |
|------|---------------|-----------------|
| H1: Rigged Creature | Skeleton composition, weights, rigged glTF export | E1-E4 |
| H2: Styled Room | Style cascading, role-based composition, material theming | F2, F3 |
| H3: Chess Board | Domain constraints, legal position generation, PSD semantic queries | F1 |
| H4: Village on Terrain | Terrain + negotiation + LOD + scatter | G1, G2 |

## Dependency Map

### Phase 2 (Complete)
```
A1 ✅ ─► A2 ✅ (gates) ─► A3 ✅ (coverage) ─► A4 ✅ (plans)
                │
B1 ✅ ──► B2 ✅ (PSD) ─► B3 ✅ (metadata) ─► B4 ✅ (DSL authoring)
                │
                └──► B5 ✅ (negotiation)
                │
C1 ✅ (2D bool) ─► C2 ✅ (bevel) ─► C3 ✅ (materials) ─► C4 ✅ (UVs) ─► C5 ✅ (deform) ─► C6 ✅ (glTF)
                 │                                              │
                 └──────────► D1 ✅ (Chair Tier 2) ◄──────────────┘
                              D2 ✅ (Vase Tier 2)
                              D3 🟡 (Gear Tier 2 - partial)
                              D4 ⬜ (Furnished Room - blocked)

C7 ✅ (symmetry) — complete
```

### Phase 3 (Active)
```
E1 ──→ E2 ──→ E4
E1 ──→ E3 ──→ E4 (morph target export)
F1 ──→ F2 ──→ F3 ──→ F4
G1 ──→ G2 (view-dependent)
G3, G4 — independent

E4 ──→ H1 (rigged creature)
F2 + F3 ──→ H2 (styled room)
F1 ──→ H3 (chess board)
G1 + G2 ──→ H4 (village)
```

## Measuring Progress

Progress is measured by what agents **can do without writing TypeScript**:

### Phase 2 Milestones (Complete)

| Milestone | Agent Can... | Status |
|-----------|-------------|--------|
| M1 | Run existing builders, override decisions | ✅ Complete |
| M2 | Validate quality against Tier 2 criteria | ✅ Complete |
| M3 | Create new builders via DSL | ✅ Complete |
| M4 | Produce Tier 2 geometry (beveled, multi-material) | ✅ Complete |
| M5 | Save/load complete scenes, query them semantically | ✅ Complete |
| M6 | Accumulate domain knowledge | ✅ Complete |
| M7 | Export production-ready glTF | ✅ Complete |
| M8 | Compose builders that negotiate with their environment | ✅ Complete |
| M9 | Apply symmetry, mirror, and radial patterns | ✅ Complete |

### Phase 3 Milestones (Active)

| Milestone | Agent Can... | Requires |
|-----------|-------------|----------|
| M10 | Declare skeletons with joints and constraints | E1 |
| M11 | Export rigged glTF that can be posed in Blender | E4 |
| M12 | Define domain constraints via DSL without TypeScript | F1 |
| M13 | Apply styles that cascade to composed children | F2 |
| M14 | Compose by role + style instead of builder name | F3 |
| M15 | Generate terrain that adapts to building requirements | G1 |
| M16 | Create LOD-aware scenes | G2 |
| M17 | Author full scenes from knowledge without guidance | All Phase 3 |

## Deferred but Not Forgotten

These remain valid goals, explicitly deferred beyond Phase 3:

| Area | Prerequisite | Notes |
|------|-------------|-------|
| 3D Boolean CSG | C1 ✅ proves approach | Complex, only for architecture |
| Botanical / L-Systems | C5 ✅, G1 | Vegetation generation |
| Cloth & Soft Bodies | E-track + deformers | Character domain only |
| Characters (PersonBuilder) | E + F + morph targets | Capstone |
| Voxelization / Grid Snapping | F2 (styles) | LEGO/Minecraft styles |

### Promoted to Phase 3

The following items from Phase 2 deferred list are now **active in Phase 3 tracks:**

| Previously Deferred | Now In |
|--------------------|--------|
| Animation & Physics | Track E (skeleton, weights, morph targets) |
| Style System | Track F (style definitions, role-based composition) |
| Morph Targets / Blend Shapes | E3 (morph target system) |
| LOD / View-Dependent Generation | G2 (LOD system) |
| Advanced Materials (partial) | G3 (procedural textures, material layering) |

See `VISION_EXAMPLES.md` for the full set of 13 stress-test scenarios and 25 identified gaps.
